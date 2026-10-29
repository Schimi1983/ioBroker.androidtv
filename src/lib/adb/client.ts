import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import { adbPublicKeyPayload, signAdbToken, type AdbKey } from './auth';
import {
    ADB_MAX_PAYLOAD,
    ADB_VERSION,
    AdbAuthType,
    AdbCommand,
    AdbPacketDecoder,
    commandName,
    encodeAdbPacket,
    type AdbPacket,
} from './protocol';
import { NODE_TIMERS, type TimerHandle, type Timers } from '../timers';

/** Default ADB port for network debugging. */
export const DEFAULT_ADB_PORT = 5555;

const CONNECT_TIMEOUT_MS = 5_000;
const RECONNECT_MIN_MS = 2_000;
const DEFAULT_SHELL_TIMEOUT_MS = 10_000;
/** Without any answer to CNXN (no AUTH, no CNXN) within this time the connection is considered dead. */
const HANDSHAKE_TIMEOUT_MS = 10_000;

/** Device information from the CNXN banner. */
export interface AdbDeviceInfo {
    /** Device model (ro.product.model) */
    model?: string;
    /** Product name (ro.product.name) */
    product?: string;
    /** Device code name (ro.product.device) */
    device?: string;
}

/** Options for {@link AdbClient}. */
export interface AdbClientOptions {
    /** Timer functions (the adapter passes its own so timers are cleared on unload) */
    timers?: Timers;
    /** IP address or hostname */
    host: string;
    /** TCP port, default 5555 */
    port?: number;
    /** RSA key of this ioBroker instance */
    key: AdbKey;
    /** Name shown in the authorization dialog on the TV */
    keyName: string;
    /** Upper bound of the reconnect backoff in ms */
    reconnectMaxMs: number;
    /** First reconnect delay in ms (default 2000; lower values only for tests) */
    reconnectMinMs?: number;
}

/** Events emitted by {@link AdbClient}. */
export interface AdbClientEvents {
    /** Connected and authorized, shell commands can be executed. */
    ready: [info: AdbDeviceInfo];
    /** The device shows the "Allow USB/network debugging?" dialog – the user must confirm it on the TV. */
    authPending: [];
    /** Connection lost (reconnects automatically unless stopped). */
    disconnected: [reason: string];
    /** Diagnostic messages. */
    log: [level: 'debug' | 'warn', message: string];
}

/** Pending shell stream. */
interface ShellStream {
    remoteId: number;
    chunks: Buffer[];
    resolve: (output: string) => void;
    reject: (err: Error) => void;
    timer: TimerHandle | undefined;
}

/**
 * Self-healing ADB connection with RSA authentication and shell command execution.
 * Uses one TCP connection; every shell command is a short-lived ADB stream.
 */
export class AdbClient extends EventEmitter<AdbClientEvents> {
    private socket: net.Socket | undefined;
    private readonly decoder = new AdbPacketDecoder();
    private running = false;
    private ready = false;
    private signatureSent = false;
    private publicKeySent = false;
    private reconnectTimer: TimerHandle | undefined;
    private handshakeTimer: TimerHandle | undefined;
    private reconnectDelay: number;
    private readonly minDelay: number;
    private maxPayload = ADB_MAX_PAYLOAD;
    private nextLocalId = 1;
    private readonly streams = new Map<number, ShellStream>();

    /** Timer functions: injected by the adapter or plain Node timers. */
    private get timers(): Timers {
        return this.options.timers ?? NODE_TIMERS;
    }

    /** @param options - Connection options */
    public constructor(private readonly options: AdbClientOptions) {
        super();
        this.minDelay = options.reconnectMinMs ?? RECONNECT_MIN_MS;
        this.reconnectDelay = this.minDelay;
    }

    /** Whether shell commands can be executed. */
    public get isReady(): boolean {
        return this.ready;
    }

    /** Starts connecting; reconnects automatically until {@link stop} is called. */
    public start(): void {
        if (this.running) {
            return;
        }
        this.running = true;
        this.connect();
    }

    /** Closes the connection and cancels reconnects. */
    public stop(): void {
        this.running = false;
        this.timers.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        this.teardown('stopped');
    }

