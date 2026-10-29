import { expect } from 'chai';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import * as tls from 'node:tls';
import {
    computePairingSecret,
    generateClientCertificate,
    parseTvIdentity,
    rsaPartsFromDer,
    rsaPartsFromPem,
} from './certificate';
import type { PairingError } from './pairing';
import { PairingSession } from './pairing';
import {
    FrameDecoder,
    MessageWriter,
    decodeMessage,
    decodeVarint,
    encodeVarint,
    frame,
    getBytes,
    getMessage,
    getNumber,
} from './protobuf';
import { RemoteConnection, resolveKeyCode } from './remote';

const client = generateClientCertificate('ioBroker');
const tv = generateClientCertificate('atvremote/darcy/darcy/SHIELD Android TV/AA:BB:CC:DD:EE:FF');

/**
 * Starts a TLS server that behaves like the Android TV Remote Service.
 *
 * @param onSocket - Called per client connection with a frame subscription
 * @param opts - Extra TLS server options
 */
async function startTv(
    onSocket: (socket: tls.TLSSocket, frames: (cb: (m: Map<number, (number | Buffer)[]>) => void) => void) => void,
    opts: Partial<tls.TlsOptions> = {},
): Promise<{ server: tls.Server; port: number }> {
    const server = tls.createServer(
        { cert: tv.cert, key: tv.key, requestCert: true, rejectUnauthorized: false, ...opts },
        socket => {
            const decoder = new FrameDecoder();
            const handlers: ((m: Map<number, (number | Buffer)[]>) => void)[] = [];
            socket.on('data', chunk => {
                for (const raw of decoder.push(chunk)) {
                    const msg = decodeMessage(raw);
                    handlers.forEach(h => h(msg));
                }
            });
            socket.on('error', () => undefined);
            onSocket(socket, cb => handlers.push(cb));
        },
    );
    server.on('tlsClientError', () => undefined);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { server, port: (server.address() as AddressInfo).port };
}

const send = (socket: tls.TLSSocket, w: MessageWriter): boolean => socket.write(frame(w.finish()));
const outer = (): MessageWriter => new MessageWriter().uint(1, 2).uint(2, 200);

describe('protobuf', () => {
    it('round-trips varints incl. multi-byte values', () => {
        for (const v of [0, 1, 127, 128, 300, 16384, 2 ** 31, 2 ** 40]) {
            expect(decodeVarint(encodeVarint(v), 0)?.value).to.equal(v);
        }
    });

    it('decodes nested messages', () => {
        const buf = new MessageWriter().uint(1, 5).message(2, new MessageWriter().string(1, 'abc')).finish();
        const msg = decodeMessage(buf);
        expect(getNumber(msg, 1)).to.equal(5);
        expect(getBytes(getMessage(msg, 2)!, 1)?.toString()).to.equal('abc');
    });

    it('reassembles frames split at arbitrary positions', () => {
        const a = frame(Buffer.alloc(200, 1));
        const b = frame(Buffer.from('xyz'));
        const all = Buffer.concat([a, b]);
        const dec = new FrameDecoder();
        const got: Buffer[] = [];
        for (let i = 0; i < all.length; i++) {
            got.push(...dec.push(all.subarray(i, i + 1)));
        }
        expect(got.map(f => f.length)).to.deep.equal([200, 3]);
    });
});

describe('certificate', () => {
    it('creates a usable RSA-2048 certificate', () => {
        expect(rsaPartsFromPem(client.cert).modulus).to.have.length(512);
        expect(rsaPartsFromPem(client.cert).exponent).to.equal('010001');
    });

    it('accepts only a PIN whose check byte matches', () => {
        const c = rsaPartsFromPem(client.cert);
        const s = rsaPartsFromPem(tv.cert);
        const valid = [...Array(256).keys()]
            .map(b => `${b.toString(16).padStart(2, '0')}ABCD`)
            .filter(p => computePairingSecret(c, s, p));
        expect(valid).to.have.length(1);
        expect(() => computePairingSecret(c, s, '12345')).to.throw();
    });

    it('parses name and MAC of a SHIELD certificate', () => {
        const der = Buffer.from(tv.cert.replace(/-----[^-]+-----|\s/g, ''), 'base64');
        expect(parseTvIdentity(der)).to.deep.equal({ name: 'SHIELD Android TV', mac: 'AA:BB:CC:DD:EE:FF' });
    });

    it('resolves key names', () => {
        expect(resolveKeyCode('home')).to.equal(3);
        expect(resolveKeyCode('KEYCODE_DPAD_UP')).to.equal(19);
        expect(resolveKeyCode('26')).to.equal(26);
        expect(resolveKeyCode('nope')).to.equal(undefined);
    });
});

