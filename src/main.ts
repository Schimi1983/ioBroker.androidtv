/*
 * ioBroker.androidtv - control Android TV / Google TV devices (e.g. NVIDIA SHIELD) via the Android TV Remote
 * protocol v2 and optionally ADB (media information, app start by package, Fire TV).
 */
import * as utils from '@iobroker/adapter-core';
import { generateAdbKey, type AdbKey } from './lib/adb/auth';
import { DEFAULT_ADB_PORT } from './lib/adb/client';
import { AdbDevice } from './lib/adb/device';
import type { MediaInfo, PollResult } from './lib/adb/parsers';
import {
    generateClientCertificate,
    isUsableCertificate,
    parseTvIdentity,
    type ClientCertificate,
} from './lib/certificate';
import { PairingError, PairingSession } from './lib/pairing';
import { RemoteConnection, resolveKeyCode } from './lib/remote';
import { ADB_STATES, DEVICE_STATES, KEY_BUTTONS, type StateDefinition } from './lib/states';
import type { Timers } from './lib/timers';
import { sendWakeOnLan, wolTargets } from './lib/wol';

type DeviceConfig = ioBroker.AdapterConfig['devices'][number];
type AppConfig = ioBroker.AdapterConfig['apps'][number];
type ConnectionMode = 'remote' | 'remote_adb' | 'adb';

/** Runtime data of one configured TV. */
interface DeviceRuntime {
    id: string;
    config: DeviceConfig;
    mode: ConnectionMode;
    label: string;
    remote?: RemoteConnection;
    adb?: AdbDevice;
    remoteConnected: boolean;
    adbConnected: boolean;
    adbAuthPending: boolean;
    pairingRequired: boolean;
    muted: boolean | undefined;
    /** Pending ADB power command: contradicting poll results are ignored until it is reached or expires */
    powerTarget?: { value: boolean; until: number };
    /** Started when the primary connection is lost; resets power/media if the device stays away */
    offlineTimer?: ioBroker.Timeout;
    /** Wake-on-LAN was sent: switch on as soon as ADB is back (until this time) */
    wakePendingUntil?: number;
}

/** Answer for the admin `textSendTo` status line. */
interface StatusText {
    text: string;
    icon: string;
    style: { color: string };
}

/** Open pairing attempt (between "start" and "finish"). */
interface PendingPairing {
    session: PairingSession;
    timer: ioBroker.Timeout | undefined;
}

/** Pairing sessions are dropped after this time; the TV itself cancels after about a minute. */
const PAIRING_SESSION_TTL_MS = 120_000;
const DEFAULT_RECONNECT_MAX_S = 60;
const DEFAULT_ADB_POLL_S = 5;
const CERT_FILE = 'client-certificate.json';
const ADB_KEY_FILE = 'adb-key.json';
/** A device that stays unreachable this long is considered off (power=false, media idle). */
const OFFLINE_GRACE_MS = 30_000;

