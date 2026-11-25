/*
 * Device Manager integration (@iobroker/dm-utils): shows the configured TVs as cards in the admin
 * "Devices"/device-manager view with status, quick controls and actions.
 *
 * @KI_HINWEIS: Prototyp (Branch feature/device-manager). Die Geräteliste in native.devices bleibt die einzige
 * Datenquelle; Änderungen hier schreiben native.devices per updateConfig() → Instanz startet neu.
 */
import {
    DeviceManagement,
    type ActionContext,
    type DeviceDetails,
    type DeviceInfo,
    type DeviceLoadContext,
    type DeviceRefreshResponse,
    type InstanceDetails,
    type JsonFormData,
    type JsonFormSchema,
} from '@iobroker/dm-utils';
import type { AdapterInstance } from '@iobroker/adapter-core';
import { DM_TEXTS as T } from './dm-texts';
import {
    ANDROID_TV_REMOTE_SERVICE,
    deduplicateAndroidTvs,
    excludeConfiguredAndroidTvs,
    getDiscoveredDeviceHost,
    type DiscoveredAndroidTv,
} from './discovery';

type DeviceConfig = ioBroker.AdapterConfig['devices'][number];
type ConnectionMode = 'remote' | 'remote_adb' | 'adb';
type DeviceControlList = NonNullable<DeviceInfo<string>['controls']>;
type DeviceActionList = NonNullable<DeviceInfo<string>['actions']>;

/** One configured device as seen by the Device Manager. */
export interface DmDeviceEntry {
    /** Object id of the device (`androidtv.0.<id>`), also used as Device Manager id */
    id: string;
    /** Index in `native.devices` (needed to change or remove the entry) */
    index: number;
    /** Row of `native.devices` */
    config: DeviceConfig;
    /** Normalized connection mode */
    mode: ConnectionMode;
    /** true if the device is enabled and has a runtime in this instance */
    running: boolean;
}

/**
 * Functions of the adapter used by the Device Manager.
 * Kept as an interface so the adapter keeps its pairing/connection logic private.
 */
export interface DmBridge {
    /** Resolves when onReady has created all devices (the admin may ask earlier after a restart). */
    ready: Promise<void>;
    /** All configured devices (also disabled ones). */
    devices(): DmDeviceEntry[];
    /** Human readable status (system language), undefined if the device is not running. */
    statusText(id: string): string | undefined;
    /** Starts pairing; the TV shows a code. */
    startPairing(host: string): Promise<void>;
    /** Completes pairing; returns the success text. */
    finishPairing(host: string, pin: string): Promise<string>;
    /** Aborts an open pairing attempt. */
    cancelPairing(host: string): void;
    /** true if the user may simply enter the code again (typo). */
    isRetryablePairingError(e: unknown): boolean;
    /** Error text (system language) for an exception of pairing or a command. */
    errorText(e: unknown): string;
    /** Rebuilds the connections of a running device; false if not running. */
    reconnect(id: string): boolean;
    /** Copy of `native.devices` as stored (including rows without host). */
    rawDevices(): DeviceConfig[];
    /** Stores `native.devices`; the instance restarts shortly afterwards. */
    saveDevices(devices: DeviceConfig[]): void;
    /** Runs one bounded mDNS scan on the local network. */
    discover(): Promise<DiscoveredAndroidTv[]>;
}

const MAC_PATTERN = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const PAIRING_ATTEMPTS = 3;

/** Relative state ids of the quick controls (written by buttons/switches, read for the displayed value). */
const CONTROL_STATES: Record<string, string> = {
    power: 'power',
    muted: 'muted',
    volumeDown: 'keys.volumeDown',
    volumeUp: 'keys.volumeUp',
    playPause: 'keys.playPause',
    home: 'keys.home',
};

/**
 * Device Manager for ioBroker.androidtv.
 */
export class AndroidTvDeviceManagement extends DeviceManagement<AdapterInstance> {
    private readonly bridge: DmBridge;

    /**
     * @param adapter - Adapter instance
     * @param bridge - Access to the device logic of the adapter
     */
    public constructor(adapter: AdapterInstance, bridge: DmBridge) {
        super(adapter);
        this.bridge = bridge;
    }

