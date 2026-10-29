import { expect } from 'chai';
import { createPublicKey, publicDecrypt, constants as cryptoConstants } from 'node:crypto';
import { once } from 'node:events';
import * as net from 'node:net';
import type { AddressInfo } from 'node:net';
import { adbPublicKeyPayload, generateAdbKey, signAdbToken } from './auth';
import { AdbClient, parseBanner } from './client';
import { AdbDevice } from './device';
import {
    parseMediaSessions,
    parsePollOutput,
    parseResumedActivity,
    parseWakefulness,
    SECTION_SEPARATOR,
    shellQuote,
} from './parsers';
import { AdbAuthType, AdbCommand, AdbPacketDecoder, encodeAdbPacket, type AdbPacket } from './protocol';

const key = generateAdbKey();
const BANNER =
    'device::ro.product.name=darcy;ro.product.model=SHIELD Android TV;ro.product.device=darcy;features=shell_v2,cmd\0';

const MEDIA_PLAYING = [
    '    package=com.google.android.youtube.tv',
    '    active=false',
    '    state=PlaybackState {state=2, position=1000, buffered position=0, speed=0.0, updated=1, actions=0}',
    '    metadata: size=3, description=Old video, Some channel, null',
    '    package=com.netflix.ninja',
    '    active=true',
    '    state=PlaybackState {state=3, position=754321, buffered position=0, speed=1.0, updated=99, actions=0}',
    '    metadata: size=5, description=Stranger Things, Chapter One: The Vanishing, null',
].join('\n');

/**
 * Decodes the mincrypt RSAPublicKey struct and returns modulus, n0inv, rr and exponent.
 *
 * @param payload - AUTH(RSAPUBLICKEY) payload
 */
function decodeAndroidKey(payload: Buffer): { n: bigint; n0inv: number; rr: bigint; e: number; name: string } {
    const text = payload.subarray(0, payload.length - 1).toString('utf8');
    const [b64, name] = text.split(' ');
    const s = Buffer.from(b64, 'base64');
    const words = s.readUInt32LE(0);
    const read = (offset: number): bigint => {
        let v = 0n;
        for (let i = words - 1; i >= 0; i--) {
            v = (v << 32n) + BigInt(s.readUInt32LE(offset + i * 4));
        }
        return v;
    };
    return { n0inv: s.readUInt32LE(4), n: read(8), rr: read(8 + words * 4), e: s.readUInt32LE(8 + words * 8), name };
}

interface MockOptions {
    /** Accept the signature immediately (key already authorized on the device) */
    authorized: boolean;
    /** Shell command → output */
    shell: (cmd: string) => string;
}

/**
 * Minimal adbd: AUTH token/signature/public key, CNXN banner and shell streams with flow control.
 *
 * @param opts - Behaviour of the simulated device
 */
