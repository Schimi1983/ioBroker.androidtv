import {
    DeviceManagement,
    type ActionContext,
    type ConfigItemPanel,
    type DeviceDetails,
    type DeviceLoadContext,
    type InstanceDetails,
    type JsonFormData,
    type JsonFormSchema,
    type RetVal,
} from '@iobroker/dm-utils';
import type { AdapterInstance } from '@iobroker/adapter-core';
import { DEFAULT_ADB_PORT } from './adb/client';
import { PairingError } from './pairing';

type DeviceConfig = ioBroker.AdapterConfig['devices'][number];
type PairingMessage = 'pairingStarted' | 'pairingDone' | 'pairingDoneSave' | PairingError['code'];

/** A configured device and its stable ioBroker object ID. */
export interface ManagedDevice {
    /** Device object ID used by the adapter. */
    id: string;
    /** Persisted native device configuration. */
    config: DeviceConfig;
}

/** Adapter operations exposed to the Device Manager integration. */
export interface AndroidTvDeviceManagerAdapter extends AdapterInstance {
    /** Returns configured devices with the object IDs used by the adapter. */
    getDeviceManagerDevices(): ManagedDevice[];
    /** Adds a device and persists it in the instance configuration. */
    addDeviceConfiguration(config: DeviceConfig): Promise<void>;
    /** Replaces a device configuration while retaining its existing fields. */
    updateDeviceConfiguration(id: string, config: DeviceConfig): Promise<void>;
    /** Removes a device from the instance configuration. */
    removeDeviceConfiguration(id: string): Promise<void>;
    /** Starts remote-protocol pairing for a device host. */
    startDevicePairing(host: string): Promise<void>;
    /** Completes pairing with the code displayed by the device. */
    finishDevicePairing(host: string, pin: string): Promise<boolean>;
    /** Returns a pairing message translated for the user's language. */
    getDeviceManagerPairingMessage(key: PairingMessage): ioBroker.StringOrTranslated;
}

const CONNECTIONS = ['remote', 'remote_adb', 'adb'] as const;
const MAC_PATTERN = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

/** Form used to add or edit an Android TV device. */
export const DEVICE_FORM_SCHEMA: JsonFormSchema = {
    type: 'panel',
    i18n: true,
    items: {
        name: {
            type: 'text',
            label: 'Name',
            default: 'Android TV',
            validator: 'data.name && data.name.trim().length > 0',
            validatorNoSaveOnError: true,
            sm: 6,
        },
        host: {
            type: 'text',
            label: 'IP address',
            help: 'ipHelp',
            validator: 'data.host && data.host.trim().length > 0',
            validatorNoSaveOnError: true,
            sm: 6,
        },
        enabled: {
            type: 'checkbox',
            label: 'Enabled',
            default: true,
            sm: 6,
        },
        connection: {
            type: 'select',
            label: 'Device type',
            help: 'connectionHelp',
            default: 'remote',
            options: [
                { label: 'connRemote', value: 'remote' },
                { label: 'connRemoteAdb', value: 'remote_adb' },
                { label: 'connAdb', value: 'adb' },
            ],
            sm: 6,
        },
        wolMac: {
            type: 'text',
            label: 'MAC address (Wake-on-LAN)',
            help: 'wolMacHelp',
            validator: '!data.wolMac || /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(data.wolMac.trim())',
            validatorErrorText: 'wolMacInvalid',
            validatorNoSaveOnError: true,
            sm: 6,
        },
        enableIme: {
            type: 'checkbox',
            label: 'Current app & text input',
            tooltip: 'enableImeTooltip',
            default: true,
            expertMode: true,
            hidden: "data.connection === 'adb'",
            sm: 6,
        },
        adbPort: {
            type: 'number',
            label: 'ADB port',
            default: DEFAULT_ADB_PORT,
            min: 1,
            max: 65535,
            expertMode: true,
            hidden: "!(data.connection === 'adb' || data.connection === 'remote_adb')",
            sm: 6,
        },
        wolBroadcast: {
            type: 'text',
            label: 'Wake-on-LAN broadcast address',
            help: 'wolBroadcastHelp',
            default: '',
            expertMode: true,
            sm: 6,
        },
        pairStep: {
            type: 'staticText',
            text: 'stepPair',
            hidden: "data.connection === 'adb'",
            sm: 12,
        },
        adbRemoteStep: {
            type: 'staticText',
            text: 'stepAdbRemote',
            hidden: "data.connection !== 'remote_adb'",
            sm: 12,
        },
        adbFireStep: {
            type: 'staticText',
            text: 'stepAdbFire',
            hidden: "data.connection !== 'adb'",
            sm: 12,
        },
        adbSecurity: {
            type: 'staticText',
            text: 'adbSecurity',
            hidden: "!(data.connection === 'adb' || data.connection === 'remote_adb')",
            sm: 12,
        },
    },
};