    protected override getInstanceInfo(): InstanceDetails {
        return {
            apiVersion: 'v3',
            identifierLabel: T.host,
            actions: [
                {
                    id: 'add',
                    icon: 'add',
                    title: T.addDevice,
                    handler: (context): Promise<{ refresh: boolean }> => this.addDevice(context),
                },
                {
                    id: 'discover',
                    icon: 'search',
                    title: T.discover,
                    handler: (context): Promise<{ refresh: boolean }> => this.discoverDevices(context),
                },
            ],
        };
    }

    protected async loadDevices(context: DeviceLoadContext<string>): Promise<void> {
        await this.bridge.ready;
        const entries = this.bridge.devices();
        context.setTotalDevices(entries.length);
        for (const entry of entries) {
            context.addDevice(this.deviceInfo(entry));
        }
    }

    protected override async getDeviceDetails(id: string): Promise<DeviceDetails<string> | { error: string }> {
        const entry = this.find(id);
        if (!entry) {
            return { error: `unknown device ${id}` };
        }
        const status = this.bridge.statusText(id);
        const value = async (rel: string): Promise<string> => {
            const state = await this.adapter.getStateAsync(`${id}.${rel}`);
            return state?.val !== null && state?.val !== undefined && state.val !== '' ? String(state.val) : '–';
        };
        const schema: JsonFormSchema = {
            type: 'panel',
            items: {
                status: { type: 'staticInfo', label: T.status, data: status ?? T.notRunning, sm: 12 },
                host: { type: 'staticInfo', label: T.host, data: entry.config.host, sm: 12 },
                type: { type: 'staticInfo', label: T.deviceType, data: T[connectionKey(entry.mode)], sm: 12 },
                mac: { type: 'staticInfo', label: T.mac, data: entry.config.wolMac?.trim() || '–', sm: 12 },
                app: { type: 'staticInfo', label: T.currentApp, data: await value('currentAppName'), sm: 12 },
                ...(entry.mode !== 'remote'
                    ? { title: { type: 'staticInfo', label: T.title, data: await value('media.title'), sm: 12 } }
                    : {}),
            },
        };
        return { id, schema };
    }

    // --------------------------------------------------------------------------------------------------------
    // Card
    // --------------------------------------------------------------------------------------------------------

    private deviceInfo(entry: DmDeviceEntry): DeviceInfo<string> {
        const base = `${this.adapter.namespace}.${entry.id}`;
        const enabled = entry.config.enabled !== false;
        // @KI_HINWEIS: Deaktiviert = kein rotes "getrennt"-Symbol (Feldtest: wirkte wie ein Fehler);
        // ausgegraute Karte + Schalter zeigen den Zustand bereits.
        const notRunningStatus = enabled ? ('disconnected' as const) : undefined;
        return {
            id: entry.id,
            identifier: entry.config.host,
            name: entry.config.name || entry.config.host,
            manufacturer: { stateId: `${base}.info.manufacturer` },
            model: { stateId: `${base}.info.model` },
            connectionType: 'lan',
            enabled,
            status: entry.running
                ? {
                      connection: {
                          stateId: `${base}.info.connected`,
                          mapping: { true: 'connected', false: 'disconnected' },
                      },
                      ...(entry.mode !== 'adb'
                          ? {
                                warning: {
                                    stateId: `${base}.info.pairingRequired`,
                                    mapping: { true: T.pairingRequired, false: false },
                                },
                            }
                          : {}),
                  }
                : notRunningStatus,
            actions: this.deviceActions(entry, enabled),
            controls: entry.running ? this.deviceControls(entry, base) : undefined,
            customInfo: entry.running ? this.cardInfo(entry, base) : undefined,
            hasDetails: true,
        };
    }

    /**
     * Live value shown directly on the card: what is running (readable app name).
     *
     * @param entry - Device
     * @param base - Full object id of the device
     */
    private cardInfo(entry: DmDeviceEntry, base: string): DeviceDetails<string> {
        // @KI_HINWEIS: Nur die App-Zeile: media.title ist meist null und die Oberfläche zeigt dann wörtlich "null".
        // Der Titel steht im Detail-Dialog (⋮).
        const schema: JsonFormSchema = {
            type: 'panel',
            items: {
                app: {
                    type: 'state',
                    oid: `${base}.currentAppName`,
                    foreign: true,
                    label: T.currentApp,
                    control: 'text',
                    sm: 12,
                },
            },
        };
        return { id: entry.id, schema };
    }

