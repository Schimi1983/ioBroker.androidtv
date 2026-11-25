const path = require('path');
const { tests } = require('@iobroker/testing');

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Certificate handling and device objects', getHarness => {
            let harness;
            before(() => {
                harness = getHarness();
            });

            it('creates the client certificate, restarts and creates device objects', async function () {
                this.timeout(60_000);
                const instanceId = 'system.adapter.androidtv.0';
                const obj = await harness.objects.getObjectAsync(instanceId);
                obj.native.devices = [
                    { enabled: true, name: 'Test TV', host: '127.0.0.1', enableIme: true },
                    { enabled: true, name: 'Fire TV Küche', host: '127.0.0.2', connection: 'adb', adbPort: 5555 },
                    { enabled: false, name: 'Old TV', host: '127.0.0.3' },
                ];
                await harness.objects.setObjectAsync(instanceId, obj);
                // stale "connected" from an earlier run must be reset for the disabled device
                await harness.objects.setObjectAsync('androidtv.0.Old_TV.info.connected', {
                    type: 'state',
                    common: { name: 'Connected', type: 'boolean', role: 'indicator.connected', read: true, write: false },
                    native: {},
                });
                await harness.states.setStateAsync('androidtv.0.Old_TV.info.connected', { val: true, ack: true });
                await harness.objects.setObjectAsync('androidtv.0.Old_TV.power', {
                    type: 'state',
                    common: { name: 'Power', type: 'boolean', role: 'switch.power', read: true, write: true },
                    native: {},
                });
                await harness.states.setStateAsync('androidtv.0.Old_TV.power', { val: true, ack: true });

                // First start generates the certificate and stores it in the adapter file storage
                await harness.startAdapterAndWait();
                await new Promise(resolve => setTimeout(resolve, 8_000));

                const file = await new Promise((resolve, reject) =>
                    harness.objects.readFile('androidtv.0', 'client-certificate.json', null, (err, data) =>
                        err ? reject(err) : resolve(data),
                    ),
                );
                const stored = JSON.parse(file.toString());
                if (!stored.cert.includes('BEGIN CERTIFICATE')) {
                    throw new Error('client certificate missing');
                }
                if (!stored.key || stored.key.includes('PRIVATE KEY')) {
                    throw new Error('client key missing or stored unencrypted');
                }

                const power = await harness.objects.getObjectAsync('androidtv.0.Test_TV.power');
                if (!power || power.common.role !== 'switch.power') {
                    throw new Error('device objects not created');
                }
                const app = await harness.objects.getObjectAsync('androidtv.0.Test_TV.apps.Netflix');
                if (!app) {
                    throw new Error('app button not created');
                }
                const adbKeyFile = await new Promise((resolve, reject) =>
                    harness.objects.readFile('androidtv.0', 'adb-key.json', null, (err, data) =>
                        err ? reject(err) : resolve(data),
                    ),
                );
                if (JSON.parse(adbKeyFile.toString()).key.includes('PRIVATE KEY')) {
                    throw new Error('ADB key stored unencrypted');
                }
                if (!(await harness.objects.getObjectAsync('androidtv.0.Fire_TV_Kueche.media.state'))) {
                    throw new Error('media states missing for ADB device');
                }
                if (await harness.objects.getObjectAsync('androidtv.0.Fire_TV_Kueche.info.pairingRequired')) {
                    throw new Error('remote-only state created for ADB-only device');
                }
                if (await harness.objects.getObjectAsync('androidtv.0.Test_TV.media.state')) {
                    throw new Error('media states created for remote-only device');
                }

                const connected = await harness.states.getStateAsync('androidtv.0.Test_TV.info.connected');
                if (connected && connected.val === true) {
                    throw new Error('unreachable TV reported as connected');
                }

                // Device Manager (dm-utils) answers with both configured devices
                const send = (command, message) =>
                    new Promise(resolve => harness.sendTo('androidtv.0', command, message, resolve));
                const info = await send('dm:instanceInfo', {});
                if (
                    info?.apiVersion !== 'v3' ||
                    !info.actions?.some(a => a.id === 'add') ||
                    !info.actions?.some(a => a.id === 'discover')
                ) {
                    throw new Error(`device manager instance info invalid: ${JSON.stringify(info)}`);
                }
                const list = await send('dm:loadDevices', {});
                const ids = (list?.add ?? []).map(d => d.id).sort();
                if (ids.join() !== 'Fire_TV_Kueche,Old_TV,Test_TV') {
                    throw new Error(`device manager list invalid: ${JSON.stringify(list)}`);
                }
                const tv = list.add.find(d => d.id === 'Test_TV');
                if (!tv.actions.some(a => a.id === 'enable/disable')) {
                    throw new Error('enable/disable action missing (switch on the card would be read-only)');
                }
                const oldConnected = await harness.states.getStateAsync('androidtv.0.Old_TV.info.connected');
                if (oldConnected?.val !== false) {
                    throw new Error(`disabled device still reported as connected: ${JSON.stringify(oldConnected)}`);
                }
                const oldPower = await harness.states.getStateAsync('androidtv.0.Old_TV.power');
                if (oldPower?.val !== false) {
                    throw new Error(`disabled device still reported as on: ${JSON.stringify(oldPower)}`);
                }
                const controlState = await send('dm:deviceControlState', { deviceId: 'Test_TV', controlId: 'power' });
                if (!controlState || controlState.result?.error || controlState.error) {
                    throw new Error(`control state not readable: ${JSON.stringify(controlState)}`);
                }
            });
        });
    },
});