describe('pairing with a simulated TV', () => {
    it('completes the handshake and sends the correct secret', async () => {
        let pin = '';
        let receivedSecret: Buffer | undefined;
        const { server, port } = await startTv((socket, onMsg) => {
            onMsg(msg => {
                if (msg.has(10)) {
                    send(socket, outer().message(11, new MessageWriter().string(1, 'SHIELD')));
                } else if (msg.has(20)) {
                    send(socket, outer().message(20, new MessageWriter().uint(3, 1)));
                } else if (msg.has(30)) {
                    // TV now displays the code; derive a valid one from both certificates
                    const c = rsaPartsFromDer(socket.getPeerX509Certificate()!.raw);
                    const s = rsaPartsFromPem(tv.cert);
                    for (let b = 0; b < 256 && !pin; b++) {
                        const p = `${b.toString(16).padStart(2, '0').toUpperCase()}1F2E`;
                        if (computePairingSecret(c, s, p)) {
                            pin = p;
                        }
                    }
                    send(socket, outer().message(31, new MessageWriter()));
                } else if (msg.has(40)) {
                    receivedSecret = getBytes(getMessage(msg, 40)!, 1);
                    send(socket, outer().message(41, new MessageWriter().bytes(1, receivedSecret)));
                }
            });
        });
        let session: PairingSession | undefined;
        try {
            session = new PairingSession({
                host: '127.0.0.1',
                port,
                clientName: 'ioBroker',
                certificate: client,
            });
            await session.start();
            const wrong = pin.slice(0, 2) === '00' ? `01${pin.slice(2)}` : `00${pin.slice(2)}`;
            await session.finish(wrong).then(
                () => expect.fail('wrong PIN accepted'),
                (e: PairingError) => expect(e.code).to.equal('wrongPin'),
            );
            await session.finish(pin);
            const expected = computePairingSecret(rsaPartsFromPem(client.cert), rsaPartsFromPem(tv.cert), pin);
            expect(receivedSecret?.equals(expected!)).to.equal(true);
        } finally {
            session?.close();
            server.close();
        }
    });

    it('reports a connection error for a closed port', async () => {
        const session = new PairingSession({ host: '127.0.0.1', port: 1, clientName: 'x', certificate: client });
        await session.start().then(
            () => expect.fail('should fail'),
            (e: PairingError) => expect(e.code).to.equal('connect'),
        );
    });
});

describe('remote connection with a simulated TV', () => {
    it('negotiates, reports state and sends keys and app links', async () => {
        const received: Map<number, (number | Buffer)[]>[] = [];
        const { server, port } = await startTv((socket, onMsg) => {
            send(
                socket,
                new MessageWriter().message(
                    1,
                    new MessageWriter()
                        .uint(1, 0x267)
                        .message(
                            2,
                            new MessageWriter().string(1, 'SHIELD Android TV').string(2, 'NVIDIA').string(6, '5.2'),
                        ),
                ),
            );
            onMsg(msg => {
                received.push(msg);
                if (msg.has(1)) {
                    send(socket, new MessageWriter().message(2, new MessageWriter().uint(1, 0x267)));
                } else if (msg.has(2)) {
                    send(socket, new MessageWriter().message(40, new MessageWriter().bool(1, true)));
                    send(
                        socket,
                        new MessageWriter().message(50, new MessageWriter().uint(6, 100).uint(7, 25).bool(8, false)),
                    );
                    send(
                        socket,
                        new MessageWriter().message(
                            20,
                            new MessageWriter().message(1, new MessageWriter().string(12, 'com.netflix.ninja')),
                        ),
                    );
                }
            });
        });
        const conn = new RemoteConnection({
            host: '127.0.0.1',
            port,
            certificate: client,
            enableIme: true,
            reconnectMaxMs: 5000,
        });
        try {
            const ready = once(conn, 'ready');
            const app = once(conn, 'currentApp');
            const volume = once(conn, 'volume');
            conn.start();
            const [info, peer] = await ready;
            expect(info).to.deep.include({ model: 'SHIELD Android TV', vendor: 'NVIDIA', appVersion: '5.2' });
            expect(parseTvIdentity(peer).mac).to.equal('AA:BB:CC:DD:EE:FF');
            expect((await app)[0]).to.equal('com.netflix.ninja');
            expect((await volume)[0]).to.deep.equal({ level: 25, max: 100, muted: false });
            expect(conn.isOn).to.equal(true);

            conn.sendKey('HOME');
            conn.launchApp('org.xbmc.kodi');
            await new Promise(r => setTimeout(r, 200));
            const key = received.find(m => m.has(10));
            expect(getNumber(getMessage(key!, 10)!, 1)).to.equal(3);
            const link = received.find(m => m.has(90));
            expect(getBytes(getMessage(link!, 90)!, 1)?.toString()).to.equal('market://launch?id=org.xbmc.kodi');
            const cfg = received.find(m => m.has(1));
            expect(getNumber(getMessage(cfg!, 1)!, 1)).to.equal(0x267 & (1 | 2 | 4 | 32 | 64 | 512));
        } finally {
            conn.stop();
            server.close();
        }
    });

    it('emits "unpaired" when the TV rejects the client certificate', async function () {
        this.timeout(10_000);
        // A TV that only trusts its own certificate rejects our unknown client cert during the TLS handshake.
        const { server, port } = await startTv(() => undefined, { rejectUnauthorized: true, ca: [tv.cert] });
        const conn = new RemoteConnection({
            host: '127.0.0.1',
            port,
            certificate: client,
            enableIme: true,
            reconnectMaxMs: 5000,
        });
        try {
            const unpaired = once(conn, 'unpaired');
            conn.start();
            await unpaired;
        } finally {
            conn.stop();
            server.close();
        }
    });
});