    private deviceActions(entry: DmDeviceEntry, enabled: boolean): DeviceActionList {
        const actions: DeviceActionList = [
            {
                // reserved id: click on the status icon
                id: 'status',
                description: T.status,
                handler: async (id, context) => {
                    await context.showMessage(this.bridge.statusText(id) ?? T.notRunning);
                    return { refresh: 'none' };
                },
            },
            {
                // reserved id: switch "enabled" on the card (without this id the switch is read-only)
                id: 'enable/disable',
                handler: id => this.changeDevice(id, cfg => ({ ...cfg, enabled: !enabled })),
            },
        ];
        if (entry.mode !== 'adb') {
            actions.push({
                id: 'pair',
                icon: 'pairDevice',
                description: T.pair,
                handler: (id, context) => this.pair(id, context),
            });
        }
        actions.push(
            {
                id: 'reconnect',
                icon: 'refresh',
                description: T.reconnect,
                handler: async (id, context) => {
                    if (!this.bridge.reconnect(id)) {
                        await context.showMessage(T.notRunning);
                    }
                    return { refresh: 'none' };
                },
            },
            {
                id: 'settings',
                icon: 'settings',
                description: T.settings,
                handler: (id, context) => this.editDevice(id, context),
            },
            {
                id: 'remove',
                icon: 'delete',
                description: T.remove,
                confirmation: T.confirmRemove,
                handler: (id): DeviceRefreshResponse<string> => {
                    const entryNow = this.find(id);
                    if (entryNow) {
                        const devices = this.bridge.rawDevices();
                        devices.splice(entryNow.index, 1);
                        this.bridge.saveDevices(devices);
                    }
                    return { delete: id };
                },
            },
        );
        return actions;
    }

    private deviceControls(entry: DmDeviceEntry, base: string): DeviceControlList {
        const write = async (
            deviceId: string,
            controlId: string,
            value: ioBroker.StateValue,
        ): Promise<ioBroker.State> => {
            const rel = CONTROL_STATES[controlId];
            if (!rel) {
                throw new Error(`unknown control ${controlId}`);
            }
            await this.adapter.setStateAsync(`${deviceId}.${rel}`, value, false);
            const now = Date.now();
            return { val: value, ack: false, ts: now, lc: now, from: `system.adapter.${this.adapter.namespace}`, q: 0 };
        };
        // @KI_HINWEIS: Die Admin-Oberfläche fragt den Anzeigewert über getStateHandler ab (dm:deviceControlState),
        // stateId allein reicht nicht – ohne Handler bleiben Schalter/Infos leer und es kommt eine Warnung.
        const read = async (deviceId: string, controlId: string): Promise<ioBroker.State> => {
            const rel = CONTROL_STATES[controlId];
            const state = rel ? await this.adapter.getStateAsync(`${deviceId}.${rel}`) : null;
            const now = Date.now();
            return (
                state ?? {
                    val: null,
                    ack: true,
                    ts: now,
                    lc: now,
                    from: `system.adapter.${this.adapter.namespace}`,
                    q: 0,
                }
            );
        };
        const button = (id: string, label: ioBroker.StringOrTranslated): DeviceControlList[number] => ({
            id,
            type: 'button',
            label,
            handler: (deviceId, controlId) => write(deviceId, controlId, true),
        });

        const controls: DeviceControlList = [
            {
                id: 'power',
                type: 'switch',
                label: T.power,
                stateId: `${base}.power`,
                handler: (deviceId, controlId, state) => write(deviceId, controlId, !!state),
                getStateHandler: read,
            },
        ];
        if (entry.mode !== 'adb') {
            controls.push({
                id: 'muted',
                type: 'switch',
                label: T.mute,
                stateId: `${base}.muted`,
                handler: (deviceId, controlId, state) => write(deviceId, controlId, !!state),
                getStateHandler: read,
            });
        }
        controls.push(
            button('volumeDown', T.volumeDown),
            button('volumeUp', T.volumeUp),
            button('playPause', T.playPause),
            button('home', T.home),
        );
        return controls;
    }

