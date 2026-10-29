import { EventEmitter } from 'node:events';
import { KEY_CODES } from '../keycodes';
import type { AdbKey } from './auth';
import { AdbClient, type AdbDeviceInfo } from './client';
import { PACKAGE_PATTERN, POLL_COMMAND, parsePollOutput, shellQuote, type PollResult } from './parsers';

/** Options for {@link AdbDevice}. */
export interface AdbDeviceOptions {
    /** IP address or hostname */
    host: string;
    /** ADB port */
    port: number;
    /** RSA key of this instance */
    key: AdbKey;
    /** Name shown on the TV in the authorization dialog */
    keyName: string;
    /** Poll interval in ms while the device is on */
    pollIntervalMs: number;
    /** Upper bound of the reconnect backoff in ms */
    reconnectMaxMs: number;
    /**
     * Returns the screen state known from another source (Remote v2), or undefined if ADB is the only source.
     * When it returns false, no polling traffic is generated at all.
     */
    externalPower: () => boolean | undefined;
}

/** Events emitted by {@link AdbDevice}. */
export interface AdbDeviceEvents {
    /** ready */
    ready: [info: AdbDeviceInfo];
    /** authPending */
    authPending: [];
    /** disconnected */
    disconnected: [];
    /** poll */
    poll: [result: PollResult];
    /** log */
    log: [level: 'debug' | 'warn', message: string];
}

const KEYCODE_WAKEUP = 224;
const KEYCODE_SLEEP = 223;

/**
 * ADB based device access: periodic status polling and commands via shell.
 * Polls only while the device is on (or, without another power source, polls just the power state).
 */
export class AdbDevice extends EventEmitter<AdbDeviceEvents> {
    private readonly client: AdbClient;
    private pollTimer: NodeJS.Timeout | undefined;
    private polling = false;
    private stopped = true;

    /** @param options - Device options */
    public constructor(private readonly options: AdbDeviceOptions) {
        super();
        this.client = new AdbClient({
            host: options.host,
            port: options.port,
            key: options.key,
            keyName: options.keyName,
            reconnectMaxMs: options.reconnectMaxMs,
        });
        this.client.on('ready', info => {
            this.emit('ready', info);
            this.schedulePoll(0);
        });
        this.client.on('authPending', () => this.emit('authPending'));
        this.client.on('disconnected', () => {
            clearTimeout(this.pollTimer);
            this.emit('disconnected');
        });
        this.client.on('log', (level, msg) => this.emit('log', level, msg));
    }

    /** Whether commands can be sent. */
    public get isReady(): boolean {
        return this.client.isReady;
    }

    /** Starts the connection and polling. */
    public start(): void {
        this.stopped = false;
        this.client.start();
    }

    /** Stops polling and closes the connection. */
    public stop(): void {
        this.stopped = true;
        clearTimeout(this.pollTimer);
        this.pollTimer = undefined;
        this.client.stop();
    }

    /** Triggers a poll soon, e.g. after a command or when the screen was switched on. */
    public pollSoon(): void {
        this.schedulePoll(1_000);
    }

    private schedulePoll(delay: number): void {
        clearTimeout(this.pollTimer);
        if (this.stopped) {
            return;
        }
        this.pollTimer = setTimeout(() => void this.poll(), delay);
    }

    private async poll(): Promise<void> {
        if (this.stopped || this.polling || !this.client.isReady) {
            return;
        }
        // @KI_HINWEIS: Mit Remote v2 als Quelle für den Bildschirmzustand gar nicht abfragen, solange das Gerät
        // aus ist (kein ADB-Verkehr im Standby). Nur ADB: der Befehl liefert im Standby nur die Power-Zeile.
        if (this.options.externalPower() === false) {
            this.schedulePoll(this.options.pollIntervalMs);
            return;
        }
        this.polling = true;
        try {
            const output = await this.client.shell(POLL_COMMAND);
            this.emit('poll', parsePollOutput(output));
        } catch (e) {
            this.emit('log', 'debug', `${this.options.host}: ADB poll failed: ${(e as Error).message}`);
        } finally {
            this.polling = false;
            this.schedulePoll(this.options.pollIntervalMs);
        }
    }