const PAIRING_FORM_SCHEMA: JsonFormSchema = {
    type: 'panel',
    i18n: true,
    items: {
        pin: {
            type: 'text',
            label: 'Code shown on the TV',
            maxLength: 6,
            validator: '/^[0-9a-fA-F]{6}$/.test(data.pin)',
            validatorErrorText: 'invalidPin',
            validatorNoSaveOnError: true,
        },
    },
};

/**
 * Converts stored configuration into form values, supplying defaults for legacy entries.
 *
 * @param config - Stored device configuration
 */
export function deviceConfigToFormData(config?: Partial<DeviceConfig>): JsonFormData {
    return {
        name: config?.name || config?.host || 'Android TV',
        host: config?.host || '',
        enabled: config?.enabled !== false,
        connection: CONNECTIONS.includes(config?.connection as (typeof CONNECTIONS)[number])
            ? config?.connection
            : 'remote',
        enableIme: config?.enableIme !== false,
        adbPort: validAdbPort(config?.adbPort) ? config?.adbPort : DEFAULT_ADB_PORT,
        wolMac: config?.wolMac || '',
        wolBroadcast: config?.wolBroadcast || '',
    };
}

/**
 * Validates and converts Device Manager form values into the stored device shape.
 *
 * @param data - Form values returned by Admin
 */
export function parseDeviceFormData(data: JsonFormData): DeviceConfig {
    if (typeof data.name !== 'string' || !data.name.trim()) {
        throw new Error('Device name is required');
    }
    if (typeof data.host !== 'string' || !data.host.trim()) {
        throw new Error('IP address is required');
    }
    if (!CONNECTIONS.includes(data.connection)) {
        throw new Error('Invalid device type');
    }
    const adbPort = Number(data.adbPort ?? DEFAULT_ADB_PORT);
    if (!Number.isInteger(adbPort) || adbPort < 1 || adbPort > 65535) {
        throw new Error('ADB port must be between 1 and 65535');
    }
    if (data.wolMac !== undefined && typeof data.wolMac !== 'string') {
        throw new Error('MAC address must be text');
    }
    const wolMac = typeof data.wolMac === 'string' ? data.wolMac : '';
    if (wolMac.trim() && !MAC_PATTERN.test(wolMac.trim())) {
        throw new Error('Invalid MAC address');
    }
    if (data.wolBroadcast !== undefined && typeof data.wolBroadcast !== 'string') {
        throw new Error('Wake-on-LAN broadcast address must be text');
    }

    return {
        name: data.name,
        host: data.host,
        enabled: data.enabled !== false,
        connection: data.connection,
        enableIme: data.enableIme !== false,
        adbPort,
        wolMac,
        wolBroadcast: typeof data.wolBroadcast === 'string' ? data.wolBroadcast : '',
    };
}

function validAdbPort(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535;
}

/** Device Manager integration for adding, editing, pairing, and removing Android TVs. */
export class AndroidTvDeviceManagement extends DeviceManagement<AndroidTvDeviceManagerAdapter> {
    protected override getInstanceInfo(): RetVal<InstanceDetails> {
        return {
            apiVersion: 'v3',
            actions: [
                {
                    id: 'addDevice',
                    icon: 'newDevice',
                    title: 'Add device',
                    handler: async context => {
                        const data = await context.showForm(DEVICE_FORM_SCHEMA, {
                            title: 'Add device',
                            data: deviceConfigToFormData(),
                        });
                        if (!data) {
                            return { refresh: false };
                        }
                        await this.adapter.addDeviceConfiguration(parseDeviceFormData(data));
                        return { refresh: true };
                    },
                },
            ],
        };
    }

    protected override loadDevices(context: DeviceLoadContext<string>): void {
        const devices = this.adapter.getDeviceManagerDevices();
        context.setTotalDevices(devices.length);
        for (const { id, config } of devices) {
            const mode =
                config.connection === 'adb' || config.connection === 'remote_adb' ? config.connection : 'remote';
            const statePrefix = `${this.adapter.namespace}.${id}`;
            context.addDevice({
                id,
                name: config.name || config.host,
                identifier: config.host,
                enabled: config.enabled !== false,
                status: {
                    connection: {
                        stateId: `${statePrefix}.info.connected`,
                        mapping: { true: 'connected', false: 'disconnected' },
                    },
                },
                indicators: [
                    {
                        id: 'androidtvStatus',
                        value: { stateId: `${statePrefix}.info.status` },
                        icon: 'info',
                        showValue: true,
                        hideIfEmpty: false,
                        tooltip: 'Status',
                    },
                ],
                hasDetails: true,
                actions: [
                    {
                        id: 'editDevice',
                        icon: 'edit',
                        title: 'Edit device',
                        handler: async (deviceId, actionContext) => this.editDevice(deviceId, actionContext),
                    },
                    {
                        id: 'removeDevice',
                        icon: 'delete',
                        title: 'Remove device',
                        handler: async (deviceId, actionContext) => this.removeDevice(deviceId, actionContext),
                    },
                    ...(mode === 'adb'
                        ? []
                        : [
                              {
                                  id: 'pairDevice',
                                  icon: 'pairDevice',
                                  title: 'Pair device',
                                  handler: async (deviceId: string, actionContext: ActionContext) =>
                                      this.pairDevice(deviceId, actionContext),
                              },
                          ]),
                ],
            });
        }
    }