    // --------------------------------------------------------------------------------------------------------
    // Actions
    // --------------------------------------------------------------------------------------------------------

    /**
     * Pairing dialog: start → TV shows code → enter code (up to 3 attempts on typos).
     *
     * @param id - Device id
     * @param context - Dialog helpers
     */
    private async pair(id: string, context: ActionContext): Promise<DeviceRefreshResponse<string>> {
        const entry = this.find(id);
        if (!entry?.running) {
            await context.showMessage(T.notRunning);
            return { refresh: 'none' };
        }
        const host = entry.config.host.trim();
        const progress = await context.openProgress(T.pair, { indeterminate: true, label: T.pairStarting });
        try {
            await this.bridge.startPairing(host);
        } catch (e) {
            await progress.close();
            await context.showMessage(this.bridge.errorText(e));
            return { refresh: 'none' };
        }
        await progress.close();

        const schema: JsonFormSchema = {
            type: 'panel',
            items: { pin: { type: 'text', label: T.pinLabel, maxLength: 6, sm: 12 } },
        };
        for (let attempt = 1; attempt <= PAIRING_ATTEMPTS; attempt++) {
            const data = await context.showForm(schema, { title: T.pair });
            if (!data) {
                this.bridge.cancelPairing(host);
                return { refresh: 'none' };
            }
            try {
                const done = await this.bridge.finishPairing(host, typeof data.pin === 'string' ? data.pin : '');
                await context.showMessage(done);
                return { refresh: 'devices' };
            } catch (e) {
                await context.showMessage(this.bridge.errorText(e));
                if (!this.bridge.isRetryablePairingError(e)) {
                    return { refresh: 'none' };
                }
            }
        }
        this.bridge.cancelPairing(host);
        return { refresh: 'none' };
    }

    private async discoverDevices(context: ActionContext): Promise<{ refresh: boolean }> {
        const progress = await context.openProgress(T.discover, {
            indeterminate: true,
            label: T.discovering,
        });
        let found: DiscoveredAndroidTv[];
        try {
            found = await this.bridge.discover();
        } catch (error) {
            await progress.close();
            await context.showMessage(this.bridge.errorText(error));
            return { refresh: false };
        }
        await progress.close();

        const unique = deduplicateAndroidTvs(found);
        const configuredHosts = this.bridge
            .rawDevices()
            .map(device => (typeof device?.host === 'string' ? device.host : ''))
            .filter(Boolean);
        const notConfigured = excludeConfiguredAndroidTvs(unique, configuredHosts);
        const candidates = notConfigured
            .map(device => {
                const host = getDiscoveredDeviceHost(device);
                return host ? { device, host, name: discoveredDeviceName(device) } : undefined;
            })
            .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined);

        if (!candidates.length) {
            await context.showMessage(
                !unique.length ? T.noDevicesFound : !notConfigured.length ? T.noNewDevices : T.noUsableDevices,
            );
            return { refresh: false };
        }

        const selection = await context.showForm(
            {
                type: 'panel',
                items: {
                    device: {
                        type: 'select',
                        label: T.foundDevices,
                        options: candidates.map((candidate, index) => ({
                            label: [
                                `${candidate.name} (${candidate.host})`,
                                safeDisplayText(candidate.device.manufacturer),
                                safeDisplayText(candidate.device.model),
                                candidate.device.port ? `TCP ${candidate.device.port}` : undefined,
                            ]
                                .filter(Boolean)
                                .join(' · '),
                            value: String(index),
                        })),
                        sm: 12,
                    },
                },
            },
            { title: T.discover },
        );
        if (!selection || (typeof selection.device !== 'string' && typeof selection.device !== 'number')) {
            return { refresh: false };
        }
        const index = Number(selection.device);
        const candidate = Number.isInteger(index) && index >= 0 ? candidates[index] : undefined;
        if (!candidate) {
            return { refresh: false };
        }

