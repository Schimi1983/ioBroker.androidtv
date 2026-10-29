import { createPublicKey, generateKeyPairSync, privateEncrypt, constants as cryptoConstants } from 'node:crypto';

/** RSA key pair used to authenticate against adbd. */
export interface AdbKey {
    /** PEM encoded PKCS#1 private key */
    privateKey: string;
}

/** ASN.1 DigestInfo prefix for SHA-1 (adbd signs the 20-byte token as if it were a SHA-1 digest). */
const SHA1_DIGEST_INFO = Buffer.from('3021300906052b0e03021a05000414', 'hex');
const MODULUS_WORDS = 64; // 2048 bit

/** Creates a new RSA-2048 key for ADB. */
export function generateAdbKey(): AdbKey {
    const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicExponent: 0x10001,
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    return { privateKey };
}

/**
 * Signs the AUTH token sent by the device (PKCS#1 v1.5 with SHA-1 DigestInfo, token used as digest).
 *
 * @param key - Private key
 * @param token - 20 byte token from AUTH(TOKEN)
 */
export function signAdbToken(key: AdbKey, token: Buffer): Buffer {
    return privateEncrypt(
        { key: key.privateKey, padding: cryptoConstants.RSA_PKCS1_PADDING },
        Buffer.concat([SHA1_DIGEST_INFO, token]),
    );
}

/**
 * Converts a big-endian byte buffer into a BigInt.
 *
 * @param buf - Big-endian bytes
 */
function toBigInt(buf: Buffer): bigint {
    return BigInt(`0x${buf.toString('hex') || '0'}`);
}

/**
 * Public key in the format adbd expects for AUTH(RSAPUBLICKEY): base64 of the mincrypt `RSAPublicKey`
 * struct (len, n0inv, n[], rr[], e – all little-endian uint32), followed by " <name>" and a NUL byte.
 *
 * @param key - Key pair
 * @param name - Comment shown on the TV in the authorization dialog, e.g. "ioBroker@androidtv"
 */
export function adbPublicKeyPayload(key: AdbKey, name: string): Buffer {
    const jwk = createPublicKey(key.privateKey).export({ format: 'jwk' });
    if (!jwk.n || !jwk.e) {
        throw new Error('Not an RSA key');
    }
    const n = toBigInt(Buffer.from(jwk.n, 'base64url'));
    const e = Number(toBigInt(Buffer.from(jwk.e, 'base64url')));
    const word = 1n << 32n;

    // n0inv = -1 / n[0] mod 2^32
    const n0 = n % word;
    let inv = 1n;
    for (let i = 0; i < 6; i++) {
        // Newton iteration for the inverse mod 2^32 (doubles the correct bits each round; 6 rounds ≥ 32 bit)
        const t = (n0 * inv) % word;
        inv = (inv * ((2n + word - t) % word)) % word;
    }
    const n0inv = (word - inv) % word;
    // rr = (2^(32*words))^2 mod n
    const rr = (1n << BigInt(2 * 32 * MODULUS_WORDS)) % n;

    const struct = Buffer.alloc(4 + 4 + MODULUS_WORDS * 4 * 2 + 4);
    let offset = 0;
    struct.writeUInt32LE(MODULUS_WORDS, offset);
    offset += 4;
    struct.writeUInt32LE(Number(n0inv), offset);
    offset += 4;
    for (const value of [n, rr]) {
        let v = value;
        for (let i = 0; i < MODULUS_WORDS; i++) {
            struct.writeUInt32LE(Number(v % word), offset);
            v /= word;
            offset += 4;
        }
    }
    struct.writeUInt32LE(e, offset);
    return Buffer.concat([Buffer.from(`${struct.toString('base64')} ${name}`, 'utf8'), Buffer.from([0])]);
}
