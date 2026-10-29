import { EventEmitter } from 'node:events';
import * as tls from 'node:tls';
import type { ClientCertificate } from './certificate';
import { KEY_CODES } from './keycodes';
import {
    Feature,
    KeyDirection,
    decodeRemoteMessage,
    encodeAppLink,
    encodeImeText,
    encodeKeyInject,
    encodePingResponse,
    encodeRemoteConfigure,
    encodeRemoteSetActive,
    type KeyDirectionValue,
    type RemoteDeviceInfo,
    type VolumeInfo,
} from './messages';
import { FrameDecoder, frame } from './protobuf';

/** Default remote control port of the Android TV Remote Service. */
export const DEFAULT_REMOTE_PORT = 6466;

/** TV pings every 5 s; three missed pings → the link is dead. */
const IDLE_TIMEOUT_MS = 16_000;
const CONNECT_TIMEOUT_MS = 5_000;
const RECONNECT_MIN_MS = 2_000;

/** Options for a remote connection. */
export interface RemoteOptions {
    /** IP address or hostname of the TV */
    host: string;
    /** TCP port of the TV service */
    port?: number;
    /** Client certificate used for mutual TLS */
    certificate: ClientCertificate;
    /** Request IME feature (needed for current app and text input). */
    enableIme: boolean;
    /** Upper bound for the reconnect backoff in ms. */
    reconnectMaxMs: number;
}

/** Events emitted by {@link RemoteConnection}. */
export interface RemoteEvents {
    /** TV accepted the connection and is ready for commands. */
    ready: [deviceInfo: RemoteDeviceInfo, peerCertificate: Buffer | undefined];
    /** Connection lost (will reconnect automatically unless stopped). */
    disconnected: [reason: string];
    /** TLS handshake was refused - the client certificate is not paired. */
    unpaired: [];
    /** Screen on/off. */
    power: [on: boolean];
    /** Foreground app changed (package name) */
    currentApp: [appPackage: string];
    /** Volume or mute state changed */
    volume: [volume: VolumeInfo];
    /** Non-fatal problems worth a debug/warn log. */
    log: [level: 'debug' | 'warn', message: string];
}

/**
 * Persistent, self-healing connection to the remote port of one TV.
 * Event-driven: no polling, the TV pushes power/app/volume changes.
 */
export class RemoteConnection extends EventEmitter<RemoteEvents> {
    private socket: tls.TLSSocket | undefined;
    private readonly decoder = new FrameDecoder();
    private idleTimer: NodeJS.Timeout | undefined;
    private reconnectTimer: NodeJS.Timeout | undefined;
    private reconnectDelay = RECONNECT_MIN_MS;
    private running = false;
    private activeFeatures: number;
    private imeCounter = 0;
    private fieldCounter = 0;
    private ready = false;

    /** Last known screen state, undefined until the TV reported it. */
    public isOn: boolean | undefined;

    /** @param options - Connection options */
    public constructor(private readonly options: RemoteOptions) {
        super();
        this.activeFeatures =
            Feature.PING |
            Feature.KEY |
            Feature.POWER |
            Feature.VOLUME |
            Feature.APP_LINK |
            (options.enableIme ? Feature.IME : 0);
    }

