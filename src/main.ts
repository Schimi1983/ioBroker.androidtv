/*
 * ioBroker.androidtv - control Android TV / Google TV devices (e.g. NVIDIA SHIELD)
 * via the Android TV Remote protocol v2.
 */
import * as utils from '@iobroker/adapter-core';
import {
    generateClientCertificate,
    isUsableCertificate,
    parseTvIdentity,
    type ClientCertificate,
} from './lib/certificate';
import { PairingError, PairingSession } from './lib/pairing';
import { RemoteConnection, resolveKeyCode } from './lib/remote';
import { DEVICE_STATES, KEY_BUTTONS } from './lib/states';

type DeviceConfig = ioBroker.AdapterConfig['devices'][number];
type AppConfig = ioBroker.AdapterConfig['apps'][number];

/** Runtime data of one configured TV. */
interface DeviceRuntime {
    id: string;
    config: DeviceConfig;
    connection: RemoteConnection;
    connected: boolean;
    muted: boolean | undefined;
}

/** Open pairing attempt (between "start" and "finish"). */
interface PendingPairing {
    session: PairingSession;
    timer: ioBroker.Timeout | undefined;
}

/** Pairing sessions are dropped after this time; the TV itself cancels after about a minute. */
const PAIRING_SESSION_TTL_MS = 120_000;
const DEFAULT_RECONNECT_MAX_S = 60;

/** Texts returned to the admin UI (sendTo); German or English depending on system language. */
const MESSAGES = {
    pairingStarted: {
        en: 'The TV now shows a 6-digit code. Enter it below and click "Finish pairing".',
        de: 'Der TV zeigt jetzt einen 6-stelligen Code. Unten eingeben und auf „Kopplung abschließen“ klicken.',
    },
    pairingDone: {
        en: 'Pairing successful. The connection is being established.',
        de: 'Kopplung erfolgreich. Die Verbindung wird aufgebaut.',
    },
    noHost: { en: 'Please enter the IP address of the TV.', de: 'Bitte die IP-Adresse des TV eingeben.' },
    noSession: {
        en: 'No pairing in progress for this IP - click "Start pairing" first.',
        de: 'Für diese IP läuft keine Kopplung - zuerst „Kopplung starten“ klicken.',
    },
    noCertificate: {
        en: 'Client certificate not ready yet - wait a few seconds and try again.',
        de: 'Client-Zertifikat noch nicht bereit - ein paar Sekunden warten und erneut versuchen.',
    },
    connect: {
        en: 'Cannot reach the TV on port 6467. Check IP, power and network.',
        de: 'TV auf Port 6467 nicht erreichbar. IP, Stromversorgung und Netzwerk prüfen.',
    },
    timeout: { en: 'The TV did not answer in time.', de: 'Der TV hat nicht rechtzeitig geantwortet.' },
    closed: {
        en: 'The TV closed the pairing (cancelled or timed out). Start again.',
        de: 'Der TV hat die Kopplung beendet (abgebrochen oder Zeit abgelaufen). Erneut starten.',
    },
    rejected: { en: 'The TV rejected the pairing.', de: 'Der TV hat die Kopplung abgelehnt.' },
    invalidPin: {
        en: 'The code must have 6 characters (0-9, A-F).',
        de: 'Der Code muss 6 Zeichen haben (0-9, A-F).',
    },
    wrongPin: {
        en: 'The code does not match. Please check it and try again.',
        de: 'Der Code passt nicht. Bitte prüfen und erneut eingeben.',
    },
} as const;

type MessageKey = keyof typeof MESSAGES;

/**
 * Converts a free text into a valid ioBroker object id part.
 *
 * @param text - e.g. "Shield Wohnzimmer"
 * @param forbidden - Adapter FORBIDDEN_CHARS regex
 */
