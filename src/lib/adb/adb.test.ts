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
    /** Never answer OPEN (simulates a dead link without FIN) */
    hang?: boolean;
    /** Fixed port (to simulate a device that comes back) */
    port?: number;
}

/**
 * Minimal adbd: AUTH token/signature/public key, CNXN banner and shell streams with flow control.
 *
 * @param opts - Behaviour of the simulated device
 */
async function startAdbd(
    opts: MockOptions,
): Promise<{ server: net.Server; port: number; received: string[]; publicKey: Buffer[]; sockets: Set<net.Socket> }> {
    const received: string[] = [];
    const publicKey: Buffer[] = [];
    const sockets = new Set<net.Socket>();
    const server = net.createServer(socket => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
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
                } else if (p.command === AdbCommand.OPEN && opts.hang) {
                    // dead link: no answer at all
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
    server.listen(opts.port ?? 0, '127.0.0.1');
    await once(server, 'listening');
    return { server, port: (server.address() as AddressInfo).port, received, publicKey, sockets };
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
            '200.50 1000.00',
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

    it('extrapolates the position while playing and keeps commas in titles', () => {
        const text = [
            'package=com.google.android.youtube.tv',
            'active=true',
            'state=PlaybackState {state=3, position=10000, buffered position=0, speed=1.0, updated=100000, actions=0}',
            'metadata: size=4, description=Handball, Folge 1 | Doku, ARTS7, null',
        ].join('\n');
        const m = parseMediaSessions(text, 130_500);
        expect(m?.position).to.equal(41); // 10 s + 30.5 s
        expect(m?.title).to.equal('Handball, Folge 1 | Doku');
        expect(m?.subtitle).to.equal('ARTS7');
        const paused = parseMediaSessions(text.replace('state=3', 'state=2'), 130_500);
        expect(paused?.position).to.equal(10);
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
                        '200.50 1000.00',
                        SECTION_SEPARATOR,
                        'topResumedActivity=ActivityRecord{1 u0 com.netflix.ninja/.MainActivity t1}',
                        SECTION_SEPARATOR,
                        MEDIA_PLAYING,
                    ].join('\n');
                }
                if (cmd.startsWith('monkey')) {
                    return 'Events injected: 1';
                }
                if (
                    cmd.startsWith('cmd package resolve-activity') &&
                    cmd.includes('LEANBACK') &&
                    cmd.endsWith('org.xbmc.kodi')
                ) {
                    return 'priority=0 preferredOrder=0 match=0x108000 specificIndex=-1 isDefault=true\norg.xbmc.kodi/.Splash\n';
                }
                if (cmd.startsWith('cmd package resolve-activity')) {
                    return 'No activity found\n';
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
            await device.sendKey('MEDIA_PLAY_PAUSE');
            await device.launch('com.example.legacy'); // not resolvable → monkey fallback
            expect(adbd.received).to.include.members([
                'am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER -n org.xbmc.kodi/.Splash',
                "am start -a android.intent.action.VIEW -d 'https://www.netflix.com/title/80057281'",
                'input keyevent 223',
                'input keyevent 3',
                "input text 'hello%sworld'",
                'input keyevent 85',
                'monkey -p com.example.legacy -c android.intent.category.LEANBACK_LAUNCHER 1',
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

describe('adb link launch', () => {
    it('starts the app behind a link directly instead of the "Open with" chooser', async () => {
        const adbd = await startAdbd({
            authorized: true,
            shell: cmd => {
                if (cmd.startsWith('cmd package query-activities') && cmd.includes('example.com')) {
                    return 'com.amazon.cloud9/.browsing.BrowserActivity\n';
                }
                if (cmd.startsWith('cmd package query-activities')) {
                    return 'com.amazon.firetv.youtube/com.google.android.apps.youtube.tv.activity.ShellActivity\ncom.amazon.cloud9/.browsing.BrowserActivity\n';
                }
                return 'mWakefulness=Asleep';
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
            device.start();
            await once(device, 'ready');
            await device.launch('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
            expect(adbd.received).to.include(
                "am start -a android.intent.action.VIEW -d 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' -n com.amazon.firetv.youtube/com.google.android.apps.youtube.tv.activity.ShellActivity",
            );
            // a link that only a browser opens is not started (would open the browser on the TV)
            adbd.received.length = 0;
            await device.launch('https://example.com/').then(
                () => expect.fail('browser-only link started'),
                (e: Error) => expect(e.message).to.match(/only a web browser/),
            );
            expect(adbd.received.some(c => c.startsWith('am start'))).to.equal(false);
        } finally {
            device.stop();
            adbd.server.close();
        }
    });
});

describe('adb client: outages', () => {
    it('reconnects after a power loss with debug logs only', async function () {
        this.timeout(10_000);
        const devA = await startAdbd({ authorized: true, shell: () => 'ok' });
        const logs: string[] = [];
        const client = new AdbClient({
            host: '127.0.0.1',
            port: devA.port,
            key,
            keyName: 'x',
            reconnectMaxMs: 400,
            reconnectMinMs: 50,
        });
        client.on('log', (level, msg) => logs.push(`${level}:${msg}`));
        let devB: Awaited<ReturnType<typeof startAdbd>> | undefined;
        try {
            client.start();
            await once(client, 'ready');
            const disconnected = once(client, 'disconnected');
            devA.server.close();
            devA.sockets.forEach(sock => sock.destroy());
            await disconnected;
            await expectReject(client.shell('true'), /not connected/);
            await new Promise(r => setTimeout(r, 1_500));
            const ready = once(client, 'ready');
            devB = await startAdbd({ authorized: true, shell: () => 'back', port: devA.port });
            await ready;
            expect(await client.shell('true')).to.equal('back');
            expect(logs.filter(l => !l.startsWith('debug:'))).to.deep.equal([]);
        } finally {
            client.stop();
            devB?.server.close();
        }
    });

    it('treats a hanging shell as a dead link and reconnects', async function () {
        this.timeout(10_000);
        const dev = await startAdbd({ authorized: true, shell: () => 'ok', hang: true });
        const client = new AdbClient({
            host: '127.0.0.1',
            port: dev.port,
            key,
            keyName: 'x',
            reconnectMaxMs: 400,
            reconnectMinMs: 50,
        });
        try {
            client.start();
            await once(client, 'ready');
            const disconnected = once(client, 'disconnected');
            await expectReject(client.shell('dumpsys power', 300), /timed out/);
            await disconnected;
            await once(client, 'ready'); // reconnected
        } finally {
            client.stop();
            dev.server.close();
        }
    });
});

/**
 * Asserts that a promise rejects with a matching message.
 *
 * @param p - Promise
 * @param pattern - Expected message pattern
 */
async function expectReject(p: Promise<unknown>, pattern: RegExp): Promise<void> {
    await p.then(
        () => expect.fail('expected rejection'),
        (e: Error) => expect(e.message).to.match(pattern),
    );
}
