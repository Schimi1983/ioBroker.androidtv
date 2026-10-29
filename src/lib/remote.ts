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
import { NODE_TIMERS, type TimerHandle, type Timers } from './timers';

/** Default remote control port of the Android TV Remote Service. */
export const DEFAULT_REMOTE_PORT = 6466;

/** TV pings every 5 s; three missed pings → the link is dead. */
const IDLE_TIMEOUT_MS = 16_000;
const CONNECT_TIMEOUT_MS = 5_000;
const RECONNECT_MIN_MS = 2_000;
/** Consecutive TLS alerts (certificate unknown) before the device is reported as unpaired. */
const UNPAIRED_AFTER_ALERTS = 2;
/** Consecutive silent closes (no message at all) before the device is reported as unpaired. */
const UNPAIRED_AFTER_SILENT_CLOSES = 5;

/** Options for a remote connection. */
export interface RemoteOptions {
    /** Timer functions (the adapter passes its own so timers are cleared on unload) */
    timers?: Timers;
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
    /** First reconnect delay in ms (default 2000; lower values only for tests). */
    reconnectMinMs?: number;
    /** Connection is considered dead without any message for this time (default 16000; tests only). */
    idleTimeoutMs?: number;
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
    private idleTimer: TimerHandle | undefined;
    private reconnectTimer: TimerHandle | undefined;
    private reconnectDelay: number;
    private readonly minDelay: number;
    private running = false;
    private activeFeatures: number;
    private imeCounter = 0;
    private fieldCounter = 0;
    private ready = false;

    /** Last known screen state, undefined until the TV reported it. */
    public isOn: boolean | undefined;

    /** Timer functions: injected by the adapter or plain Node timers. */
    private get timers(): Timers {
        return this.options.timers ?? NODE_TIMERS;
    }

    /** @param options - Connection options */
    public constructor(private readonly options: RemoteOptions) {
        super();
        this.minDelay = options.reconnectMinMs ?? RECONNECT_MIN_MS;
        this.reconnectDelay = this.minDelay;
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
        this.timers.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        this.teardown();
    }

    /** Retries a pending reconnect immediately with the shortest backoff (e.g. after Wake-on-LAN). */
    public reconnectNow(): void {
        if (!this.running || this.ready || !this.reconnectTimer) {
            return;
        }
        this.timers.clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
        this.reconnectDelay = this.minDelay;
        this.connect();
    }

    /** Drops the current connection and reconnects immediately (e.g. after a new pairing). */
    public restart(): void {
        this.stop();
        this.reconnectDelay = this.minDelay;
        this.alertFailures = 0;
        this.silentFailures = 0;
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
        this.send(encodeKeyInject(code, direction), `key ${key}`);
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
        this.send(encodeAppLink(link), `app link ${link}`);
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
        this.send(encodeImeText(text, this.imeCounter, this.fieldCounter), 'text input');
    }

    private send(payload: Buffer, description: string): void {
        if (!this.ready || !this.socket || this.socket.destroyed) {
            throw new Error('Not connected to the TV');
        }
        this.lastCommand = description;
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
            this.emit(
                'log',
                'debug',
                `${this.options.host}: socket error: ${[err.code, err.message].filter(Boolean).join(' ')}`,
            );
        });
        socket.once('close', () => {
            // @KI_HINWEIS: Ein nicht gekoppelter Client wird abgewiesen – die SHIELD schickt dabei (auch bei TLS 1.3
            // nach dem Handshake) den Alert „certificate unknown“ (Feldtest) → eindeutig. Schließt ein TV dagegen
            // nur still, ohne eine Nachricht zu senden (z. B. Dienst startet gerade nach dem Booten), ist das nur ein
            // schwaches Indiz und zählt erst nach mehreren Versuchen in Folge.
            const failure = tlsRejected ? 'alert' : secured && !this.receivedAny ? 'silent' : undefined;
            this.onClose(failure);
        });
    }

    private receivedAny = false;
    private lastCommand: string | undefined;
    private alertFailures = 0;
    private silentFailures = 0;
    private unpairedReported = false;
    private peerCertificate: Buffer | undefined;

    private onClose(failure: 'alert' | 'silent' | undefined): void {
        const wasReady = this.ready;
        this.teardown();
        if (wasReady) {
            this.emit('disconnected', 'connection closed');
        }
        if (!this.running) {
            return;
        }
        const maxDelay = Math.max(this.options.reconnectMaxMs, this.minDelay);
        this.alertFailures = failure === 'alert' ? this.alertFailures + 1 : 0;
        this.silentFailures = failure ? this.silentFailures + 1 : 0;
        let delay: number;
        if (this.alertFailures >= UNPAIRED_AFTER_ALERTS || this.silentFailures >= UNPAIRED_AFTER_SILENT_CLOSES) {
            // @KI_HINWEIS: Nicht dauerhaft aufgeben (Fehlalarm z. B. beim Neustart des TV möglich), aber nur noch
            // im maximalen Intervall versuchen. Nach erfolgreicher Kopplung ruft der Adapter restart() auf.
            if (!this.unpairedReported) {
                this.unpairedReported = true;
                this.emit('unpaired');
            }
            delay = maxDelay;
        } else {
            delay = wasReady ? this.minDelay : this.reconnectDelay;
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, maxDelay);
        }
        this.reconnectTimer = this.timers.setTimeout(() => {
            this.reconnectTimer = undefined;
            if (this.running) {
                this.connect();
            }
        }, delay);
    }

    private teardown(): void {
        this.timers.clearTimeout(this.idleTimer);
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
        this.timers.clearTimeout(this.idleTimer);
        this.idleTimer = this.timers.setTimeout(() => {
            this.emit('log', 'debug', `${this.options.host}: idle timeout, reconnecting`);
            this.socket?.destroy();
        }, this.options.idleTimeoutMs ?? IDLE_TIMEOUT_MS);
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
                    this.reconnectDelay = this.minDelay;
                    this.alertFailures = 0;
                    this.silentFailures = 0;
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
            case 'error': {
                // @KI_HINWEIS: Feldtest SHIELD (Remote-Dienst 7.00): App-Links ohne http(s)-Schema (market://,
                // android-app://, intent:) werden mit remote_error abgelehnt, danach schließt der TV die Verbindung
                // (Reconnect nach ~2 s). Deshalb einen konkreten Hinweis statt einer allgemeinen Meldung loggen.
                const cmd = this.lastCommand ?? 'last command';
                const hint = cmd.startsWith('app link ')
                    ? ' - this device accepts only https deep links (e.g. https://www.netflix.com/title), not package names'
                    : '';
                this.emit('log', 'warn', `${this.options.host}: TV rejected ${cmd}${hint}`);
                break;
            }
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