    /**
     * Executes a shell command and returns its output (stdout and stderr combined).
     *
     * @param command - Shell command line, e.g. "dumpsys media_session"
     * @param timeoutMs - Timeout; on expiry the connection is considered broken and re-established
     */
    public shell(command: string, timeoutMs = DEFAULT_SHELL_TIMEOUT_MS): Promise<string> {
        if (!this.ready || !this.socket) {
            return Promise.reject(new Error('ADB not connected'));
        }
        const localId = this.nextLocalId;
        this.nextLocalId = this.nextLocalId >= 0x7fffffff ? 1 : this.nextLocalId + 1;
        return new Promise((resolve, reject) => {
            const timer = this.timers.setTimeout(() => {
                this.streams.delete(localId);
                reject(
                    new Error(`ADB command timed out: ${command.length > 60 ? `${command.slice(0, 60)}…` : command}`),
                );
                // @KI_HINWEIS: Eine hängende Shell deutet auf eine tote TCP-Verbindung hin (z. B. TV vom Strom
                // getrennt, kein FIN). Verbindung neu aufbauen statt weitere Kommandos ins Leere zu schicken.
                this.socket?.destroy(new Error('shell timeout'));
            }, timeoutMs);
            this.streams.set(localId, { remoteId: 0, chunks: [], resolve, reject, timer });
            this.write(AdbCommand.OPEN, localId, 0, Buffer.from(`shell:${command}\0`, 'utf8'));
        });
    }

    private write(command: number, arg0: number, arg1: number, payload: Buffer = Buffer.alloc(0)): void {
        this.socket?.write(encodeAdbPacket({ command, arg0, arg1, payload }));
    }

    private connect(): void {
        this.decoder.reset();
        this.signatureSent = false;
        this.publicKeySent = false;
        const socket = net.connect({ host: this.options.host, port: this.options.port ?? DEFAULT_ADB_PORT });
        this.socket = socket;
        socket.setNoDelay(true);
        socket.setTimeout(CONNECT_TIMEOUT_MS);
        socket.once('timeout', () => socket.destroy(new Error('connect timeout')));
        socket.once('connect', () => {
            socket.setTimeout(0);
            socket.setKeepAlive(true, 10_000);
            this.write(AdbCommand.CNXN, ADB_VERSION, ADB_MAX_PAYLOAD, Buffer.from('host::\0', 'utf8'));
            this.armHandshakeTimer();
        });
        socket.on('data', chunk => this.onData(chunk));
        socket.on('error', (err: Error & { code?: string }) =>
            this.emit(
                'log',
                'debug',
                `${this.options.host}: ADB socket error: ${[err.code, err.message].filter(Boolean).join(' ')}`,
            ),
        );
        socket.once('close', () => this.onClose());
    }

    private armHandshakeTimer(): void {
        this.timers.clearTimeout(this.handshakeTimer);
        this.handshakeTimer = this.timers.setTimeout(() => {
            this.emit('log', 'debug', `${this.options.host}: no ADB handshake answer, reconnecting`);
            this.socket?.destroy();
        }, HANDSHAKE_TIMEOUT_MS);
    }