    /** Whether commands can be sent. */
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
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        this.teardown();
    }

    /** Drops the current connection and reconnects immediately (e.g. after a new pairing). */
    public restart(): void {
        this.stop();
        this.reconnectDelay = RECONNECT_MIN_MS;
        this.authFailures = 0;
        this.unpairedReported = false;
        this.start();
    }

    /**
     * Sends a key press.
     *
     * @param key - Key name without `KEYCODE_` prefix (case-insensitive) or numeric key code
     * @param direction - SHORT (default), START_LONG or END_LONG
     */
    public sendKey(key: string | number, direction: KeyDirectionValue = KeyDirection.SHORT): void {
        const code = typeof key === 'number' ? key : resolveKeyCode(key);
        if (code === undefined) {
            throw new Error(`Unknown key "${key}"`);
        }
        this.send(encodeKeyInject(code, direction));
    }

    /**
     * Launches an app by deep link or package name.
     *
     * @param appLinkOrPackage - URL (e.g. https://www.netflix.com/title) or package (org.xbmc.kodi)
     */
    public launchApp(appLinkOrPackage: string): void {
        const target = appLinkOrPackage.trim();
        if (!target) {
            throw new Error('App link must not be empty');
        }
        const link = /^[a-z][a-z0-9+.-]*:/i.test(target) ? target : `market://launch?id=${target}`;
        this.send(encodeAppLink(link));
    }

    /**
     * Types text into the focused input field (requires IME).
     *
     * @param text - Text
     */
    public sendText(text: string): void {
        if (!text) {
            throw new Error('Text must not be empty');
        }
        if (!(this.activeFeatures & Feature.IME)) {
            throw new Error('Text input requires the IME option');
        }
        this.send(encodeImeText(text, this.imeCounter, this.fieldCounter));
    }

    private send(payload: Buffer): void {
        if (!this.ready || !this.socket || this.socket.destroyed) {
            throw new Error('Not connected to the TV');
        }
        this.socket.write(frame(payload));
        this.armIdleTimer();
    }

    private write(payload: Buffer): void {
        this.socket?.write(frame(payload));
    }

    private connect(): void {
        this.decoder.reset();
        this.receivedAny = false;
        const socket = tls.connect({
            host: this.options.host,
            port: this.options.port ?? DEFAULT_REMOTE_PORT,
            cert: this.options.certificate.cert,
            key: this.options.certificate.key,
            // @KI_HINWEIS: TV-Zertifikat ist selbstsigniert; die Gegenseite prüft unser Client-Zertifikat (mTLS).
            rejectUnauthorized: false,
            timeout: CONNECT_TIMEOUT_MS,
        });
        this.socket = socket;
        let secured = false;
        let tlsRejected = false;

        socket.once('timeout', () => {
            if (!secured) {
                socket.destroy(new Error('connect timeout'));
            }
        });
        socket.once('secureConnect', () => {
            secured = true;
            this.peerCertificate = socket.getPeerCertificate(true)?.raw;
            socket.setTimeout(0);
            socket.setKeepAlive(true, 10_000);
            this.armIdleTimer();
        });
        socket.on('data', chunk => this.onData(chunk));
        socket.on('error', (err: Error & { code?: string }) => {
            if (/alert|handshake|certificate|SSL/i.test(err.message)) {
                tlsRejected = true;
            }
            this.emit('log', 'debug', `${this.options.host}: socket error ${err.code ?? ''} ${err.message}`);
        });
        socket.once('close', () => {
            // @KI_HINWEIS: Ein nicht gekoppelter Client wird je nach TLS-Version unterschiedlich abgewiesen:
            // TLS 1.2 bricht den Handshake mit Alert ab, bei TLS 1.3 meldet der Client den Handshake als
            // erfolgreich und der TV schließt danach. Gemeinsames Merkmal: Verbindung endet, ohne dass der TV
            // eine einzige Nachricht gesendet hat (ein gekoppelter TV sendet sofort remote_configure).
            const authFailure = tlsRejected || (secured && !this.receivedAny);
            this.onClose(authFailure);
        });
    }

    private receivedAny = false;
    private authFailures = 0;
    private unpairedReported = false;
    private peerCertificate: Buffer | undefined;

    private onClose(authFailure: boolean): void {
        const wasReady = this.ready;
        this.teardown();
        if (wasReady) {
            this.emit('disconnected', 'connection closed');
        }
        if (!this.running) {
            return;
        }
        const maxDelay = Math.max(this.options.reconnectMaxMs, RECONNECT_MIN_MS);
        this.authFailures = authFailure ? this.authFailures + 1 : 0;
        let delay: number;
        if (this.authFailures >= 2) {
            // @KI_HINWEIS: Nicht dauerhaft aufgeben (Fehlalarm z. B. beim Neustart des TV möglich), aber nur noch
            // im maximalen Intervall versuchen. Nach erfolgreicher Kopplung ruft der Adapter restart() auf.
            if (!this.unpairedReported) {
                this.unpairedReported = true;
                this.emit('unpaired');
            }
            delay = maxDelay;
        } else {
            delay = wasReady ? RECONNECT_MIN_MS : this.reconnectDelay;
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, maxDelay);
        }
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            if (this.running) {
                this.connect();
            }
        }, delay);
    }

    private teardown(): void {
        clearTimeout(this.idleTimer);
        this.idleTimer = undefined;
        this.ready = false;
        if (this.socket) {
            // @KI_HINWEIS: Alle Listener entfernen, damit ein verspätetes 'close' des alten Sockets nicht die
            // neue Verbindung abbaut (restart). Ein leerer error-Listener verhindert unhandled 'error'.
            const old = this.socket;
            this.socket = undefined;
            old.removeAllListeners();
            old.on('error', () => undefined);
            old.destroy();
        }
    }

    private armIdleTimer(): void {
        clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            this.emit('log', 'debug', `${this.options.host}: idle timeout, reconnecting`);
            this.socket?.destroy();
        }, IDLE_TIMEOUT_MS);
    }

    private onData(chunk: Buffer): void {
        this.receivedAny = true;
        this.armIdleTimer();
        let frames: Buffer[];
        try {
            frames = this.decoder.push(chunk);
        } catch (e) {
            this.emit('log', 'warn', `${this.options.host}: invalid data (${(e as Error).message})`);
            this.socket?.destroy();
            return;
        }
        for (const raw of frames) {
            try {
                this.handleMessage(raw);
            } catch (e) {
                this.emit('log', 'debug', `${this.options.host}: cannot parse message: ${(e as Error).message}`);
            }
        }
    }

    private handleMessage(raw: Buffer): void {
        const msg = decodeRemoteMessage(raw);
        switch (msg.type) {
            case 'configure':
                this.activeFeatures &= msg.features;
                if (!(msg.features & Feature.KEY) || !(msg.features & Feature.APP_LINK)) {
                    this.emit(
                        'log',
                        'warn',
                        `${this.options.host}: TV does not offer key/app-link control. Clear the storage of the system app "Android TV Remote Service" on the TV.`,
                    );
                }
                this.write(encodeRemoteConfigure(this.activeFeatures));
                this.deviceInfo = msg.deviceInfo;
                break;
            case 'setActive':
                this.write(encodeRemoteSetActive(this.activeFeatures));
                break;
            case 'start':
                if (!this.ready) {
                    this.ready = true;
                    this.reconnectDelay = RECONNECT_MIN_MS;
                    this.authFailures = 0;
                    this.unpairedReported = false;
                    this.emit('ready', this.deviceInfo, this.peerCertificate);
                }
                this.isOn = msg.started;
                this.emit('power', msg.started);
                break;
            case 'pingRequest':
                this.write(encodePingResponse(msg.val1));
                break;
            case 'imeKeyInject':
                if (msg.appPackage) {
                    this.emit('currentApp', msg.appPackage);
                }
                break;
            case 'imeBatchEdit':
                this.imeCounter = msg.imeCounter;
                this.fieldCounter = msg.fieldCounter;
                break;
            case 'volume':
                this.emit('volume', msg.volume);
                break;
            case 'error':
                this.emit('log', 'warn', `${this.options.host}: TV reported an error for the last command`);
                break;
            default:
                this.emit('log', 'debug', `${this.options.host}: unhandled message fields ${msg.fields.join(',')}`);
        }
    }

    private deviceInfo: RemoteDeviceInfo = {};
}

/**
 * Resolves a key name to its code: "home", "KEYCODE_HOME", "Dpad_Up" and "3" are accepted.
 *
 * @param key - Key name or numeric string
 */
export function resolveKeyCode(key: string): number | undefined {
    const k = key.trim();
    if (/^\d+$/.test(k)) {
        return Number(k);
    }
    return KEY_CODES[k.toUpperCase().replace(/^KEYCODE_/, '')];
}