function toId(text: string, forbidden: RegExp): string {
    return text
        .trim()
        .replace(forbidden, '_')
        .replace(/[\s.]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

class Androidtv extends utils.Adapter {
    private readonly devices = new Map<string, DeviceRuntime>();
    private readonly appsById = new Map<string, AppConfig>();
    private readonly pairings = new Map<string, PendingPairing>();
    private certificate: ClientCertificate | undefined;
    private uiLanguage: 'en' | 'de' = 'en';

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'androidtv',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        await this.setState('info.connection', false, true);

        const sysConfig = await this.getForeignObjectAsync('system.config');
        this.uiLanguage = sysConfig?.common?.language === 'de' ? 'de' : 'en';

        await this.ensureCertificate();

        const devices = (Array.isArray(this.config.devices) ? this.config.devices : []).filter(
            d => d && typeof d.host === 'string' && d.host.trim() !== '',
        );
        const apps = (Array.isArray(this.config.apps) ? this.config.apps : []).filter(
            a =>
                a &&
                typeof a.name === 'string' &&
                a.name.trim() !== '' &&
                typeof a.link === 'string' &&
                a.link.trim() !== '',
        );
        for (const app of apps) {
            const id = toId(app.name, this.FORBIDDEN_CHARS);
            if (id && !this.appsById.has(id)) {
                this.appsById.set(id, app);
            }
        }

        const usedIds = new Set<string>();
        for (const config of devices) {
            let id = toId(config.name || config.host, this.FORBIDDEN_CHARS) || toId(config.host, this.FORBIDDEN_CHARS);
            for (let n = 2; usedIds.has(id); n++) {
                id = `${toId(config.name || config.host, this.FORBIDDEN_CHARS)}_${n}`;
            }
            usedIds.add(id);
            await this.createDeviceObjects(id, config);
            if (config.enabled === false) {
                continue;
            }
            this.devices.set(id, this.createRuntime(id, config));
        }
        await this.removeStaleObjects(usedIds);

        if (!devices.length) {
            this.log.warn('No devices configured - add your TV in the instance settings.');
        }

        this.subscribeStates('*');
        for (const device of this.devices.values()) {
            device.connection.start();
        }
    }

    /**
     * Loads the client certificate or creates and stores a new one.
     */
    private async ensureCertificate(): Promise<void> {
        const stored = { cert: this.config.clientCert, key: this.config.clientKey };
        if (isUsableCertificate(stored)) {
            this.certificate = stored;
            return;
        }
        this.log.info('Creating client certificate for pairing (one-time)');
        const clientName = this.config.clientName?.trim() || 'ioBroker';
        this.certificate = generateClientCertificate(clientName);
        // @KI_HINWEIS: Zertifikat sofort verwenden und dauerhaft in native ablegen (Schlüssel verschlüsselt,
        // encryptedNative). Der js-controller startet die Instanz wegen der native-Änderung einmal neu; das ist
        // gewollt und passiert nur beim ersten Start oder nach Ablauf (10 Jahre).
        await this.extendForeignObjectAsync(`system.adapter.${this.namespace}`, {
            native: { clientCert: this.certificate.cert, clientKey: this.encrypt(this.certificate.key) },
        });
    }

    private createRuntime(id: string, config: DeviceConfig): DeviceRuntime {
        if (!this.certificate) {
            throw new Error('Certificate missing');
        }
        const reconnectMax =
            Number(this.config.reconnectMax) > 0 ? Number(this.config.reconnectMax) : DEFAULT_RECONNECT_MAX_S;
        const connection = new RemoteConnection({
            host: config.host.trim(),
            certificate: this.certificate,
            enableIme: config.enableIme !== false,
            reconnectMaxMs: reconnectMax * 1000,
        });
        const runtime: DeviceRuntime = { id, config, connection, connected: false, muted: undefined };
        const label = `${config.name || id} (${config.host})`;

        connection.on('ready', (info, peerCert) => {
            runtime.connected = true;
            this.log.info(`${label}: connected`);
            void this.setDeviceStates(id, {
                'info.connected': true,
                'info.pairingRequired': false,
                'info.model': info.model ?? null,
                'info.manufacturer': info.vendor ?? null,
                'info.remoteServiceVersion': info.appVersion ?? null,
            });
            if (peerCert) {
                try {
                    const { mac } = parseTvIdentity(peerCert);
                    if (mac) {
                        void this.setStateChangedAsync(`${id}.info.mac`, mac, true);
                    }
                } catch (e) {
                    this.log.debug(`${label}: cannot parse TV certificate: ${(e as Error).message}`);
                }
            }
            void this.updateConnectionState();
        });
        connection.on('disconnected', reason => {
            runtime.connected = false;
            this.log.debug(`${label}: disconnected (${reason}), reconnecting`);
            void this.setStateChangedAsync(`${id}.info.connected`, false, true);
            void this.updateConnectionState();
        });
        connection.on('unpaired', () => {
            runtime.connected = false;
            this.log.warn(
                `${label}: the TV does not accept this ioBroker instance. Please pair it in the instance settings (tab "Pairing").`,
            );
            void this.setDeviceStates(id, { 'info.connected': false, 'info.pairingRequired': true });
            void this.updateConnectionState();
        });
        connection.on('power', on => void this.setStateChangedAsync(`${id}.power`, on, true));
        connection.on('currentApp', app => void this.setStateChangedAsync(`${id}.currentApp`, app, true));
        connection.on('volume', volume => {
            runtime.muted = volume.muted;
            void this.setDeviceStates(id, { volume: volume.level, volumeMax: volume.max, muted: volume.muted });
        });
        connection.on('log', (level, message) => this.log[level](message));
        return runtime;
    }

    private async setDeviceStates(id: string, values: Record<string, ioBroker.StateValue>): Promise<void> {
        for (const [key, val] of Object.entries(values)) {
            await this.setStateChangedAsync(`${id}.${key}`, val, true);
        }
    }

    private async updateConnectionState(): Promise<void> {
        const anyConnected = [...this.devices.values()].some(d => d.connected);
        await this.setStateChangedAsync('info.connection', anyConnected, true);
    }

    private async createDeviceObjects(id: string, config: DeviceConfig): Promise<void> {
        await this.extendObjectAsync(id, {
            type: 'device',
            common: {
                name: config.name || config.host,
                statusStates: { onlineId: `${this.namespace}.${id}.info.connected` },
            },
            native: { host: config.host },
        });
        await this.extendObjectAsync(`${id}.info`, {
            type: 'channel',
            common: { name: { en: 'Information', de: 'Informationen' } },
            native: {},
        });
        await this.extendObjectAsync(`${id}.keys`, {
            type: 'channel',
            common: { name: { en: 'Remote keys', de: 'Fernbedienungstasten' } },
            native: {},
        });
        await this.extendObjectAsync(`${id}.apps`, {
            type: 'channel',
            common: { name: { en: 'App favorites', de: 'App-Favoriten' } },
            native: {},
        });
        for (const def of DEVICE_STATES) {
            await this.extendObjectAsync(`${id}.${def.id}`, { type: 'state', common: def.common, native: {} });
        }
        for (const btn of KEY_BUTTONS) {
            await this.extendObjectAsync(`${id}.keys.${btn.id}`, {
                type: 'state',
                common: { name: btn.name, type: 'boolean', role: btn.role, read: false, write: true },
                native: { key: btn.key },
            });
        }
        for (const [appId, app] of this.appsById) {
            await this.extendObjectAsync(`${id}.apps.${appId}`, {
                type: 'state',
                common: { name: app.name, type: 'boolean', role: 'button', read: false, write: true },
                native: { link: app.link },
            });
        }
    }

    /**
     * Deletes devices and app buttons that are no longer configured.
     *
     * @param deviceIds - Ids of all configured devices
     */
    private async removeStaleObjects(deviceIds: Set<string>): Promise<void> {
        const prefix = `${this.namespace}.`;
        const devices = await this.getObjectViewAsync('system', 'device', {
            startkey: prefix,
            endkey: `${prefix}香`,
        });
        for (const row of devices.rows) {
            const id = row.id.slice(prefix.length);
            if (!deviceIds.has(id)) {
                this.log.info(`Removing objects of device "${id}" (no longer configured)`);
                await this.delObjectAsync(id, { recursive: true });
            }
        }
        for (const id of deviceIds) {
            const appPrefix = `${prefix}${id}.apps.`;
            const states = await this.getObjectViewAsync('system', 'state', {
                startkey: appPrefix,
                endkey: `${appPrefix}香`,
            });
            for (const row of states.rows) {
                if (!this.appsById.has(row.id.slice(appPrefix.length))) {
                    await this.delObjectAsync(row.id.slice(prefix.length));
                }
            }
        }
    }

    private onStateChange(fullId: string, state: ioBroker.State | null | undefined): void {
        if (!state || state.ack) {
            return;
        }
        const parts = fullId.slice(this.namespace.length + 1).split('.');
        const device = this.devices.get(parts[0]);
        if (!device) {
            return;
        }
        const command = parts.slice(1).join('.');
        try {
            this.handleCommand(device, command, state);
        } catch (e) {
            this.log.warn(`${device.config.name || device.id}: command "${command}" failed: ${(e as Error).message}`);
        }
    }

    /**
     * Executes a user command (ack=false) on a device.
     *
     * @param device - Target device
     * @param command - State id relative to the device
     * @param state - New state
     */
    private handleCommand(device: DeviceRuntime, command: string, state: ioBroker.State): void {
        const conn = device.connection;
        const ack = (): void => void this.setState(`${device.id}.${command}`, { val: state.val, ack: true });

        if (command.startsWith('keys.')) {
            const btn = KEY_BUTTONS.find(b => b.id === command.slice(5));
            if (btn) {
                conn.sendKey(btn.key);
                ack();
            }
            return;
        }
        if (command.startsWith('apps.')) {
            const app = this.appsById.get(command.slice(5));
            if (app) {
                conn.launchApp(app.link);
                ack();
            }
            return;
        }
        switch (command) {
            case 'power': {
                const wanted = !!state.val;
                // @KI_HINWEIS: Das Protokoll kennt nur die Umschalt-Taste POWER. Nur senden, wenn der vom TV
                // gemeldete Zustand abweicht; das ack setzt der TV selbst über die remote_start-Meldung.
                if (conn.isOn === wanted) {
                    ack();
                } else {
                    conn.sendKey('POWER');
                }
                return;
            }
            case 'muted':
                if (device.muted === !!state.val) {
                    ack();
                } else {
                    conn.sendKey('VOLUME_MUTE');
                }
                return;
            case 'launchApp':
                if (typeof state.val === 'string' && state.val.trim()) {
                    conn.launchApp(state.val);
                    ack();
                }
                return;
            case 'sendKey': {
                const key = state.val === null || state.val === undefined ? '' : String(state.val);
                if (resolveKeyCode(key) === undefined) {
                    throw new Error(`unknown key "${key}"`);
                }
                conn.sendKey(key);
                ack();
                return;
            }
            case 'sendText':
                if (typeof state.val === 'string' && state.val !== '') {
                    conn.sendText(state.val);
                    ack();
                }
                return;
            default:
                this.log.debug(`Ignoring write to read-only or unknown state ${device.id}.${command}`);
        }
    }

    private text(key: MessageKey): string {
        return MESSAGES[key][this.uiLanguage];
    }

    private reply(obj: ioBroker.Message, payload: { result: string } | { error: string }): void {
        if (obj.callback) {
            this.sendTo(obj.from, obj.command, payload, obj.callback);
        }
    }

    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj || typeof obj !== 'object') {
            return;
        }
        const msg = (obj.message ?? {}) as { host?: unknown; pin?: unknown };
        const host = typeof msg.host === 'string' ? msg.host.trim() : '';
        try {
            switch (obj.command) {
                case 'startPairing':
                    await this.startPairing(host);
                    this.reply(obj, { result: this.text('pairingStarted') });
                    break;
                case 'finishPairing':
                    await this.finishPairing(host, typeof msg.pin === 'string' ? msg.pin : '');
                    this.reply(obj, { result: this.text('pairingDone') });
                    break;
                default:
                    this.log.debug(`Unknown message command "${obj.command}"`);
            }
        } catch (e) {
            const key: MessageKey =
                e instanceof PairingError
                    ? e.code
                    : e instanceof Error && e.message in MESSAGES
                      ? (e.message as MessageKey)
                      : 'closed';
            this.log.warn(`Pairing with ${host || '?'} failed: ${(e as Error).message}`);
            this.reply(obj, { error: this.text(key) });
        }
    }

    private async startPairing(host: string): Promise<void> {
        if (!host) {
            throw new Error('noHost');
        }
        if (!this.certificate) {
            throw new Error('noCertificate');
        }
        this.dropPairing(host);
        const session = new PairingSession({
            host,
            clientName: this.config.clientName?.trim() || 'ioBroker',
            certificate: this.certificate,
        });
        const pending: PendingPairing = { session, timer: undefined };
        this.pairings.set(host, pending);
        try {
            await session.start();
        } catch (e) {
            this.dropPairing(host);
            throw e;
        }
        pending.timer = this.setTimeout(() => this.dropPairing(host), PAIRING_SESSION_TTL_MS);
    }

    private async finishPairing(host: string, pin: string): Promise<void> {
        if (!host) {
            throw new Error('noHost');
        }
        const pending = this.pairings.get(host);
        if (!pending?.session.isOpen) {
            this.dropPairing(host);
            throw new Error('noSession');
        }
        try {
            await pending.session.finish(pin);
        } catch (e) {
            // Wrong/mistyped code: the TV keeps the session open, the user may retry.
            if (!(e instanceof PairingError && (e.code === 'wrongPin' || e.code === 'invalidPin'))) {
                this.dropPairing(host);
            }
            throw e;
        }
        this.dropPairing(host);
        this.log.info(`Pairing with ${host} successful`);
        for (const device of this.devices.values()) {
            if (device.config.host.trim() === host) {
                await this.setStateChangedAsync(`${device.id}.info.pairingRequired`, false, true);
                device.connection.restart();
            }
        }
    }

    private dropPairing(host: string): void {
        const pending = this.pairings.get(host);
        if (pending) {
            this.clearTimeout(pending.timer);
            pending.session.close();
            this.pairings.delete(host);
        }
    }

    private onUnload(callback: () => void): void {
        try {
            for (const host of [...this.pairings.keys()]) {
                this.dropPairing(host);
            }
            for (const device of this.devices.values()) {
                device.connection.stop();
                device.connection.removeAllListeners();
            }
            this.devices.clear();
            callback();
        } catch (error) {
            this.log.error(`Error during unloading: ${(error as Error).message}`);
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Androidtv(options);
} else {
    // otherwise start the instance directly
    (() => new Androidtv())();
}
