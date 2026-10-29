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
                obj.native.devices = [{ enabled: true, name: 'Test TV', host: '127.0.0.1', enableIme: true }];
                await harness.objects.setObjectAsync(instanceId, obj);

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
                const connected = await harness.states.getStateAsync('androidtv.0.Test_TV.info.connected');
                if (connected && connected.val === true) {
                    throw new Error('unreachable TV reported as connected');
                }
            });
        });
    },
});
