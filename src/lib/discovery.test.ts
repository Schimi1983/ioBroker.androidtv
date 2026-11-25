import { expect } from 'chai';
import { EventEmitter } from 'node:events';
import {
    ANDROID_TV_REMOTE_SERVICE,
    deduplicateAndroidTvs,
    discoverAndroidTvs,
    excludeConfiguredAndroidTvs,
    getDiscoveredDeviceHost,
    type DiscoveredAndroidTv,
    type DiscoveryOptions,
    type DiscoverySocket,
} from './discovery';

class FakeSocket extends EventEmitter implements DiscoverySocket {
    public closed = false;
    public sent: Buffer[] = [];

    public bind(_port: number, _address?: string, callback?: () => void): this {
        callback?.();
        return this;
    }

    public addMembership(_multicastAddress: string): void {}

    public send(message: Buffer, _port?: number, _address?: string): void {
        this.sent.push(message);
    }

    public close(): this {
        this.closed = true;
        return this;
    }
}

function wireName(name: string): Buffer {
    const labels = name.replace(/\.$/, '').split('.');
    return Buffer.concat([
        ...labels.map(label => {
            const bytes = Buffer.from(label);
            return Buffer.concat([Buffer.from([bytes.length]), bytes]);
        }),
        Buffer.from([0]),
    ]);
}

function rr(name: string, type: number, data: Buffer, cacheFlush = false): Buffer {
    const header = Buffer.alloc(10);
    header.writeUInt16BE(type, 0);
    header.writeUInt16BE(cacheFlush ? 0x8001 : 1, 2);
    header.writeUInt32BE(120, 4);
    header.writeUInt16BE(data.length, 8);
    return Buffer.concat([wireName(name), header, data]);
}

function txt(...entries: string[]): Buffer {
    return Buffer.concat(
        entries.map(entry => {
            const bytes = Buffer.from(entry);
            return Buffer.concat([Buffer.from([bytes.length]), bytes]);
        }),
    );
}

function srv(host: string, port: number): Buffer {
    const fixed = Buffer.alloc(6);
    fixed.writeUInt16BE(0, 0);
    fixed.writeUInt16BE(0, 2);
    fixed.writeUInt16BE(port, 4);
    return Buffer.concat([fixed, wireName(host)]);
}

function response(records: Buffer[]): Buffer {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0x8400, 2);
    header.writeUInt16BE(records.length, 6);
    return Buffer.concat([header, ...records]);
}

function validRecords(options: { service?: string; host?: string; address?: string; port?: number } = {}): Buffer[] {
    const service = options.service ?? `Shield.${ANDROID_TV_REMOTE_SERVICE}`;
    const host = options.host ?? 'living-room.local.';
    const address = options.address ?? '192.168.1.42';
    const octets = address.split('.').map(Number);
    return [
        rr(host, 1, Buffer.from(octets), true),
        rr(host, 28, Buffer.from('20010db8000000000000000000000001', 'hex'), true),
        rr(service, 16, txt('fn=Living Room', 'md=Shield Android TV', 'mf=NVIDIA', 'bt=aa:bb:cc:dd:ee:ff')),
        rr(service, 33, srv(host, options.port ?? 6466), true),
        rr(ANDROID_TV_REMOTE_SERVICE, 12, wireName(service)),
    ];
}

interface Scan {
    promise: Promise<DiscoveredAndroidTv[]>;
    sockets: FakeSocket[];
    finish(): void;
    timerWasCleared(): boolean;
}

function scanner(options: Pick<DiscoveryOptions, 'signal' | 'onError'> = {}): Scan {
    const sockets: FakeSocket[] = [];
    let onTimeout: (() => void) | undefined;
    let timerCleared = false;
    const promise = discoverAndroidTvs({
        ...options,
        timeoutMs: 50,
        createSocket: () => {
            const socket = new FakeSocket();
            sockets.push(socket);
            return socket;
        },
        setTimeout: callback => {
            onTimeout = callback;
            return 1;
        },
        clearTimeout: () => {
            timerCleared = true;
        },
    });
    return {
        promise,
        sockets,
        finish: () => onTimeout?.(),
        timerWasCleared: () => timerCleared,
    };
}

