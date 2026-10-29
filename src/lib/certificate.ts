import { X509Certificate, createHash, generateKeyPairSync } from 'node:crypto';
import forge from 'node-forge';

/** Client identity used for TLS client authentication towards the TV. */
export interface ClientCertificate {
    /** PEM encoded X.509 certificate */
    cert: string;
    /** PEM encoded RSA private key (PKCS#1) */
    key: string;
}

/** RSA public key parts, hex encoded without leading zeros. */
export interface RsaPublicParts {
    /** RSA modulus (hex) */
    modulus: string;
    /** RSA public exponent (hex) */
    exponent: string;
}

// @KI_HINWEIS: Schlüsselerzeugung über node:crypto (nativ, ~50 ms) statt forge (reines JS, mehrere
// Sekunden auf einem Raspberry Pi). forge wird nur zum Bauen und Signieren des Zertifikats genutzt,
// weil node:crypto keine X.509-Zertifikate erzeugen kann.
/**
 * Generates a self-signed RSA-2048 client certificate (valid 10 years).
 *
 * @param commonName - Subject CN, e.g. "ioBroker"
 */
export function generateClientCertificate(commonName: string): ClientCertificate {
    const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicExponent: 0x10001,
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const forgeKey = forge.pki.privateKeyFromPem(privateKey);
    const publicKey = forge.pki.setRsaPublicKey(forgeKey.n, forgeKey.e);

    const cert = forge.pki.createCertificate();
    cert.publicKey = publicKey;
    cert.serialNumber = '01';
    const now = new Date();
    cert.validity.notBefore = new Date(now.getTime() - 24 * 3600 * 1000);
    cert.validity.notAfter = new Date(now.getTime() + 10 * 365 * 24 * 3600 * 1000);
    const attrs = [{ name: 'commonName', value: commonName }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
        { name: 'basicConstraints', cA: true, pathLenConstraint: 0 },
        { name: 'subjectAltName', altNames: [{ type: 2, value: commonName }] },
    ]);
    cert.sign(forgeKey, forge.md.sha256.create());

    return { cert: forge.pki.certificateToPem(cert), key: privateKey };
}

/**
 * Checks that a stored certificate/key pair is parseable and not expired.
 *
 * @param client - Stored identity
 */
export function isUsableCertificate(client: Partial<ClientCertificate> | undefined): client is ClientCertificate {
    if (!client?.cert || !client.key) {
        return false;
    }
    try {
        const x509 = new X509Certificate(client.cert);
        return new Date(x509.validTo).getTime() > Date.now() + 24 * 3600 * 1000;
    } catch {
        return false;
    }
}

/**
 * Normalizes a hex string: uppercase, no leading zeros, even length.
 *
 * @param hex - Hex string, optionally with 0x prefix
 */
function normalizeHex(hex: string): string {
    let h = hex.replace(/^0x/i, '').replace(/^0+/, '').toUpperCase();
    if (h.length % 2 === 1) {
        h = `0${h}`;
    }
    return h;
}

/**
 * Extracts RSA modulus and exponent from a PEM certificate.
 *
 * @param pem - PEM encoded certificate
 */
export function rsaPartsFromPem(pem: string): RsaPublicParts {
    const jwk = new X509Certificate(pem).publicKey.export({ format: 'jwk' });
    if (!jwk.n || !jwk.e) {
        throw new Error('Certificate does not contain an RSA public key');
    }
    return {
        modulus: normalizeHex(Buffer.from(jwk.n, 'base64url').toString('hex')),
        exponent: normalizeHex(Buffer.from(jwk.e, 'base64url').toString('hex')),
    };
}

/**
 * Extracts RSA parts from a DER certificate (e.g. the TV's certificate from the TLS socket).
 *
 * @param der - DER encoded certificate
 */
export function rsaPartsFromDer(der: Buffer): RsaPublicParts {
    return rsaPartsFromPem(new X509Certificate(der).toString());
}

/**
 * Computes the pairing secret: SHA-256 over client modulus, client exponent, server modulus,
 * server exponent and the last 4 hex digits of the PIN. The first byte of the hash must equal
 * the first two hex digits of the PIN, which allows detecting typos before sending.
 *
 * @param client - Client public key parts
 * @param server - TV public key parts
 * @param pin - 6-digit hex PIN shown on the TV
 * @returns the secret, or null if the PIN does not match the certificates (typo)
 */
export function computePairingSecret(client: RsaPublicParts, server: RsaPublicParts, pin: string): Buffer | null {
    const code = pin.trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(code)) {
        throw new Error('PIN must consist of exactly 6 hexadecimal characters');
    }
    const hash = createHash('sha256')
        .update(Buffer.from(client.modulus, 'hex'))
        .update(Buffer.from(client.exponent, 'hex'))
        .update(Buffer.from(server.modulus, 'hex'))
        .update(Buffer.from(server.exponent, 'hex'))
        .update(Buffer.from(code.slice(2), 'hex'))
        .digest();
    return hash[0] === parseInt(code.slice(0, 2), 16) ? hash : null;
}

/**
 * Parses name and MAC address from the subject CN of an Android TV certificate,
 * e.g. "atvremote/darcy/darcy/SHIELD Android TV/XX:XX:XX:XX:XX:XX".
 *
 * @param der - DER encoded TV certificate
 */
export function parseTvIdentity(der: Buffer): { name: string; mac: string } {
    const subject = new X509Certificate(der).subject;
    const cn = /(?:^|\n)CN=([^\n]*)/.exec(subject)?.[1] ?? '';
    const dnq = /(?:^|\n)dnQualifier=([^\n]*)/.exec(subject)?.[1] ?? '';
    const cnParts = cn.split('/');
    const name = dnq ? (dnq.split('/').at(-1) ?? '') : cnParts.length > 1 ? (cnParts.at(-2) ?? '') : cn;
    const mac = cnParts.at(-1) ?? '';
    return { name, mac: /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac) ? mac.toUpperCase() : '' };
}
