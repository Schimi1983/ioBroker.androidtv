import { expect } from 'chai';
import { EventEmitter } from 'node:events';
import type { ActionContext, DeviceInfo, DeviceLoadContext } from '@iobroker/dm-utils';
import { DEFAULT_ADB_PORT } from './adb/client';
import {
    AndroidTvDeviceManagement,
    deviceConfigToFormData,
    parseDeviceFormData,
    type AndroidTvDeviceManagerAdapter,
} from './device-manager';
import { PairingError } from './pairing';

describe('device manager configuration', () => {
    it('keeps legacy device fields and supplies defaults for missing fields', () => {
        const formData = deviceConfigToFormData({
            name: 'Living room TV',
            host: '192.168.1.20',
            enabled: true,
            enableIme: false,
        });

        expect(formData).to.deep.equal({
            name: 'Living room TV',
            host: '192.168.1.20',
            enabled: true,
            connection: 'remote',
            enableIme: false,
            adbPort: DEFAULT_ADB_PORT,
            wolMac: '',
            wolBroadcast: '',
        });
        expect(parseDeviceFormData(formData)).to.deep.equal({
            name: 'Living room TV',
            host: '192.168.1.20',
            enabled: true,
            connection: 'remote',
            enableIme: false,
            adbPort: DEFAULT_ADB_PORT,
            wolMac: '',
            wolBroadcast: '',
        });
    });

    it('round-trips all supported connections and Wake-on-LAN options', () => {
        for (const connection of ['remote', 'remote_adb', 'adb'] as const) {
            const config = {
                name: 'Living room TV',
                host: '192.168.1.30',
                enabled: false,
                connection,
                enableIme: false,
                adbPort: 5556,
                wolMac: 'aa:bb:cc:dd:ee:ff',
                wolBroadcast: '192.168.1.255',
            };

            expect(parseDeviceFormData(deviceConfigToFormData(config))).to.deep.equal(config);
        }
    });

    it('keeps a pairing session open to retry a mistyped code', async () => {
        const adapter = new EventEmitter() as unknown as AndroidTvDeviceManagerAdapter;
        let attempts = 0;
        Object.assign(adapter, {
            namespace: 'androidtv.0',
            getDeviceManagerDevices: () => [
                { id: 'Living_TV', config: { name: 'Living TV', host: '192.168.1.20', connection: 'remote' } },
            ],
            startDevicePairing: () => Promise.resolve(),
            finishDevicePairing: () => {
                attempts++;
                if (attempts === 1) {
                    return Promise.reject(new PairingError('wrongPin', 'wrong code'));
                }
                return Promise.resolve(true);
            },
            getDeviceManagerPairingMessage: (key: string) => key,
        });
        class TestDeviceManagement extends AndroidTvDeviceManagement {
            public load(context: DeviceLoadContext<string>): void {
                super.loadDevices(context);
            }
        }
        const management = new TestDeviceManagement(adapter);
        const devices: DeviceInfo<string>[] = [];
        management.load({ setTotalDevices: () => undefined, addDevice: device => devices.push(device) });
        const forms = [{ pin: '123456' }, { pin: 'ABCDEF' }];
        const messages: ioBroker.StringOrTranslated[] = [];
        const actionContext = {
            showForm: () => Promise.resolve(forms.shift()),
            showMessage: (message: ioBroker.StringOrTranslated) => {
                messages.push(message);
                return Promise.resolve();
            },
        } as unknown as ActionContext;
        const pairAction = devices[0].actions?.find(action => action.id === 'pairDevice');

        expect(pairAction).to.exist;
        if (!pairAction || !('handler' in pairAction) || !pairAction.handler) {
            throw new Error('pairing action handler was not registered');
        }
        const result = await pairAction.handler('Living_TV', actionContext);

        expect(result).to.deep.equal({ refresh: 'devices' });
        expect(attempts).to.equal(2);
        expect(messages).to.deep.equal(['pairingStarted', 'wrongPin', 'pairingDone']);
    });

    it('rejects invalid device configuration data', () => {
        const valid = deviceConfigToFormData({ name: 'TV', host: '192.168.1.20' });

        expect(() => parseDeviceFormData({ ...valid, host: '' })).to.throw('IP address is required');
        expect(() => parseDeviceFormData({ ...valid, connection: 'unknown' })).to.throw('Invalid device type');
        expect(() => parseDeviceFormData({ ...valid, adbPort: 65536 })).to.throw(
            'ADB port must be between 1 and 65535',
        );
        expect(() => parseDeviceFormData({ ...valid, wolMac: 'not-a-mac' })).to.throw('Invalid MAC address');
    });
});