        const data = await this.askSettings(context, T.addDevice, {
            name: candidate.name,
            host: candidate.host,
            enabled: true,
            connection: 'remote',
            enableIme: true,
            remotePort: candidate.device.port ?? 6466,
            adbPort: 5555,
            wolMac: '',
            wolBroadcast: '',
        });
        if (data) {
            const devices = this.bridge.rawDevices();
            devices.push(data);
            await context.showMessage(T.saved);
            this.bridge.saveDevices(devices);
        }
        return { refresh: false };
    }

    private async addDevice(context: ActionContext): Promise<{ refresh: boolean }> {
        const data = await this.askSettings(context, T.addDevice, {
            name: 'Android TV',
            host: '',
            enabled: true,
            connection: 'remote',
            enableIme: true,
            remotePort: 6466,
            adbPort: 5555,
            wolMac: '',
            wolBroadcast: '',
        });
        if (data) {
            const devices = this.bridge.rawDevices();
            devices.push(data);
            // @KI_HINWEIS: Erst nach dem OK speichern – sonst startet die Instanz, während der Dialog noch offen ist
            // (Warnung "Unknown message origin" in der neuen Instanz).
            await context.showMessage(T.saved);
            this.bridge.saveDevices(devices);
        }
        return { refresh: false };
    }

    private async editDevice(id: string, context: ActionContext): Promise<DeviceRefreshResponse<string>> {
        const entry = this.find(id);
        if (!entry) {
            return { refresh: 'devices' };
        }
        const data = await this.askSettings(context, T.settings, { ...entry.config }, entry.index);
        if (data) {
            const devices = this.bridge.rawDevices();
            devices[entry.index] = { ...devices[entry.index], ...data };
            await context.showMessage(T.saved);
            this.bridge.saveDevices(devices);
        }
        return { refresh: 'none' };
    }

    /**
     * Applies a change to one configuration row and stores it.
     *
     * @param id - Device id
     * @param change - Returns the new row
     */
    private changeDevice(id: string, change: (cfg: DeviceConfig) => DeviceConfig): DeviceRefreshResponse<string> {
        const entry = this.find(id);
        if (entry) {
            const devices = this.bridge.rawDevices();
            devices[entry.index] = change(devices[entry.index]);
            this.bridge.saveDevices(devices);
        }
        return { refresh: 'none' };
    }

    /**
     * Settings form (same fields as the table in the instance settings), validated in code.
     *
     * @param context - Dialog helpers
     * @param title - Dialog title
     * @param initial - Start values
     * @param ownIndex - Row being edited (excluded from the duplicate check)
     * @returns the validated row or undefined on cancel
     */
    private async askSettings(
        context: ActionContext,
        title: ioBroker.StringOrTranslated,
        initial: DeviceConfig,
        ownIndex = -1,
    ): Promise<DeviceConfig | undefined> {
        const schema: JsonFormSchema = {
            type: 'panel',
            items: {
                // @KI_HINWEIS: Validatoren direkt im Dialog (Idee aus PR #11, Voodoo2man); validate() prüft zusätzlich im Code.
                name: {
                    type: 'text',
                    label: T.name,
                    validator: 'data.name && data.name.trim().length > 0',
                    validatorNoSaveOnError: true,
                    sm: 12,
                },
                host: {
                    type: 'text',
                    label: T.host,
                    help: T.hostHelp,
                    validator: 'data.host && data.host.trim().length > 0',
                    validatorNoSaveOnError: true,
                    sm: 12,
                },
                connection: {
                    type: 'select',
                    label: T.deviceType,
                    help: T.connectionHelp,
                    options: [
                        { label: T.connRemote, value: 'remote' },
                        { label: T.connRemoteAdb, value: 'remote_adb' },
                        { label: T.connAdb, value: 'adb' },
                    ],
                    sm: 12,
                },
                enabled: { type: 'checkbox', label: T.enabled, sm: 12 },
                wolMac: {
                    type: 'text',
                    label: T.mac,
                    help: T.macHelp,
                    validator: '!data.wolMac || /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(data.wolMac.trim())',
                    validatorNoSaveOnError: true,
                    sm: 12,
                },
                // @KI_HINWEIS: Broadcast nur zeigen, wenn eine MAC eingetragen ist – ohne MAC kein Wake-on-LAN.
                wolBroadcast: {
                    type: 'text',
                    label: T.broadcast,
                    help: T.broadcastHelp,
                    hidden: '!data.wolMac',
                    sm: 12,
                },
                enableIme: { type: 'checkbox', label: T.ime, hidden: "data.connection === 'adb'", sm: 12 },
                remotePort: {
                    type: 'number',
                    label: T.remotePort,
                    min: 1,
                    max: 65535,
                    hidden: "data.connection === 'adb'",
                    sm: 12,
                },
                adbPort: {
                    type: 'number',
                    label: T.adbPort,
                    min: 1,
                    max: 65535,
                    hidden: "data.connection === 'remote'",
                    sm: 12,
                },
                // what to do on the device after saving (step texts from PR #11)
                stepPair: { type: 'staticText', text: T.stepPair, hidden: "data.connection === 'adb'", sm: 12 },
                stepAdbRemote: {
                    type: 'staticText',
                    text: T.stepAdbRemote,
                    hidden: "data.connection !== 'remote_adb'",
                    sm: 12,
                },
                stepAdbFire: { type: 'staticText', text: T.stepAdbFire, hidden: "data.connection !== 'adb'", sm: 12 },
                adbSecurity: {
                    type: 'staticText',
                    text: T.adbSecurity,
                    hidden: "data.connection === 'remote'",
                    sm: 12,
                },
            },
        };
        let data: JsonFormData = {
            ...initial,
            connection: initial.connection ?? 'remote',
            remotePort: initial.remotePort ?? 6466,
        };
        for (;;) {
            const result = await context.showForm(schema, { data, title, ignoreApplyDisabled: true });
            if (!result) {
                return undefined;
            }
            data = result;
            const row = toDeviceConfig(result);
            const error = this.validate(row, ownIndex);
            if (!error) {
                return row;
            }
            await context.showMessage(error);
        }
    }

    private validate(row: DeviceConfig, ownIndex: number): ioBroker.StringOrTranslated | undefined {
        if (!row.name || !row.host) {
            return T.missingFields;
        }
        if (row.wolMac && !MAC_PATTERN.test(row.wolMac)) {
            return T.macInvalid;
        }
        const host = row.host.toLowerCase();
        const duplicate = this.bridge
            .rawDevices()
            .some((d, i) => i !== ownIndex && typeof d?.host === 'string' && d.host.trim().toLowerCase() === host);
        return duplicate ? T.duplicateHost : undefined;
    }

    private find(id: string): DmDeviceEntry | undefined {
        return this.bridge.devices().find(e => e.id === id);
    }
}