    /**
     * Sends a key press via `input keyevent`.
     *
     * @param key - Key name without KEYCODE_ prefix or numeric code
     */
    public async sendKey(key: string | number): Promise<void> {
        const code =
            typeof key === 'number'
                ? key
                : /^\d+$/.test(key.trim())
                  ? Number(key)
                  : KEY_CODES[
                        key
                            .trim()
                            .toUpperCase()
                            .replace(/^KEYCODE_/, '')
                    ];
        if (code === undefined || !Number.isInteger(code)) {
            throw new Error(`Unknown key "${key}"`);
        }
        await this.client.shell(`input keyevent ${code}`);
        this.pollSoon();
    }

    /**
     * Switches the device on or off with the idempotent WAKEUP/SLEEP keys.
     *
     * @param on - Desired state
     */
    public async setPower(on: boolean): Promise<void> {
        await this.client.shell(`input keyevent ${on ? KEYCODE_WAKEUP : KEYCODE_SLEEP}`);
        this.pollSoon();
    }

    /**
     * Starts an app by package name (launcher activity) or opens a URL/deep link.
     *
     * @param target - Package name (e.g. org.xbmc.kodi) or URL with scheme
     */
    public async launch(target: string): Promise<void> {
        const value = target.trim();
        if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
            const component = await this.resolveLinkHandler(value);
            await this.client.shell(
                `am start -a android.intent.action.VIEW -d ${shellQuote(value)}${component ? ` -n ${component}` : ''}`,
            );
        } else {
            if (!PACKAGE_PATTERN.test(value)) {
                throw new Error(`Invalid package name "${value}"`);
            }
            // TV launcher category first (Android TV / Fire TV), then the phone launcher category as fallback
            let out = await this.client.shell(`monkey -p ${value} -c android.intent.category.LEANBACK_LAUNCHER 1`);
            if (/No activities found|monkey aborted/i.test(out)) {
                out = await this.client.shell(`monkey -p ${value} -c android.intent.category.LAUNCHER 1`);
            }
            if (/No activities found|monkey aborted/i.test(out)) {
                throw new Error(`App "${value}" not found on the device`);
            }
        }
        this.pollSoon();
    }

    /**
     * Finds the app (not a browser) that opens a link, so that Android does not show the "Open with" chooser.
     *
     * @param url - Link to open
     * @returns component "package/activity" or undefined
     */
    private async resolveLinkHandler(url: string): Promise<string | undefined> {
        // @KI_HINWEIS: Feldtest Fire TV: `am start -d https://www.youtube.com/…` öffnete den Auswahldialog
        // (YouTube-App und Browser). Lösung ohne Liste bekannter Apps: Handler des Links abfragen und alle Apps
        // abziehen, die auch eine beliebige Webseite öffnen (= Browser). Bleibt eine App übrig, direkt starten.
        if (!/^https?:/i.test(url)) {
            return undefined;
        }
        const query = (u: string): Promise<string> =>
            this.client.shell(
                `cmd package query-activities --components -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d ${shellQuote(u)}`,
            );
        try {
            const [specific, generic] = await Promise.all([query(url), query('https://example.com/')]);
            const parse = (out: string): string[] =>
                [...out.matchAll(/^\s*([A-Za-z][\w.]*\/[\w.$]+)\s*$/gm)].map(m => m[1]);
            const browsers = new Set(parse(generic).map(c => c.split('/')[0]));
            const candidates = parse(specific).filter(c => !browsers.has(c.split('/')[0]));
            this.emit('log', 'debug', `${this.options.host}: link handlers ${JSON.stringify(candidates)}`);
            return candidates[0];
        } catch (e) {
            this.emit('log', 'debug', `${this.options.host}: cannot resolve link handler: ${(e as Error).message}`);
            return undefined;
        }
    }

    /**
     * Reads a system property, e.g. ro.product.manufacturer.
     *
     * @param name - Property name
     */
    public async getProp(name: string): Promise<string | undefined> {
        if (!/^[\w.]+$/.test(name)) {
            throw new Error(`Invalid property name "${name}"`);
        }
        const value = (await this.client.shell(`getprop ${name}`)).trim();
        return value || undefined;
    }

    /**
     * Types text into the focused input field via `input text`.
     *
     * @param text - Text (spaces are supported)
     */
    public async sendText(text: string): Promise<void> {
        if (!text) {
            throw new Error('Text must not be empty');
        }
        // `input text` expects %s for spaces; everything else is quoted for the shell
        await this.client.shell(`input text ${shellQuote(text.replace(/ /g, '%s'))}`);
    }
}