/** Texts returned to the admin UI (sendTo); German or English depending on system language. */
const MESSAGES = {
    pairingStarted: {
        en: 'The TV now shows a 6-character code. Enter it and click "Confirm code".',
        de: 'Der TV zeigt jetzt einen 6-stelligen Code. Code eingeben und „Code bestätigen“ klicken.',
    },
    pairingDone: {
        en: 'Pairing successful. The connection is being established.',
        de: 'Kopplung erfolgreich. Die Verbindung wird aufgebaut.',
    },
    pairingDoneSave: {
        en: 'Pairing successful. Save the settings to connect to this TV.',
        de: 'Kopplung erfolgreich. Einstellungen speichern, damit die Verbindung aufgebaut wird.',
    },
    statusConnected: { en: 'Connected', de: 'Verbunden' },
    statusPairing: {
        en: 'Pairing required – switch the device on and follow step 1',
        de: 'Kopplung erforderlich – Gerät einschalten und Schritt 1 ausführen',
    },
    statusOffline: {
        en: 'Not connected – device switched off, unplugged or unreachable',
        de: 'Nicht verbunden – Gerät aus, ohne Strom oder nicht erreichbar',
    },
    statusAdbPending: {
        en: 'Please confirm "Allow debugging" on the TV (tick "Always allow")',
        de: 'Bitte am Fernseher „Debugging zulassen“ bestätigen („Immer zulassen“ anhaken)',
    },
    statusAdbOffline: {
        en: 'Not connected – device switched off or debugging not enabled',
        de: 'Nicht verbunden – Gerät aus oder Debugging am Gerät nicht eingeschaltet',
    },
    statusAdbOk: {
        en: 'playback info active',
        de: 'Wiedergabe-Infos aktiv',
    },
    statusInfoOffline: {
        en: 'playback info not available (debugging switched on?)',
        de: 'Wiedergabe-Infos nicht verfügbar (Debugging eingeschaltet?)',
    },
    statusDisabled: { en: 'Disabled', de: 'Deaktiviert' },
    statusUnsaved: {
        en: 'Not saved yet – pairing already works, the connection starts after saving',
        de: 'Noch nicht gespeichert – Koppeln geht schon, die Verbindung startet nach dem Speichern',
    },
    statusNoHost: { en: 'Enter the IP address first', de: 'Zuerst die IP-Adresse eintragen' },
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
        en: 'The device cannot be reached for pairing. Check the IP address and that the device is switched on. For a Fire TV choose the device type "Amazon Fire TV" – it needs no pairing.',
        de: 'Das Gerät ist zum Koppeln nicht erreichbar. IP-Adresse prüfen und ob das Gerät eingeschaltet ist. Für einen Fire TV den Gerätetyp „Amazon Fire TV“ wählen – dort ist keine Kopplung nötig.',
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
    // @KI_HINWEIS: Strenger als FORBIDDEN_CHARS: nur A-Z, a-z, 0-9, _ und -, damit IDs wie "Disney+" in Skripten,
    // MQTT-Topics und Vis ohne Escaping nutzbar sind.
    const umlauts: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
    return text
        .trim()
        .replace(/[äöüÄÖÜß]/g, c => umlauts[c] ?? c)
        .replace(forbidden, '_')
        .replace(/[^A-Za-z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Normalizes the configured connection mode (configs of 0.0.1 have none).
 *
 * @param config - Device configuration
 */
function modeOf(config: DeviceConfig): ConnectionMode {
    return config.connection === 'adb' || config.connection === 'remote_adb' ? config.connection : 'remote';
}

/**
 * Whether a launch target is a URL/deep link (has a scheme) rather than a package name.
 *
 * @param target - Link or package name
 */
function isLink(target: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(target.trim());
}

class Androidtv extends utils.Adapter {
    /** Adapter timers for the protocol classes; cleared automatically on unload. */
    private readonly adapterTimers: Timers = {
        setTimeout: (callback, ms) => this.setTimeout(callback, ms),
        clearTimeout: handle => this.clearTimeout(handle as ioBroker.Timeout | undefined),
    };
    private readonly devices = new Map<string, DeviceRuntime>();
    private readonly appsById = new Map<string, AppConfig>();
    private readonly pairings = new Map<string, PendingPairing>();
    private certificate: ClientCertificate | undefined;
    private adbKey: AdbKey | undefined;
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
        if (devices.some(d => d.enabled !== false && modeOf(d) !== 'remote')) {
            await this.ensureAdbKey();
        }

        const usedIds = new Set<string>();
        for (const config of devices) {
            const base =
                toId(config.name || config.host, this.FORBIDDEN_CHARS) || toId(config.host, this.FORBIDDEN_CHARS);
            let id = base;
            for (let n = 2; usedIds.has(id); n++) {
                id = `${base}_${n}`;
            }
            usedIds.add(id);
            await this.createDeviceObjects(id, config);
            if (config.enabled === false) {
                continue;
            }
            const runtime = this.createRuntime(id, config);
            this.devices.set(id, runtime);
            await this.refreshStatus(runtime);
        }
        await this.removeStaleObjects(usedIds, devices);

        if (!devices.length) {
            this.log.warn('No devices configured - add your TV in the instance settings.');
        }

        this.subscribeStates('*');
        for (const device of this.devices.values()) {
            device.remote?.start();
            device.adb?.start();
            this.scheduleOffline(device); // device unreachable at start-up → stale power/media are reset
        }
    }

    // ------------------------------------------------------------------------------------------------------------
    // Keys and certificates (adapter file storage, private keys encrypted with the instance secret)
    // ------------------------------------------------------------------------------------------------------------

    /**
     * Loads the client certificate or creates and stores a new one.
     *
     * Storage: adapter file storage `<namespace>/client-certificate.json`, private key encrypted with the
     * instance secret. Older versions kept it in `native` – it is migrated once.
     */
    private async ensureCertificate(): Promise<void> {
        // @KI_HINWEIS: Nicht (mehr) in native: Eine vor dem ersten Start geöffnete Konfigurationsseite schreibt beim
        // Speichern leere Zertifikatsfelder zurück → neues Zertifikat → Kopplung am TV verloren (im Feldtest
        // beobachtet). Der Dateispeicher wird vom Admin-Speichern nicht berührt; außerdem entfällt der Neustart.
        const stored = await this.readSecretFile(CERT_FILE);
        if (typeof stored?.cert === 'string' && typeof stored.key === 'string') {
            const candidate = { cert: stored.cert, key: this.decrypt(stored.key) };
            if (isUsableCertificate(candidate)) {
                this.certificate = candidate;
                return;
            }
            this.log.warn('Stored client certificate is invalid or expired - creating a new one (pairing required)');
        }
        const fromNative = { cert: this.config.clientCert, key: this.config.clientKey };
        if (isUsableCertificate(fromNative)) {
            this.log.info('Moving client certificate from instance configuration to file storage');
            this.certificate = fromNative;
        } else {
            this.log.info('Creating client certificate for pairing (one-time)');
            this.certificate = generateClientCertificate(this.config.clientName?.trim() || 'ioBroker');
        }
        await this.writeSecretFile(CERT_FILE, { cert: this.certificate.cert, key: this.encrypt(this.certificate.key) });
    }

    /** Loads or creates the RSA key used for ADB authentication. */
    private async ensureAdbKey(): Promise<void> {
        const stored = await this.readSecretFile(ADB_KEY_FILE);
        if (typeof stored?.key === 'string') {
            try {
                const privateKey = this.decrypt(stored.key);
                if (privateKey.includes('PRIVATE KEY')) {
                    this.adbKey = { privateKey };
                    return;
                }
            } catch (e) {
                this.log.warn(`Cannot read stored ADB key: ${(e as Error).message}`);
            }
        }
        this.log.info('Creating ADB key (one-time) - confirm "Allow debugging" on the TV at the first connection');
        this.adbKey = generateAdbKey();
        await this.writeSecretFile(ADB_KEY_FILE, { key: this.encrypt(this.adbKey.privateKey) });
    }

    private async readSecretFile(name: string): Promise<Record<string, unknown> | undefined> {
        try {
            if (!(await this.fileExistsAsync(this.namespace, name))) {
                return undefined;
            }
            const file = await this.readFileAsync(this.namespace, name);
            const raw = typeof file.file === 'string' ? file.file : file.file.toString('utf8');
            const parsed: unknown = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
        } catch (e) {
            this.log.warn(`Cannot read ${name}: ${(e as Error).message}`);
            return undefined;
        }
    }

    private async writeSecretFile(name: string, content: Record<string, string>): Promise<void> {
        await this.setForeignObjectNotExistsAsync(this.namespace, {
            type: 'meta',
            common: { name: 'Android TV internal files', type: 'meta.user' },
            native: {},
        });
        await this.writeFileAsync(this.namespace, name, JSON.stringify(content));
    }

    // ------------------------------------------------------------------------------------------------------------
    // Device runtime
    // ------------------------------------------------------------------------------------------------------------

    private createRuntime(id: string, config: DeviceConfig): DeviceRuntime {
        const mode = modeOf(config);
        const reconnectMax =
            Number(this.config.reconnectMax) > 0 ? Number(this.config.reconnectMax) : DEFAULT_RECONNECT_MAX_S;
        const runtime: DeviceRuntime = {
            id,
            config,
            mode,
            label: `${config.name || id} (${config.host})`,
            remoteConnected: false,
            adbConnected: false,
            adbAuthPending: false,
            pairingRequired: false,
            muted: undefined,
        };
        if (mode !== 'adb') {
            if (!this.certificate) {
                throw new Error('Certificate missing');
            }
            runtime.remote = new RemoteConnection({
                timers: this.adapterTimers,
                host: config.host.trim(),
                certificate: this.certificate,
                enableIme: config.enableIme !== false,
                reconnectMaxMs: reconnectMax * 1000,
            });
            this.attachRemote(runtime, runtime.remote);
        }
        if (mode !== 'remote') {
            if (!this.adbKey) {
                throw new Error('ADB key missing');
            }
            const pollS =
                Number(this.config.adbPollInterval) >= 2 ? Number(this.config.adbPollInterval) : DEFAULT_ADB_POLL_S;
            const port = Number(config.adbPort) > 0 ? Number(config.adbPort) : DEFAULT_ADB_PORT;
            runtime.adb = new AdbDevice({
                timers: this.adapterTimers,
                host: config.host.trim(),
                port,
                key: this.adbKey,
                keyName: `ioBroker@${this.host ?? 'iobroker'}`,
                pollIntervalMs: pollS * 1000,
                reconnectMaxMs: reconnectMax * 1000,
                externalPower: () => (runtime.remoteConnected ? runtime.remote?.isOn : undefined),
            });
            this.attachAdb(runtime, runtime.adb);
        }
        return runtime;
    }

    private attachRemote(runtime: DeviceRuntime, remote: RemoteConnection): void {
        const { id, label } = runtime;
        remote.on('ready', (info, peerCert) => {
            runtime.remoteConnected = true;
            this.cancelOffline(runtime);
            runtime.pairingRequired = false;
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
                    // @KI_HINWEIS: Nur zur Info. Feldtest SHIELD: Die MAC im TV-Zertifikat ist die WLAN-MAC, auch
                    // wenn das Gerät per LAN hängt. Für Wake-on-LAN zählt nur die MAC aus der Konfiguration.
                    if (mac) {
                        void this.setStateChangedAsync(`${id}.info.mac`, mac, true);
                    }
                } catch (e) {
                    this.log.debug(`${label}: cannot parse TV certificate: ${(e as Error).message}`);
                }
            }
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
        });
        remote.on('disconnected', reason => {
            runtime.remoteConnected = false;
            this.scheduleOffline(runtime);
            this.log.debug(`${label}: disconnected (${reason}), reconnecting`);
            void this.setStateChangedAsync(`${id}.info.connected`, false, true);
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
        });
        remote.on('unpaired', () => {
            runtime.remoteConnected = false;
            runtime.pairingRequired = true;
            this.log.warn(
                `${label}: the TV does not accept this ioBroker instance. Please pair it in the instance settings (tab "Devices").`,
            );
            void this.setDeviceStates(id, { 'info.connected': false, 'info.pairingRequired': true });
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
        });
        remote.on('power', on => {
            void this.setStateChangedAsync(`${id}.power`, on, true);
            if (on) {
                runtime.adb?.pollSoon();
            } else if (runtime.adb) {
                void this.setMediaStates(id, null);
            }
        });
        remote.on('currentApp', app => {
            void this.setStateChangedAsync(`${id}.currentApp`, app, true);
            runtime.adb?.pollSoon();
        });
        remote.on('volume', volume => {
            runtime.muted = volume.muted;
            // @KI_HINWEIS: max = 0 meldet z. B. die SHIELD, wenn die Lautstärke per HDMI-CEC am TV/AVR geregelt wird
            // (Feldtest). Dann gibt es keinen eigenen Pegel → null statt einer irreführenden 0.
            const known = volume.max > 0;
            void this.setDeviceStates(id, {
                volume: known ? volume.level : null,
                volumeMax: known ? volume.max : null,
                muted: volume.muted,
            });
        });
        remote.on('log', (level, message) => this.log[level](message));
    }

    private attachAdb(runtime: DeviceRuntime, adb: AdbDevice): void {
        const { id, label } = runtime;
        const adbOnly = runtime.mode === 'adb';
        adb.on('ready', info => {
            runtime.adbConnected = true;
            if (adbOnly) {
                this.cancelOffline(runtime);
            }
            runtime.adbAuthPending = false;
            this.log.info(`${label}: ADB connected${info.model ? ` (${info.model})` : ''}`);
            const values: Record<string, ioBroker.StateValue> = {
                'info.adbConnected': true,
                'info.adbAuthorizationPending': false,
            };
            if (adbOnly) {
                values['info.connected'] = true;
                values['info.model'] = info.model ?? null;
                adb.getProp('ro.product.manufacturer')
                    .then(m => this.setStateChangedAsync(`${id}.info.manufacturer`, m ?? null, true))
                    .catch(e => this.log.debug(`${label}: cannot read manufacturer: ${(e as Error).message}`));
            }
            void this.setDeviceStates(id, values);
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
            // @KI_HINWEIS: Diagnose: Der Schlüssel der Wake-on-LAN-Einstellung ist herstellerabhängig (Fire-TV-
            // Fernseher verschiedener Hersteller). Erst die Schlüssel im Feld sammeln, bevor der Adapter sie setzt.
            adb.findWakeSettings()
                .then(found =>
                    this.log.debug(`${label}: wake settings: ${found.length ? found.join(' | ') : 'none found'}`),
                )
                .catch(() => undefined);
            if (runtime.wakePendingUntil && Date.now() < runtime.wakePendingUntil) {
                runtime.wakePendingUntil = undefined;
                runtime.powerTarget = { value: true, until: Date.now() + 5_000 };
                adb.setPower(true).catch(e =>
                    this.log.debug(`${label}: switching on after Wake-on-LAN failed: ${(e as Error).message}`),
                );
            }
        });
        adb.on('authPending', () => {
            runtime.adbAuthPending = true;
            this.log.warn(
                `${label}: confirm "Allow debugging" on the TV and tick "Always allow from this computer" (key ioBroker@${this.host ?? 'iobroker'})`,
            );
            void this.setStateChangedAsync(`${id}.info.adbAuthorizationPending`, true, true);
            void this.refreshStatus(runtime);
        });
        adb.on('disconnected', () => {
            runtime.adbConnected = false;
            if (adbOnly) {
                this.scheduleOffline(runtime);
            }
            this.log.debug(`${label}: ADB disconnected, reconnecting`);
            const values: Record<string, ioBroker.StateValue> = { 'info.adbConnected': false };
            if (adbOnly) {
                values['info.connected'] = false;
            }
            void this.setDeviceStates(id, values);
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
        });
        adb.on('poll', result => void this.applyPoll(runtime, result));
        adb.on('log', (level, message) => this.log[level](message));
    }

    /**
     * Writes the result of an ADB poll to the states.
     *
     * @param runtime - Device
     * @param result - Parsed poll output
     */
    private async applyPoll(runtime: DeviceRuntime, result: PollResult): Promise<void> {
        const { id } = runtime;
        if (runtime.mode === 'adb') {
            const target = runtime.powerTarget;
            // @KI_HINWEIS: Feldtest Fire TV: Eine kurz vor dem Befehl gestartete Abfrage meldete noch den alten
            // Zustand und bestätigte ihn (Flackern true→false). Bis zum Ziel bzw. 5 s danach widersprechende
            // Werte ignorieren.
            const contradicts = target !== undefined && Date.now() < target.until && result.awake !== target.value;
            if (target && (!contradicts || Date.now() >= target.until)) {
                runtime.powerTarget = undefined;
            }
            if (result.awake !== undefined && !contradicts) {
                await this.setStateChangedAsync(`${id}.power`, result.awake, true);
            }
            if (result.currentApp) {
                await this.setStateChangedAsync(`${id}.currentApp`, result.currentApp, true);
            }
        }
        if (result.awake === false) {
            await this.setMediaStates(id, null);
        } else if (result.media !== undefined) {
            await this.setMediaStates(id, result.media);
        }
    }

    /**
     * Starts the grace timer after the primary connection was lost. Short interruptions (e.g. the TV closes the
     * connection after a rejected command and is back after 2 s) do not touch power/media.
     *
     * @param runtime - Device
     */
    private scheduleOffline(runtime: DeviceRuntime): void {
        if (runtime.offlineTimer) {
            return;
        }
        runtime.offlineTimer = this.setTimeout(() => {
            runtime.offlineTimer = undefined;
            this.log.debug(`${runtime.label}: unreachable for ${OFFLINE_GRACE_MS / 1000} s - treating as off`);
            void this.setStateChangedAsync(`${runtime.id}.power`, false, true);
            if (runtime.adb) {
                void this.setMediaStates(runtime.id, null);
            }
        }, OFFLINE_GRACE_MS);
    }

    private cancelOffline(runtime: DeviceRuntime): void {
        if (runtime.offlineTimer) {
            this.clearTimeout(runtime.offlineTimer);
            runtime.offlineTimer = undefined;
        }
    }

    private async setMediaStates(id: string, media: MediaInfo | null): Promise<void> {
        await this.setDeviceStates(id, {
            'media.state': media?.state ?? 'idle',
            'media.title': media?.title ?? null,
            'media.subtitle': media?.subtitle ?? null,
            'media.app': media?.app ?? null,
            'media.position': media?.position ?? null,
        });
    }

    private async setDeviceStates(id: string, values: Record<string, ioBroker.StateValue>): Promise<void> {
        for (const [key, val] of Object.entries(values)) {
            await this.setStateChangedAsync(`${id}.${key}`, val, true);
        }
    }

    private async updateConnectionState(): Promise<void> {
        const anyConnected = [...this.devices.values()].some(d =>
            d.mode === 'adb' ? d.adbConnected : d.remoteConnected,
        );
        await this.setStateChangedAsync('info.connection', anyConnected, true);
    }

    // ------------------------------------------------------------------------------------------------------------
    // Objects
    // ------------------------------------------------------------------------------------------------------------

    /**
     * State definitions that apply to a device in its connection mode.
     *
     * @param config - Device configuration
     */
    private stateDefinitionsFor(config: DeviceConfig): StateDefinition[] {
        const mode = modeOf(config);
        const base = DEVICE_STATES.filter(d => mode !== 'adb' || !d.remoteOnly);
        return mode === 'remote' ? base : [...base, ...ADB_STATES];
    }

    private async createDeviceObjects(id: string, config: DeviceConfig): Promise<void> {
        const mode = modeOf(config);
        await this.extendObjectAsync(id, {
            type: 'device',
            common: {
                name: config.name || config.host,
                statusStates: { onlineId: `${this.namespace}.${id}.info.connected` },
            },
            native: { host: config.host, connection: mode },
        });
        const channels: [string, ioBroker.StringOrTranslated][] = [
            ['info', { en: 'Information', de: 'Informationen' }],
            ['keys', { en: 'Remote keys', de: 'Fernbedienungstasten' }],
            ['apps', { en: 'App favorites', de: 'App-Favoriten' }],
        ];
        if (mode !== 'remote') {
            channels.push(['media', { en: 'Media (via ADB)', de: 'Medien (über ADB)' }]);
        }
        for (const [channel, name] of channels) {
            await this.extendObjectAsync(`${id}.${channel}`, { type: 'channel', common: { name }, native: {} });
        }
        for (const def of this.stateDefinitionsFor(config)) {
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
     * Deletes devices, states and channels that no longer apply (device removed, app removed, mode changed).
     *
     * @param deviceIds - Ids of all configured devices
     * @param configs - Device configurations (same order as ids were assigned)
     */
    private async removeStaleObjects(deviceIds: Set<string>, configs: DeviceConfig[]): Promise<void> {
        const prefix = `${this.namespace}.`;
        const range = (start: string): { startkey: string; endkey: string } => ({
            startkey: start,
            endkey: `${start}香`,
        });
        const devices = await this.getObjectViewAsync('system', 'device', range(prefix));
        for (const row of devices.rows) {
            const id = row.id.slice(prefix.length);
            if (!deviceIds.has(id)) {
                this.log.info(`Removing objects of device "${id}" (no longer configured)`);
                await this.delObjectAsync(id, { recursive: true });
            }
        }
        const ids = [...deviceIds];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const config = configs[i];
            const expected = new Set<string>([
                ...this.stateDefinitionsFor(config).map(d => d.id),
                ...KEY_BUTTONS.map(b => `keys.${b.id}`),
                ...[...this.appsById.keys()].map(a => `apps.${a}`),
            ]);
            const devPrefix = `${prefix}${id}.`;
            const states = await this.getObjectViewAsync('system', 'state', range(devPrefix));
            for (const row of states.rows) {
                const rel = row.id.slice(devPrefix.length);
                if (!expected.has(rel)) {
                    await this.delObjectAsync(row.id.slice(prefix.length));
                }
            }
            if (modeOf(config) === 'remote') {
                const media = await this.getObjectAsync(`${id}.media`);
                if (media) {
                    await this.delObjectAsync(`${id}.media`);
                }
            }
        }
    }

    // ------------------------------------------------------------------------------------------------------------
    // Commands
    // ------------------------------------------------------------------------------------------------------------

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
        this.handleCommand(device, command, state).catch((e: Error) =>
            this.log.warn(`${device.config.name || device.id}: command "${command}" failed: ${e.message}`),
        );
    }

    /**
     * Executes a user command (ack=false) on a device, using Remote v2 where possible and ADB otherwise.
     *
     * @param device - Target device
     * @param command - State id relative to the device
     * @param state - New state
     */
    private async handleCommand(device: DeviceRuntime, command: string, state: ioBroker.State): Promise<void> {
        const ack = (): void => void this.setState(`${device.id}.${command}`, { val: state.val, ack: true });

        if (command.startsWith('keys.')) {
            const btn = KEY_BUTTONS.find(b => b.id === command.slice(5));
            if (btn) {
                await this.sendKey(device, btn.key);
                ack();
            }
            return;
        }
        if (command.startsWith('apps.')) {
            const app = this.appsById.get(command.slice(5));
            if (app) {
                await this.launch(device, app.link);
                ack();
            }
            return;
        }
        switch (command) {
            case 'power':
                await this.setPower(device, !!state.val, ack);
                return;
            case 'muted':
                if (device.muted === !!state.val) {
                    ack();
                } else {
                    await this.sendKey(device, 'VOLUME_MUTE');
                    if (!device.remote?.isReady) {
                        ack(); // ADB has no mute feedback
                    }
                }
                return;
            case 'launchApp':
                if (typeof state.val === 'string' && state.val.trim()) {
                    await this.launch(device, state.val);
                    ack();
                }
                return;
            case 'sendKey': {
                const key = state.val === null || state.val === undefined ? '' : String(state.val);
                if (resolveKeyCode(key) === undefined) {
                    throw new Error(`unknown key "${key}"`);
                }
                await this.sendKey(device, key);
                ack();
                return;
            }
            case 'sendText':
                if (typeof state.val === 'string' && state.val !== '') {
                    if (device.remote?.isReady && device.config.enableIme !== false) {
                        device.remote.sendText(state.val);
                    } else if (device.adb?.isReady) {
                        await device.adb.sendText(state.val);
                    } else {
                        throw new Error('not connected');
                    }
                    ack();
                }
                return;
            default:
                this.log.debug(`Ignoring write to read-only or unknown state ${device.id}.${command}`);
        }
    }

    private async sendKey(device: DeviceRuntime, key: string): Promise<void> {
        if (device.remote?.isReady) {
            device.remote.sendKey(key);
            device.adb?.pollSoon(); // playback info reflects play/pause about 1 s later instead of up to one interval
        } else if (device.adb?.isReady) {
            await device.adb.sendKey(key);
        } else {
            throw new Error('not connected');
        }
    }

    /**
     * Starts an app: https deep links preferably via Remote v2, package names preferably via ADB.
     *
     * @param device - Target device
     * @param target - Deep link or package name
     */
    private async launch(device: DeviceRuntime, target: string): Promise<void> {
        // @KI_HINWEIS: Feldtest SHIELD: Remote v2 akzeptiert nur http(s)-Links, Paketnamen nur per ADB (monkey).
        const preferAdb = !isLink(target);
        if (preferAdb && device.adb?.isReady) {
            await device.adb.launch(target);
        } else if (device.remote?.isReady) {
            device.remote.launchApp(target);
            device.adb?.pollSoon();
        } else if (device.adb?.isReady) {
            await device.adb.launch(target);
        } else {
            throw new Error('not connected');
        }
    }

    /**
     * Switches the device on/off. Remote v2 only knows the POWER toggle, ADB has idempotent WAKEUP/SLEEP.
     * The ack is set by the state feedback of the device (remote_start or ADB poll).
     *
     * @param device - Target device
     * @param wanted - Desired state
     * @param ack - Acknowledges the command immediately
     */
    private async setPower(device: DeviceRuntime, wanted: boolean, ack: () => void): Promise<void> {
        if (device.remote?.isReady) {
            // @KI_HINWEIS: Nur senden, wenn der vom TV gemeldete Zustand abweicht (Toggle-Taste).
            if (device.remote.isOn === wanted) {
                ack();
            } else {
                device.remote.sendKey('POWER');
            }
        } else if (device.adb?.isReady) {
            device.powerTarget = { value: wanted, until: Date.now() + 5_000 };
            await device.adb.setPower(wanted);
        } else if (wanted) {
            await this.wakeOnLan(device);
        } else {
            throw new Error('not connected');
        }
    }

    /**
     * Wakes an unreachable device (deep standby without network) with a magic packet and reconnects right away.
     *
     * @param device - Device
     */
    private async wakeOnLan(device: DeviceRuntime): Promise<void> {
        // @KI_HINWEIS: Feldtest Fire TV: Im tiefen Energiesparmodus schaltet das Gerät das Netzwerk ab, ADB und
        // Remote sind nicht erreichbar. Viele Geräte reagieren dann noch auf Wake-on-LAN (am Gerät einschalten).
        // @KI_HINWEIS: Die MAC lässt sich über ADB nicht zuverlässig lesen (Fire TV/SHIELD: /sys gesperrt, ip link
        // leer) und das TV-Zertifikat enthält ggf. die WLAN-MAC. Deshalb nur die MAC aus der Konfiguration.
        const mac = device.config.wolMac?.trim();
        if (!mac) {
            throw new Error(
                'not connected. To switch it on from deep standby, enter its MAC address in the instance settings (Wake-on-LAN)',
            );
        }
        const targets = wolTargets(device.config.host.trim(), device.config.wolBroadcast);
        const sent = await sendWakeOnLan(mac, targets);
        if (!sent) {
            throw new Error(`Wake-on-LAN could not be sent (${targets.join(', ')})`);
        }
        this.log.info(`${device.label}: not reachable, sent Wake-on-LAN to ${mac}`);
        device.wakePendingUntil = Date.now() + 90_000;
        device.remote?.reconnectNow();
        device.adb?.reconnectNow();
    }

    // ------------------------------------------------------------------------------------------------------------
    // Admin messages (pairing, status)
    // ------------------------------------------------------------------------------------------------------------

    private text(key: MessageKey): string {
        return MESSAGES[key][this.uiLanguage];
    }

    private reply(obj: ioBroker.Message, payload: { result: string } | { error: string } | StatusText): void {
        if (obj.callback) {
            this.sendTo(obj.from, obj.command, payload, obj.callback);
        }
    }

    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj || typeof obj !== 'object') {
            return;
        }
        const msg = (obj.message ?? {}) as { host?: unknown; pin?: unknown; enabled?: unknown };
        const host = typeof msg.host === 'string' ? msg.host.trim() : '';
        try {
            switch (obj.command) {
                case 'startPairing':
                    await this.startPairing(host);
                    this.reply(obj, { result: this.text('pairingStarted') });
                    break;
                case 'finishPairing': {
                    const configured = await this.finishPairing(host, typeof msg.pin === 'string' ? msg.pin : '');
                    this.reply(obj, { result: this.text(configured ? 'pairingDone' : 'pairingDoneSave') });
                    break;
                }
                case 'deviceStatus':
                    this.reply(obj, this.deviceStatus(host, msg.enabled !== false));
                    return;
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

    /**
     * Status line for one device in the admin UI (`textSendTo`).
     *
     * @param host - Host as currently entered in the form (may be unsaved)
     * @param enabled - Checkbox value in the form
     */
    private deviceStatus(host: string, enabled: boolean): StatusText {
        const grey = { color: '#888888' };
        if (!host) {
            return { text: this.text('statusNoHost'), icon: 'connection', style: grey };
        }
        if (!enabled) {
            return { text: this.text('statusDisabled'), icon: 'no-connection', style: grey };
        }
        const device = [...this.devices.values()].find(d => d.config.host.trim() === host);
        if (!device) {
            return { text: this.text('statusUnsaved'), icon: 'pair', style: grey };
        }
        return this.statusOf(device);
    }

    /**
     * Current status of a running device (admin status line and state `info.status`).
     *
     * @param device - Device runtime
     */
    private statusOf(device: DeviceRuntime): StatusText {
        const green = { color: '#2e7d32' };
        const orange = { color: '#ed6c02' };
        const red = { color: '#d32f2f' };
        const adbPart = (): { key: MessageKey; style: { color: string } } =>
            device.adbConnected
                ? { key: 'statusAdbOk', style: green }
                : device.adbAuthPending
                  ? { key: 'statusAdbPending', style: orange }
                  : { key: device.mode === 'adb' ? 'statusAdbOffline' : 'statusInfoOffline', style: red };
        if (device.mode === 'adb') {
            const a = adbPart();
            return {
                text: this.text(a.key === 'statusAdbOk' ? 'statusConnected' : a.key),
                icon: device.adbConnected ? 'connection' : 'no-connection',
                style: a.style,
            };
        }
        let main: StatusText;
        if (device.remoteConnected) {
            main = { text: this.text('statusConnected'), icon: 'connection', style: green };
        } else if (device.pairingRequired) {
            main = { text: this.text('statusPairing'), icon: 'pair', style: orange };
        } else {
            main = { text: this.text('statusOffline'), icon: 'no-connection', style: red };
        }
        if (device.mode === 'remote_adb') {
            const a = adbPart();
            main.text = `${main.text} · ${this.text(a.key)}`;
            if (main.style === green && a.style !== green) {
                main.style = a.style;
            }
        }
        return main;
    }

    /**
     * Writes the human readable status to `<device>.info.status` (shown live in the admin UI).
     *
     * @param device - Device runtime
     */
    private async refreshStatus(device: DeviceRuntime): Promise<void> {
        await this.setStateChangedAsync(`${device.id}.info.status`, this.statusOf(device).text, true);
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
            timers: this.adapterTimers,
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

    /**
     * Completes pairing and reconnects matching devices.
     *
     * @param host - TV address
     * @param pin - Code shown on the TV
     * @returns true if a running device uses this host
     */
    private async finishPairing(host: string, pin: string): Promise<boolean> {
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
        let configured = false;
        for (const device of this.devices.values()) {
            if (device.config.host.trim() === host && device.remote) {
                configured = true;
                device.pairingRequired = false;
                await this.setStateChangedAsync(`${device.id}.info.pairingRequired`, false, true);
                device.remote.restart();
            }
        }
        return configured;
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
                device.remote?.stop();
                device.remote?.removeAllListeners();
                device.adb?.stop();
                device.adb?.removeAllListeners();
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