/**
 * Translation key of the connection mode label.
 *
 * @param mode - Connection mode
 */
function connectionKey(mode: ConnectionMode): 'connRemote' | 'connRemoteAdb' | 'connAdb' {
    return mode === 'adb' ? 'connAdb' : mode === 'remote_adb' ? 'connRemoteAdb' : 'connRemote';
}

function safeDisplayText(value: string | undefined): string | undefined {
    const safe = value
        ?.replace(/\p{Cc}/gu, '')
        .trim()
        .slice(0, 128);
    return safe || undefined;
}

function discoveredDeviceName(device: DiscoveredAndroidTv): string {
    const advertisedName = safeDisplayText(device.deviceName);
    if (advertisedName) {
        return advertisedName.slice(0, 64);
    }
    const serviceSuffix = ANDROID_TV_REMOTE_SERVICE;
    const instanceName = device.serviceName.toLowerCase().endsWith(serviceSuffix.toLowerCase())
        ? device.serviceName.slice(0, -serviceSuffix.length)
        : device.serviceName;
    return safeDisplayText(instanceName)?.slice(0, 64) || 'Android TV';
}

/**
 * Converts form data into a configuration row (trimmed, typed, port validated).
 *
 * @param data - Form data
 */
function toDeviceConfig(data: JsonFormData): DeviceConfig {
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const connection = data.connection === 'adb' || data.connection === 'remote_adb' ? data.connection : 'remote';
    const port = Number(data.adbPort);
    const remotePort = Number(data.remotePort);
    return {
        name: str(data.name),
        host: str(data.host),
        enabled: data.enabled !== false,
        connection,
        enableIme: data.enableIme !== false,
        remotePort: Number.isInteger(remotePort) && remotePort >= 1 && remotePort <= 65535 ? remotePort : 6466,
        adbPort: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 5555,
        wolMac: str(data.wolMac),
        wolBroadcast: str(data.wolBroadcast),
    };
}