async function startAdbd(
    opts: MockOptions,
): Promise<{ server: net.Server; port: number; received: string[]; publicKey: Buffer[] }> {
    const received: string[] = [];
    const publicKey: Buffer[] = [];
    const server = net.createServer(socket => {
        const decoder = new AdbPacketDecoder();
        const token = Buffer.alloc(20, 7);
        const send = (p: AdbPacket): boolean => socket.write(encodeAdbPacket(p));
        let nextRemote = 100;
        socket.on('error', () => undefined);
        socket.on('data', chunk => {
            for (const p of decoder.push(chunk)) {
                if (p.command === AdbCommand.CNXN) {
                    send({ command: AdbCommand.AUTH, arg0: AdbAuthType.TOKEN, arg1: 0, payload: token });
                } else if (p.command === AdbCommand.AUTH && p.arg0 === AdbAuthType.SIGNATURE) {
                    const digest = publicDecrypt(
                        { key: createPublicKey(key.privateKey), padding: cryptoConstants.RSA_PKCS1_PADDING },
                        p.payload,
                    );
                    const valid = digest.subarray(-20).equals(token);
                    if (opts.authorized && valid) {
                        send({ command: AdbCommand.CNXN, arg0: 0x01000001, arg1: 4096, payload: Buffer.from(BANNER) });
                    } else {
                        send({ command: AdbCommand.AUTH, arg0: AdbAuthType.TOKEN, arg1: 0, payload: token });
                    }
                } else if (p.command === AdbCommand.AUTH && p.arg0 === AdbAuthType.RSAPUBLICKEY) {
                    publicKey.push(p.payload);
                    // user confirms the dialog on the TV
                    setTimeout(
                        () =>
                            send({
                                command: AdbCommand.CNXN,
                                arg0: 0x01000001,
                                arg1: 4096,
                                payload: Buffer.from(BANNER),
                            }),
                        50,
                    );
                } else if (p.command === AdbCommand.OPEN) {
                    const local = p.arg0;
                    const remote = nextRemote++;
                    const cmd = p.payload
                        .toString('utf8')
                        .replace(/\0$/, '')
                        .replace(/^shell:/, '');
                    received.push(cmd);
                    send({ command: AdbCommand.OKAY, arg0: remote, arg1: local, payload: Buffer.alloc(0) });
                    const out = Buffer.from(opts.shell(cmd));
                    // send in two chunks to exercise WRTE/OKAY flow control
                    const half = Math.floor(out.length / 2);
                    send({ command: AdbCommand.WRTE, arg0: remote, arg1: local, payload: out.subarray(0, half) });
                    send({ command: AdbCommand.WRTE, arg0: remote, arg1: local, payload: out.subarray(half) });
                    send({ command: AdbCommand.CLSE, arg0: remote, arg1: local, payload: Buffer.alloc(0) });
                }
            }
        });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return { server, port: (server.address() as AddressInfo).port, received, publicKey };
}

describe('adb protocol', () => {
    it('round-trips packets split at arbitrary positions', () => {
        const a = encodeAdbPacket({ command: AdbCommand.WRTE, arg0: 1, arg1: 2, payload: Buffer.from('hello') });
        const b = encodeAdbPacket({ command: AdbCommand.CLSE, arg0: 1, arg1: 2, payload: Buffer.alloc(0) });
        const all = Buffer.concat([a, b]);
        const dec = new AdbPacketDecoder();
        const got: AdbPacket[] = [];
        for (let i = 0; i < all.length; i++) {
            got.push(...dec.push(all.subarray(i, i + 1)));
        }
        expect(got.map(p => p.command)).to.deep.equal([AdbCommand.WRTE, AdbCommand.CLSE]);
        expect(got[0].payload.toString()).to.equal('hello');
    });

    it('rejects packets with a wrong magic', () => {
        const bad = encodeAdbPacket({ command: AdbCommand.OKAY, arg0: 0, arg1: 0, payload: Buffer.alloc(0) });
        bad.writeUInt32LE(0, 20);
        expect(() => new AdbPacketDecoder().push(bad)).to.throw(/magic/);
    });

    it('creates a mathematically valid Android public key', () => {
        const k = decodeAndroidKey(adbPublicKeyPayload(key, 'ioBroker@androidtv'));
        const jwk = createPublicKey(key.privateKey).export({ format: 'jwk' });
        const n = BigInt(`0x${Buffer.from(jwk.n!, 'base64url').toString('hex')}`);
        expect(k.n).to.equal(n);
        expect(k.e).to.equal(65537);
        expect(k.name).to.equal('ioBroker@androidtv');
        expect((BigInt(k.n0inv) * (n % 2n ** 32n)) % 2n ** 32n).to.equal(2n ** 32n - 1n); // n0inv * n0 ≡ -1
        expect(k.rr).to.equal((1n << 4096n) % n);
    });

    it('signs the token so that it verifies as SHA-1 DigestInfo', () => {
        const token = Buffer.alloc(20, 3);
        const plain = publicDecrypt(
            { key: createPublicKey(key.privateKey), padding: cryptoConstants.RSA_PKCS1_PADDING },
            signAdbToken(key, token),
        );
        expect(plain.toString('hex')).to.equal(`3021300906052b0e03021a05000414${token.toString('hex')}`);
    });

    it('parses the CNXN banner', () => {
        expect(parseBanner(BANNER)).to.deep.equal({ model: 'SHIELD Android TV', product: 'darcy', device: 'darcy' });
    });
});

describe('adb parsers', () => {
    it('parses wakefulness incl. screensaver', () => {
        expect(parseWakefulness('  mWakefulness=Awake')).to.equal(true);
        expect(parseWakefulness('  mWakefulness=Dreaming')).to.equal(true);
        expect(parseWakefulness('  mWakefulness=Asleep')).to.equal(false);
        expect(parseWakefulness('')).to.equal(undefined);
    });

    it('parses resumed activity in old and new format', () => {
        expect(
            parseResumedActivity('  mResumedActivity: ActivityRecord{6d5c u0 com.netflix.ninja/.MainActivity t12}'),
        ).to.equal('com.netflix.ninja');
        expect(
            parseResumedActivity('  topResumedActivity=ActivityRecord{1a2b3c u0 org.xbmc.kodi/.Splash t7}'),
        ).to.equal('org.xbmc.kodi');
    });

    it('prefers the playing session and extracts title, subtitle and position', () => {
        expect(parseMediaSessions(MEDIA_PLAYING)).to.deep.equal({
            app: 'com.netflix.ninja',
            state: 'play',
            title: 'Stranger Things',
            subtitle: 'Chapter One: The Vanishing',
            position: 754,
        });
        expect(parseMediaSessions('')).to.equal(null);
    });

    it('parses the combined poll output and skips details while asleep', () => {
        const awake = [
            '  mWakefulness=Awake',
            SECTION_SEPARATOR,
            '  topResumedActivity=ActivityRecord{1 u0 com.netflix.ninja/.MainActivity t1}',
            SECTION_SEPARATOR,
            MEDIA_PLAYING,
        ].join('\n');
        const r = parsePollOutput(awake);
        expect(r.awake).to.equal(true);
        expect(r.currentApp).to.equal('com.netflix.ninja');
        expect(r.media?.state).to.equal('play');
        expect(parsePollOutput('  mWakefulness=Asleep\n')).to.deep.equal({ awake: false });
    });

    it('quotes shell arguments safely', () => {
        expect(shellQuote("it's")).to.equal(`'it'\\''s'`);
    });
});

describe('adb client with a simulated device', () => {
    it('authenticates with the public key (first connection) and runs shell commands', async () => {
        const adbd = await startAdbd({ authorized: false, shell: cmd => `out:${cmd}` });
        const client = new AdbClient({
            host: '127.0.0.1',
            port: adbd.port,
            key,
            keyName: 'ioBroker@test',
            reconnectMaxMs: 5000,
        });
        try {
            const pending = once(client, 'authPending');
            const ready = once(client, 'ready');
            client.start();
            await pending;
            const [info] = await ready;
            expect(info.model).to.equal('SHIELD Android TV');
            expect(adbd.publicKey).to.have.length(1);
            expect(decodeAndroidKey(adbd.publicKey[0]).name).to.equal('ioBroker@test');
            const results = await Promise.all([client.shell('echo a'), client.shell('echo b')]);
            expect(results).to.deep.equal(['out:echo a', 'out:echo b']);
        } finally {
            client.stop();
            adbd.server.close();
        }
    });

    it('uses the signature directly when the key is already authorized', async () => {
        const adbd = await startAdbd({ authorized: true, shell: () => 'ok' });
        const client = new AdbClient({ host: '127.0.0.1', port: adbd.port, key, keyName: 'x', reconnectMaxMs: 5000 });
        try {
            let pending = false;
            client.on('authPending', () => (pending = true));
            client.start();
            await once(client, 'ready');
            expect(pending).to.equal(false);
            expect(await client.shell('true')).to.equal('ok');
        } finally {
            client.stop();
            adbd.server.close();
        }
    });

    it('polls status and sends commands through AdbDevice', async () => {
        const adbd = await startAdbd({
            authorized: true,
            shell: cmd => {
                if (cmd.startsWith('w=$(dumpsys power')) {
                    return [
                        'mWakefulness=Awake',
                        SECTION_SEPARATOR,
                        'topResumedActivity=ActivityRecord{1 u0 com.netflix.ninja/.MainActivity t1}',
                        SECTION_SEPARATOR,
                        MEDIA_PLAYING,
                    ].join('\n');
                }
                if (cmd.startsWith('monkey')) {
                    return 'Events injected: 1';
                }
                return '';
            },
        });
        const device = new AdbDevice({
            host: '127.0.0.1',
            port: adbd.port,
            key,
            keyName: 'x',
            pollIntervalMs: 60_000,
            reconnectMaxMs: 5000,
            externalPower: () => undefined,
        });
        try {
            const poll = once(device, 'poll');
            device.start();
            const [result] = await poll;
            expect(result.media.title).to.equal('Stranger Things');
            await device.launch('org.xbmc.kodi');
            await device.launch('https://www.netflix.com/title/80057281');
            await device.setPower(false);
            await device.sendKey('HOME');
            await device.sendText('hello world');
            expect(adbd.received).to.include.members([
                'monkey -p org.xbmc.kodi -c android.intent.category.LEANBACK_LAUNCHER 1',
                "am start -a android.intent.action.VIEW -d 'https://www.netflix.com/title/80057281'",
                'input keyevent 223',
                'input keyevent 3',
                "input text 'hello%sworld'",
            ]);
            await device.launch('evil; rm -rf /').then(
                () => expect.fail('injection accepted'),
                (e: Error) => expect(e.message).to.match(/Invalid package/),
            );
        } finally {
            device.stop();
            adbd.server.close();
        }
    });
});
