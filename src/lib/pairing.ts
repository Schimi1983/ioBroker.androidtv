import * as tls from 'node:tls';
import { computePairingSecret, rsaPartsFromDer, rsaPartsFromPem, type ClientCertificate } from './certificate';
import {
    PairingStatus,
    decodePairingMessage,
    encodePairingConfiguration,
    encodePairingOptions,
    encodePairingRequest,
    encodePairingSecret,
    type PairingMessageKind,
} from './messages';
import { FrameDecoder, frame } from './protobuf';

/** Default pairing port of the Android TV Remote Service. */
export const DEFAULT_PAIRING_PORT = 6467;

/** Timeout for every handshake step; the TV answers immediately, no human involved. */
const STEP_TIMEOUT_MS = 10_000;

/** Error with a machine-readable reason, forwarded to the admin UI. */
export class PairingError extends Error {
    /**
     * @param code - Reason code (translated in admin)
     * @param message - Technical message
     */
    public constructor(
        public readonly code: 'connect' | 'timeout' | 'closed' | 'rejected' | 'invalidPin' | 'wrongPin',
        message: string,
    ) {
        super(message);
        this.name = 'PairingError';
    }
}

/** Options for a pairing session. */
export interface PairingOptions {
    /** IP address or hostname of the TV */
    host: string;
    /** Pairing port, default 6467 */
    port?: number;
    /** Name shown on the TV during pairing */
    clientName: string;
    /** Client certificate that gets registered on the TV */
    certificate: ClientCertificate;
}

/**
 * One pairing attempt with a TV: `start()` makes the TV show a 6-digit code, `finish(pin)` completes it.
 * The TLS connection stays open between both calls; the TV cancels after roughly one minute.
 */
export class PairingSession {
    private socket: tls.TLSSocket | undefined;
    private readonly decoder = new FrameDecoder();
    private waiter:
        | { expect: PairingMessageKind; resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
        | undefined;
    private closedError: Error | undefined;
    private serverCertificate: Buffer | undefined;

    /** @param options - Connection and identity */
    public constructor(private readonly options: PairingOptions) {}

    /** Whether the TLS connection is still open. */
    public get isOpen(): boolean {
        return !!this.socket && !this.socket.destroyed;
    }

    /** Connects and runs the handshake until the TV displays the code. */
    public async start(): Promise<void> {
        await this.connect();
        this.send(encodePairingRequest(this.options.clientName));
        await this.waitFor('pairingRequestAck');
        this.send(encodePairingOptions());
        await this.waitFor('options');
        this.send(encodePairingConfiguration());
        await this.waitFor('configurationAck');
    }

    /**
     * Sends the secret derived from the PIN and waits for the TV to accept it.
     *
     * @param pin - Code shown on the TV
     */
    public async finish(pin: string): Promise<void> {
        if (!this.socket || this.socket.destroyed) {
            throw new PairingError('closed', 'Pairing connection is closed - start pairing again');
        }
        if (!/^[0-9a-fA-F]{6}$/.test(pin.trim())) {
            throw new PairingError('invalidPin', 'The code must consist of 6 characters (0-9, A-F)');
        }
        const serverDer = this.serverCertificate;
        if (!serverDer) {
            throw new PairingError('closed', 'TV certificate not available');
        }
        const secret = computePairingSecret(
            rsaPartsFromPem(this.options.certificate.cert),
            rsaPartsFromDer(serverDer),
            pin,
        );
        if (!secret) {
            throw new PairingError('wrongPin', 'The code does not match - please check it');
        }
        this.send(encodePairingSecret(secret));
        try {
            await this.waitFor('secretAck');
        } finally {
            this.close();
        }
    }

    /** Closes the connection; pending waits are rejected. */
    public close(): void {
        this.socket?.destroy();
        this.socket = undefined;
    }

    private connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = tls.connect({
                host: this.options.host,
                port: this.options.port ?? DEFAULT_PAIRING_PORT,
                cert: this.options.certificate.cert,
                key: this.options.certificate.key,
                // @KI_HINWEIS: Die TV-Zertifikate sind selbstsigniert; Vertrauen entsteht durch das PIN-Pairing.
                rejectUnauthorized: false,
                timeout: STEP_TIMEOUT_MS,
            });
            this.socket = socket;
            const onError = (err: Error): void => {
                reject(new PairingError('connect', `Cannot connect: ${err.message}`));
            };
            socket.once('error', onError);
            socket.once('timeout', () => socket.destroy(new Error('connect timeout')));
            socket.once('secureConnect', () => {
                socket.off('error', onError);
                // @KI_HINWEIS: TV-Zertifikat direkt nach dem Handshake sichern; ein späterer Abruf am Socket
                // lieferte im Test bei wiederholtem finish() (Tippfehler im Code) undefined.
                this.serverCertificate = socket.getPeerCertificate(true)?.raw;
                socket.setTimeout(0);
                socket.on('data', chunk => this.onData(chunk));
                socket.on('error', err => this.fail(new PairingError('closed', err.message)));
                socket.on('close', () => this.fail(new PairingError('closed', 'Connection closed by TV')));
                resolve();
            });
        });
    }

    private send(payload: Buffer): void {
        this.socket?.write(frame(payload));
    }

    private onData(chunk: Buffer): void {
        let frames: Buffer[];
        try {
            frames = this.decoder.push(chunk);
        } catch (e) {
            this.fail(new PairingError('closed', (e as Error).message));
            return;
        }
        for (const raw of frames) {
            const msg = decodePairingMessage(raw);
            if (msg.status !== PairingStatus.OK) {
                this.fail(new PairingError('rejected', `TV answered with status ${msg.status}`));
                return;
            }
            if (this.waiter && msg.kind === this.waiter.expect) {
                const w = this.waiter;
                this.waiter = undefined;
                clearTimeout(w.timer);
                w.resolve();
            }
        }
    }

    private fail(err: Error): void {
        this.closedError ??= err;
        if (this.waiter) {
            const w = this.waiter;
            this.waiter = undefined;
            clearTimeout(w.timer);
            w.reject(err);
        }
        this.close();
    }

    private waitFor(expect: PairingMessageKind): Promise<void> {
        if (!this.socket || this.socket.destroyed) {
            return Promise.reject(this.closedError ?? new PairingError('closed', 'Connection closed'));
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.waiter = undefined;
                reject(new PairingError('timeout', `No answer from TV (${expect})`));
                this.close();
            }, STEP_TIMEOUT_MS);
            this.waiter = { expect, resolve, reject, timer };
        });
    }
}