function cleanupWasComplete(scan: Scan): void {
    expect(scan.sockets).to.have.length(2);
    for (const socket of scan.sockets) {
        expect(socket.closed).to.equal(true);
        expect(socket.listenerCount('message')).to.equal(0);
        expect(socket.listenerCount('error')).to.equal(0);
    }
    expect(scan.timerWasCleared()).to.equal(true);
}

describe('android tv remote discovery', () => {
    it('parses IPv4/IPv6, PTR/SRV/TXT metadata and tolerates DNS cache-flush class bits', async () => {
        const scan = scanner();
        const packet = response(validRecords());
        scan.sockets[0].emit('message', packet);
        scan.finish();

        const [device] = await scan.promise;
        expect(device).to.deep.equal({
            serviceName: `Shield.${ANDROID_TV_REMOTE_SERVICE}`,
            hostname: 'living-room.local.',
            address: '192.168.1.42',
            addresses: ['192.168.1.42', '2001:db8::1'],
            port: 6466,
            txtMetadata: {
                fn: 'Living Room',
                md: 'Shield Android TV',
                mf: 'NVIDIA',
                bt: 'aa:bb:cc:dd:ee:ff',
            },
            deviceName: 'Living Room',
            model: 'Shield Android TV',
            manufacturer: 'NVIDIA',
            macAddress: 'aa:bb:cc:dd:ee:ff',
            connectionTypeSuggestion: 'remote-v2',
        });
        cleanupWasComplete(scan);
        expect(scan.sockets.every(socket => socket.sent.length === 1)).to.equal(true);
    });

    it('combines partial records received before and after the PTR announcement', async () => {
        const scan = scanner();
        const service = `Living Room.${ANDROID_TV_REMOTE_SERVICE}`;
        const host = 'living-room.local.';
        scan.sockets[1].emit(
            'message',
            response([
                rr(host, 1, Buffer.from([192, 168, 1, 42])),
                rr(service, 33, srv(host, 6467)),
                rr(service, 16, txt('fn=Living Room')),
            ]),
        );
        scan.sockets[0].emit('message', response([rr(ANDROID_TV_REMOTE_SERVICE, 12, wireName(service))]));
        scan.finish();

        expect(await scan.promise).to.deep.equal([
            {
                serviceName: service,
                hostname: host,
                address: '192.168.1.42',
                addresses: ['192.168.1.42'],
                port: 6467,
                txtMetadata: { fn: 'Living Room' },
                deviceName: 'Living Room',
                connectionTypeSuggestion: 'remote-v2',
            },
        ]);
        cleanupWasComplete(scan);
    });

    it('keeps partial PTR discoveries if SRV, TXT or address records are missing', async () => {
        const scan = scanner();
        const service = `Shield.${ANDROID_TV_REMOTE_SERVICE}`;
        scan.sockets[0].emit('message', response([rr(ANDROID_TV_REMOTE_SERVICE, 12, wireName(service))]));
        scan.finish();

        expect(await scan.promise).to.deep.equal([
            { serviceName: service, addresses: [], txtMetadata: {}, connectionTypeSuggestion: 'remote-v2' },
        ]);
        cleanupWasComplete(scan);
    });

    it('sanitizes TXT metadata and omits malformed optional MAC values', async () => {
        const scan = scanner();
        const service = `Shield.${ANDROID_TV_REMOTE_SERVICE}`;
        const host = 'living-room.local.';
        scan.sockets[0].emit(
            'message',
            response([
                rr(ANDROID_TV_REMOTE_SERVICE, 12, wireName(service)),
                rr(service, 16, txt('fn=Living\u0000 Room', 'bt=not-a-mac', '__proto__=safe')),
                rr(service, 33, srv(host, 6466)),
            ]),
        );
        scan.finish();

        const [device] = await scan.promise;
        expect(device.deviceName).to.equal('Living Room');
        expect(device.macAddress).to.equal(undefined);
        expect(Object.prototype.hasOwnProperty.call(device.txtMetadata, '__proto__')).to.equal(true);
        expect(({} as Record<string, string>).safe).to.equal(undefined);
    });

    it('bounds TXT metadata accumulated across response packets', async () => {
        const scan = scanner();
        const manyEntries = `Many.${ANDROID_TV_REMOTE_SERVICE}`;
        const largeEntries = `Large.${ANDROID_TV_REMOTE_SERVICE}`;
        scan.sockets[0].emit(
            'message',
            response([
                rr(ANDROID_TV_REMOTE_SERVICE, 12, wireName(manyEntries)),
                rr(ANDROID_TV_REMOTE_SERVICE, 12, wireName(largeEntries)),
            ]),
        );
        for (let index = 0; index < 70; index++) {
            scan.sockets[0].emit('message', response([rr(manyEntries, 16, txt(`k${index}=v`))]));
        }
        for (let index = 0; index < 30; index++) {
            scan.sockets[0].emit('message', response([rr(largeEntries, 16, txt(`w${index}=${'x'.repeat(240)}`))]));
        }
        scan.finish();

        const devices = await scan.promise;
        const manyTxt = devices.find(device => device.serviceName === manyEntries)?.txtMetadata ?? {};
        const largeTxt = devices.find(device => device.serviceName === largeEntries)?.txtMetadata ?? {};
        expect(Object.keys(manyTxt).length).to.be.lessThan(70);
        expect(Object.keys(largeTxt).length).to.be.lessThan(30);
        cleanupWasComplete(scan);
    });

    it('deduplicates repeated services and devices sharing a hostname or IP address', () => {
        const [device] = deduplicateAndroidTvs([
            {
                serviceName: `Living room.${ANDROID_TV_REMOTE_SERVICE}`,
                hostname: 'living-room.local.',
                address: '192.168.1.42',
                addresses: ['192.168.1.42'],
                txtMetadata: {},
                connectionTypeSuggestion: 'remote-v2',
            },
            {
                serviceName: `Living room.${ANDROID_TV_REMOTE_SERVICE}`,
                addresses: [],
                txtMetadata: { fn: 'TV' },
                deviceName: 'TV',
                connectionTypeSuggestion: 'remote-v2',
            },
            {
                serviceName: `Second service.${ANDROID_TV_REMOTE_SERVICE}`,
                hostname: 'other.local.',
                address: '192.168.1.42',
                addresses: ['192.168.1.42'],
                txtMetadata: {},
                connectionTypeSuggestion: 'remote-v2',
            },
        ]);
        expect(device.serviceName).to.equal(`Living room.${ANDROID_TV_REMOTE_SERVICE}`);
        expect(device.deviceName).to.equal('TV');
        expect(device.addresses).to.deep.equal(['192.168.1.42']);
        expect(
            deduplicateAndroidTvs([
                {
                    serviceName: `One.${ANDROID_TV_REMOTE_SERVICE}`,
                    addresses: [],
                    txtMetadata: {},
                    connectionTypeSuggestion: 'remote-v2',
                },
                {
                    serviceName: `One.${ANDROID_TV_REMOTE_SERVICE}`,
                    addresses: [],
                    txtMetadata: {},
                    connectionTypeSuggestion: 'remote-v2',
                },
            ]),
        ).to.have.length(1);

        const aliasChain = deduplicateAndroidTvs([
            {
                serviceName: `One.${ANDROID_TV_REMOTE_SERVICE}`,
                hostname: 'first.local.',
                address: '192.168.1.42',
                addresses: ['192.168.1.42'],
                txtMetadata: {},
                connectionTypeSuggestion: 'remote-v2',
            },
            {
                serviceName: `Two.${ANDROID_TV_REMOTE_SERVICE}`,
                hostname: 'alias.local.',
                address: '192.168.1.42',
                addresses: ['192.168.1.42'],
                txtMetadata: {},
                connectionTypeSuggestion: 'remote-v2',
            },
            {
                serviceName: `Three.${ANDROID_TV_REMOTE_SERVICE}`,
                hostname: 'alias.local.',
                address: '192.168.1.43',
                addresses: ['192.168.1.43'],
                txtMetadata: {},
                connectionTypeSuggestion: 'remote-v2',
            },
        ]);
        expect(aliasChain).to.have.length(1);
        expect(excludeConfiguredAndroidTvs(aliasChain, ['alias.local'])).to.deep.equal([]);
    });

    it('filters configured hostnames and canonical IPv6 addresses', () => {
        const configured: DiscoveredAndroidTv[] = [
            {
                serviceName: `Living room.${ANDROID_TV_REMOTE_SERVICE}`,
                hostname: 'living-room.local.',
                address: '192.168.1.42',
                addresses: ['192.168.1.42', '2001:db8::1'],
                txtMetadata: {},
                connectionTypeSuggestion: 'remote-v2',
            },
            {
                serviceName: `Bedroom.${ANDROID_TV_REMOTE_SERVICE}`,
                address: '192.168.1.43',
                addresses: ['192.168.1.43'],
                txtMetadata: {},
                connectionTypeSuggestion: 'remote-v2',
            },
        ];
        expect(excludeConfiguredAndroidTvs(configured, ['LIVING-ROOM.local', '192.168.1.43'])).to.deep.equal([]);
        expect(excludeConfiguredAndroidTvs(configured, ['2001:0db8:0000:0000:0000:0000:0000:0001'])).to.deep.equal([
            configured[1],
        ]);
    });

    it('chooses a usable IPv4/IPv6/hostname and rejects unsafe DNS host labels', () => {
        const base: DiscoveredAndroidTv = {
            serviceName: `Shield.${ANDROID_TV_REMOTE_SERVICE}`,
            hostname: 'living-room.local.',
            address: 'not-an-ip',
            addresses: ['not-an-ip'],
            txtMetadata: {},
            connectionTypeSuggestion: 'remote-v2',
        };
        expect(getDiscoveredDeviceHost(base)).to.equal('living-room.local');
        expect(getDiscoveredDeviceHost({ ...base, hostname: 'bad host.local.' })).to.equal(undefined);
        expect(getDiscoveredDeviceHost({ ...base, addresses: ['2001:db8::1'] })).to.equal('2001:db8::1');
        expect(getDiscoveredDeviceHost({ ...base, address: 'fe80::1', addresses: ['fe80::1'] })).to.equal(
            'living-room.local',
        );
        expect(getDiscoveredDeviceHost({ ...base, hostname: '', address: 'fe80::1', addresses: ['fe80::1'] })).to.equal(
            undefined,
        );
    });

    it('continues after a socket error in one family', async () => {
        const errors: string[] = [];
        const scan = scanner({ onError: (family, error) => errors.push(`${family}: ${error.message}`) });
        scan.sockets[0].emit('error', new Error('IPv4 bind failed'));
        scan.sockets[1].emit('message', response(validRecords()));
        scan.finish();

        expect(await scan.promise).to.have.length(1);
        expect(errors).to.deep.equal(['udp4: IPv4 bind failed']);
        cleanupWasComplete(scan);
    });

    it('cleans up sockets and timer on cancellation', async () => {
        const controller = new AbortController();
        const scan = scanner({ signal: controller.signal });
        controller.abort();

        expect(await scan.promise).to.deep.equal([]);
        cleanupWasComplete(scan);
    });

    it('cleans up sockets and timer on timeout and ignores late packets', async () => {
        const scan = scanner();
        scan.finish();
        scan.sockets[0].emit('message', response(validRecords()));

        expect(await scan.promise).to.deep.equal([]);
        cleanupWasComplete(scan);
        scan.finish();
        expect(scan.sockets.every(socket => socket.closed)).to.equal(true);
    });
});