    private onClose(): void {
        const wasReady = this.ready;
        this.teardown('connection closed');
        if (wasReady) {
            this.emit('disconnected', 'connection closed');
        }
        if (!this.running) {
            return;
        }
        const delay = wasReady ? this.minDelay : this.reconnectDelay;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, Math.max(this.options.reconnectMaxMs, this.minDelay));
        this.reconnectTimer = this.timers.setTimeout(() => {
            this.reconnectTimer = undefined;
            if (this.running) {
                this.connect();
            }
        }, delay);
    }

    private teardown(reason: string): void {
        this.timers.clearTimeout(this.handshakeTimer);
        this.handshakeTimer = undefined;
        this.ready = false;
        for (const stream of this.streams.values()) {
            this.timers.clearTimeout(stream.timer);
            stream.reject(new Error(`ADB ${reason}`));
        }
        this.streams.clear();
        if (this.socket) {
            // @KI_HINWEIS: Wie in RemoteConnection: Listener entfernen, damit ein verspätetes 'close' des alten
            // Sockets keine neue Verbindung abbaut; leerer error-Listener gegen unhandled 'error'.
            const old = this.socket;
            this.socket = undefined;
            old.removeAllListeners();
            old.on('error', () => undefined);
            old.destroy();
        }
    }

    private onData(chunk: Buffer): void {
        let packets: AdbPacket[];
        try {
            packets = this.decoder.push(chunk);
        } catch (e) {
            this.emit('log', 'warn', `${this.options.host}: ${(e as Error).message}`);
            this.socket?.destroy();
            return;
        }
        for (const packet of packets) {
            this.handlePacket(packet);
        }
    }

    private handlePacket(p: AdbPacket): void {
        switch (p.command) {
            case AdbCommand.AUTH:
                this.handleAuth(p);
                break;
            case AdbCommand.CNXN: {
                this.timers.clearTimeout(this.handshakeTimer);
                this.handshakeTimer = undefined;
                this.maxPayload = Math.min(p.arg1 || ADB_MAX_PAYLOAD, ADB_MAX_PAYLOAD);
                this.ready = true;
                this.reconnectDelay = this.minDelay;
                this.emit('ready', parseBanner(p.payload.toString('utf8')));
                break;
            }
            case AdbCommand.OKAY: {
                const stream = this.streams.get(p.arg1);
                if (stream && !stream.remoteId) {
                    stream.remoteId = p.arg0;
                }
                break;
            }
            case AdbCommand.WRTE: {
                const stream = this.streams.get(p.arg1);
                if (stream) {
                    stream.chunks.push(p.payload);
                }
                // Flow control: every WRTE must be acknowledged, otherwise the device stops sending.
                this.write(AdbCommand.OKAY, p.arg1, p.arg0);
                break;
            }
            case AdbCommand.CLSE: {
                const stream = this.streams.get(p.arg1);
                if (stream) {
                    this.streams.delete(p.arg1);
                    this.timers.clearTimeout(stream.timer);
                    if (stream.remoteId) {
                        this.write(AdbCommand.CLSE, p.arg1, stream.remoteId);
                        stream.resolve(Buffer.concat(stream.chunks).toString('utf8'));
                    } else {
                        // CLSE without prior OKAY = OPEN was rejected (e.g. service unknown)
                        stream.reject(new Error('ADB stream rejected by device'));
                    }
                }
                break;
            }
            default:
                this.emit('log', 'debug', `${this.options.host}: ignoring ADB packet ${commandName(p.command)}`);
        }
    }

    private handleAuth(p: AdbPacket): void {
        if (p.arg0 !== AdbAuthType.TOKEN) {
            return;
        }
        if (!this.signatureSent) {
            this.signatureSent = true;
            this.write(AdbCommand.AUTH, AdbAuthType.SIGNATURE, 0, signAdbToken(this.options.key, p.payload));
            this.armHandshakeTimer();
            return;
        }
        if (!this.publicKeySent) {
            // Signature not accepted → key unknown to the device: send public key, the TV shows a confirmation dialog.
            this.publicKeySent = true;
            this.timers.clearTimeout(this.handshakeTimer);
            this.handshakeTimer = undefined; // the user may need some time to confirm
            this.write(
                AdbCommand.AUTH,
                AdbAuthType.RSAPUBLICKEY,
                0,
                adbPublicKeyPayload(this.options.key, this.options.keyName),
            );
            this.emit('authPending');
        }
    }

    /** Maximum payload size negotiated with the device (for diagnostics). */
    public get negotiatedMaxPayload(): number {
        return this.maxPayload;
    }
}

/**
 * Parses the CNXN banner, e.g. "device::ro.product.name=darcy;ro.product.model=SHIELD Android TV;ro.product.device=darcy;features=…".
 *
 * @param banner - Banner text
 */
export function parseBanner(banner: string): AdbDeviceInfo {
    const props = new Map<string, string>();
    const body = banner.replace(/\0+$/, '').split('::')[1] ?? '';
    for (const part of body.split(';')) {
        const idx = part.indexOf('=');
        if (idx > 0) {
            props.set(part.slice(0, idx), part.slice(idx + 1));
        }
    }
    return {
        model: props.get('ro.product.model'),
        product: props.get('ro.product.name'),
        device: props.get('ro.product.device'),
    };
}