    protected override getDeviceDetails(id: string): RetVal<DeviceDetails<string> | null> {
        const device = this.adapter.getDeviceManagerDevices().find(item => item.id === id);
        if (!device) {
            return null;
        }
        const items: ConfigItemPanel['items'] = {
            status: {
                type: 'state',
                oid: `${id}.info.status`,
                control: 'text',
                readOnly: true,
                label: 'Status',
                sm: 12,
            },
            connected: {
                type: 'state',
                oid: `${id}.info.connected`,
                control: 'text',
                readOnly: true,
                label: 'Connected',
                sm: 6,
            },
        };
        if (device.config.connection === 'remote_adb' || device.config.connection === 'adb') {
            Object.assign(items, {
                adbConnected: {
                    type: 'state',
                    oid: `${id}.info.adbConnected`,
                    control: 'text',
                    readOnly: true,
                    label: 'ADB connected',
                    sm: 6,
                },
                adbAuthorizationPending: {
                    type: 'state',
                    oid: `${id}.info.adbAuthorizationPending`,
                    control: 'text',
                    readOnly: true,
                    label: 'ADB authorization pending',
                    sm: 6,
                },
            });
        }
        return { id, schema: { type: 'panel', i18n: true, items } };
    }

    /**
     * Shows the edit form and persists the changed device configuration.
     *
     * @param deviceId - Device object ID
     * @param context - Device Manager action context
     */
    private async editDevice(
        deviceId: string,
        context: ActionContext,
    ): Promise<{
        refresh: 'all' | 'none';
    }> {
        const current = this.adapter.getDeviceManagerDevices().find(device => device.id === deviceId);
        if (!current) {
            throw new Error('Device no longer exists');
        }
        const data = await context.showForm(DEVICE_FORM_SCHEMA, {
            title: 'Edit device',
            data: deviceConfigToFormData(current.config),
        });
        if (!data) {
            return { refresh: 'none' };
        }
        const config = { ...current.config, ...parseDeviceFormData(data) };
        await this.adapter.updateDeviceConfiguration(deviceId, config);
        return { refresh: 'all' };
    }

    /**
     * Confirms removal and deletes the device configuration.
     *
     * @param deviceId - Device object ID
     * @param context - Device Manager action context
     */
    private async removeDevice(
        deviceId: string,
        context: ActionContext,
    ): Promise<{
        refresh: 'all' | 'none';
    }> {
        const current = this.adapter.getDeviceManagerDevices().find(device => device.id === deviceId);
        if (!current) {
            throw new Error('Device no longer exists');
        }
        if (!(await context.showConfirmation('Remove this device?'))) {
            return { refresh: 'none' };
        }
        await this.adapter.removeDeviceConfiguration(deviceId);
        return { refresh: 'all' };
    }

    /**
     * Starts pairing and retries the confirmation form after an invalid code.
     *
     * @param deviceId - Device object ID
     * @param context - Device Manager action context
     */
    private async pairDevice(
        deviceId: string,
        context: ActionContext,
    ): Promise<{
        refresh: 'devices' | 'none';
    }> {
        const current = this.adapter.getDeviceManagerDevices().find(device => device.id === deviceId);
        if (!current) {
            throw new Error('Device no longer exists');
        }
        const host = current.config.host.trim();
        try {
            await this.adapter.startDevicePairing(host);
        } catch (error) {
            if (error instanceof PairingError) {
                await context.showMessage(this.adapter.getDeviceManagerPairingMessage(error.code));
                return { refresh: 'none' };
            }
            throw error;
        }
        await context.showMessage(this.adapter.getDeviceManagerPairingMessage('pairingStarted'));

        while (true) {
            const data = await context.showForm(PAIRING_FORM_SCHEMA, { title: 'Confirm code', data: { pin: '' } });
            if (!data) {
                return { refresh: 'none' };
            }
            try {
                const configured = await this.adapter.finishDevicePairing(
                    host,
                    typeof data.pin === 'string' ? data.pin : '',
                );
                await context.showMessage(
                    this.adapter.getDeviceManagerPairingMessage(configured ? 'pairingDone' : 'pairingDoneSave'),
                );
                return { refresh: 'devices' };
            } catch (error) {
                if (!(error instanceof PairingError)) {
                    throw error;
                }
                await context.showMessage(this.adapter.getDeviceManagerPairingMessage(error.code));
                if (error.code !== 'invalidPin' && error.code !== 'wrongPin') {
                    return { refresh: 'none' };
                }
            }
        }
    }
}
