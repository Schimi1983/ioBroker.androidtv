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
}

const MAC_PATTERN = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const PAIRING_ATTEMPTS = 3;

/** Relative state ids written by the quick controls. */
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
            ],
        };
    }

    protected loadDevices(context: DeviceLoadContext<string>): void {
        const entries = this.bridge.devices();
        context.setTotalDevices(entries.length);
        for (const entry of entries) {
            context.addDevice(this.deviceInfo(entry));
        }
    }

    protected override getDeviceDetails(id: string): DeviceDetails<string> | { error: string } {
        const entry = this.find(id);
        if (!entry) {
            return { error: `unknown device ${id}` };
        }
        const status = this.bridge.statusText(id);
        const schema: JsonFormSchema = {
            type: 'panel',
            items: {
                status: { type: 'staticInfo', label: T.status, data: status ?? T.notRunning, sm: 12 },
                host: { type: 'staticInfo', label: T.host, data: entry.config.host, sm: 12 },
                type: { type: 'staticInfo', label: T.deviceType, data: T[connectionKey(entry.mode)], sm: 12 },
                mac: { type: 'staticInfo', label: T.mac, data: entry.config.wolMac?.trim() || '–', sm: 12 },
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
                : 'disconnected',
            actions: this.deviceActions(entry, enabled),
            controls: entry.running ? this.deviceControls(entry, base) : undefined,
            hasDetails: true,
        };
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
                // reserved ids "enable"/"disable": click on the enabled icon
                id: enabled ? 'disable' : 'enable',
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
            },
        ];
        if (entry.mode !== 'adb') {
            controls.push({
                id: 'muted',
                type: 'switch',
                label: T.mute,
                stateId: `${base}.muted`,
                handler: (deviceId, controlId, state) => write(deviceId, controlId, !!state),
            });
        }
        controls.push(
            button('volumeDown', T.volumeDown),
            button('volumeUp', T.volumeUp),
            button('playPause', T.playPause),
            button('home', T.home),
        );
        if (entry.mode !== 'adb') {
            controls.push(
                { id: 'volume', type: 'info', label: T.volume, stateId: `${base}.volume` },
                { id: 'currentApp', type: 'info', label: T.currentApp, stateId: `${base}.currentApp` },
            );
        }
        if (entry.mode !== 'remote') {
            controls.push({ id: 'title', type: 'info', label: T.title, stateId: `${base}.media.title` });
        }
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

    private async addDevice(context: ActionContext): Promise<{ refresh: boolean }> {
        const data = await this.askSettings(context, T.addDevice, {
            name: 'Android TV',
            host: '',
            enabled: true,
            connection: 'remote',
            enableIme: true,
            adbPort: 5555,
            wolMac: '',
            wolBroadcast: '',
        });
        if (data) {
            const devices = this.bridge.rawDevices();
            devices.push(data);
            this.bridge.saveDevices(devices);
            await context.showMessage(T.saved);
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
            this.bridge.saveDevices(devices);
            await context.showMessage(T.saved);
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
                name: { type: 'text', label: T.name, sm: 12 },
                host: { type: 'text', label: T.host, help: T.hostHelp, sm: 12 },
                connection: {
                    type: 'select',
                    label: T.deviceType,
                    options: [
                        { label: T.connRemote, value: 'remote' },
                        { label: T.connRemoteAdb, value: 'remote_adb' },
                        { label: T.connAdb, value: 'adb' },
                    ],
                    sm: 12,
                },
                enabled: { type: 'checkbox', label: T.enabled, sm: 12 },
                wolMac: { type: 'text', label: T.mac, help: T.macHelp, sm: 12 },
                enableIme: { type: 'checkbox', label: T.ime, hidden: "data.connection === 'adb'", sm: 12 },
                adbPort: {
                    type: 'number',
                    label: T.adbPort,
                    min: 1,
                    max: 65535,
                    hidden: "data.connection === 'remote'",
                    sm: 12,
                },
                wolBroadcast: { type: 'text', label: T.broadcast, sm: 12 },
            },
        };
        let data: JsonFormData = { ...initial, connection: initial.connection ?? 'remote' };
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

/**
 * Converts form data into a configuration row (trimmed, typed, port validated).
 *
 * @param data - Form data
 */
function toDeviceConfig(data: JsonFormData): DeviceConfig {
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const connection = data.connection === 'adb' || data.connection === 'remote_adb' ? data.connection : 'remote';
    const port = Number(data.adbPort);
    return {
        name: str(data.name),
        host: str(data.host),
        enabled: data.enabled !== false,
        connection,
        enableIme: data.enableIme !== false,
        adbPort: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 5555,
        wolMac: str(data.wolMac),
        wolBroadcast: str(data.wolBroadcast),
    };
}
