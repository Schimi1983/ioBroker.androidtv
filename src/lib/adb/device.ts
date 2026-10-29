import { EventEmitter } from 'node:events';
import { KEY_CODES } from '../keycodes';
import type { AdbKey } from './auth';
import { AdbClient, type AdbDeviceInfo } from './client';
import {
    MAC_COMMAND,
    PACKAGE_PATTERN,
    POLL_COMMAND,
    parseMacOutput,
    parsePollOutput,
    shellQuote,
    type PollResult,
} from './parsers';
import { NODE_TIMERS, type TimerHandle, type Timers } from '../timers';

/** Options for {@link AdbDevice}. */
export interface AdbDeviceOptions {
    /** Timer functions (the adapter passes its own so timers are cleared on unload) */
    timers?: Timers;
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
const LAUNCHER_CATEGORIES = ['android.intent.category.LEANBACK_LAUNCHER', 'android.intent.category.LAUNCHER'];
const KEYCODE_SLEEP = 223;

/**
 * ADB based device access: periodic status polling and commands via shell.
 * Polls only while the device is on (or, without another power source, polls just the power state).
 */
export class AdbDevice extends EventEmitter<AdbDeviceEvents> {
    private readonly client: AdbClient;
    private pollTimer: TimerHandle | undefined;
    private polling = false;
    private stopped = true;

    /** Timer functions: injected by the adapter or plain Node timers. */
    private get timers(): Timers {
        return this.options.timers ?? NODE_TIMERS;
    }

    /** @param options - Device options */
    public constructor(private readonly options: AdbDeviceOptions) {
        super();
        this.client = new AdbClient({
            timers: options.timers,
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
            this.timers.clearTimeout(this.pollTimer);
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
        this.timers.clearTimeout(this.pollTimer);
        this.pollTimer = undefined;
        this.client.stop();
    }

    /** Triggers a poll soon, e.g. after a command or when the screen was switched on. */
    public pollSoon(): void {
        this.schedulePoll(1_000);
    }

    private schedulePoll(delay: number): void {
        this.timers.clearTimeout(this.pollTimer);
        if (this.stopped) {
            return;
        }
        this.pollTimer = this.timers.setTimeout(() => void this.poll(), delay);
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
        // @KI_HINWEIS: Feldtest Fire OS 7: `cmd media_session dispatch` wird bestätigt, wirkt aber nicht (Prime Music
        // pausierte nicht). Deshalb immer `input keyevent` (~1,5–2,5 s auf dem Fire TV, startet eine Java-VM).
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
            const { component, browserOnly } = await this.resolveLinkHandler(value);
            if (browserOnly) {
                throw new Error(
                    `no app on the device opens "${value}" (only a web browser would). Enter the app ID instead – start the app on the TV and read it from currentApp`,
                );
            }
            await this.client.shell(
                `am start -a android.intent.action.VIEW -d ${shellQuote(value)}${component ? ` -n ${component}` : ''}`,
            );
        } else {
            if (!PACKAGE_PATTERN.test(value)) {
                throw new Error(`Invalid package name "${value}"`);
            }
            // Fast path: resolve the launcher activity (native `cmd package`) and start it with `am start`.
            // TV launcher category first (Android TV / Fire TV), then the phone launcher category.
            for (const category of LAUNCHER_CATEGORIES) {
                const resolved = await this.client.shell(
                    `cmd package resolve-activity --brief -a android.intent.action.MAIN -c ${category} ${value}`,
                );
                const component = /^\s*([A-Za-z][\w.]*\/[\w.$]+)\s*$/m.exec(resolved)?.[1];
                if (component) {
                    await this.client.shell(`am start -a android.intent.action.MAIN -c ${category} -n ${component}`);
                    this.pollSoon();
                    return;
                }
            }
            // Fallback (older devices without `cmd package resolve-activity`): monkey, slow but universal
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
     * @returns component "package/activity" of the app, and whether only browsers would open the link
     */
    private async resolveLinkHandler(url: string): Promise<{ component?: string; browserOnly: boolean }> {
        // @KI_HINWEIS: Feldtest Fire TV: `am start -d https://www.youtube.com/…` öffnete den Auswahldialog
        // (YouTube-App und Browser). Lösung ohne Liste bekannter Apps: Handler des Links abfragen und alle Apps
        // abziehen, die auch eine beliebige Webseite öffnen (= Browser). Bleibt eine App übrig, direkt starten.
        // Öffnen nur Browser den Link (Fire TV: app.primevideo.com → Silk), nicht starten – auf einem TV unerwünscht.
        if (!/^https?:/i.test(url)) {
            return { browserOnly: false };
        }
        const query = (u: string): Promise<string> =>
            this.client.shell(
                `cmd package query-activities --components -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d ${shellQuote(u)}`,
            );
        try {
            const [specific, generic] = await Promise.all([query(url), query('https://example.com/')]);
            const parse = (out: string): string[] =>
                [...out.matchAll(/^\s*([A-Za-z][\w.]*\/[\w.$]+)\s*$/gm)].map(m => m[1]);
            const handlers = parse(specific);
            const browsers = new Set(parse(generic).map(c => c.split('/')[0]));
            const candidates = handlers.filter(c => !browsers.has(c.split('/')[0]));
            this.emit(
                'log',
                'debug',
                `${this.options.host}: link handlers ${JSON.stringify(handlers)}, apps ${JSON.stringify(candidates)}`,
            );
            return { component: candidates[0], browserOnly: handlers.length > 0 && candidates.length === 0 };
        } catch (e) {
            this.emit('log', 'debug', `${this.options.host}: cannot resolve link handler: ${(e as Error).message}`);
            return { browserOnly: false };
        }
    }

    /**
     * Lists Android settings that look like Wake-on-LAN / network standby switches (diagnostics).
     *
     * @returns Matching lines "namespace: key=value"
     */
    public async findWakeSettings(): Promise<string[]> {
        const out = await this.client.shell(
            'for n in global secure system; do settings list $n 2>/dev/null | grep -iE "wol|wake_on|wakeonlan|network_standby|lan_wake|networkstandby" | sed "s/^/$n: /"; done',
        );
        return out
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);
    }

    /** Retries a pending ADB reconnect immediately (e.g. after Wake-on-LAN). */
    public reconnectNow(): void {
        this.client.reconnectNow();
    }

    /**
     * Reads the MAC address of the active network interface (for Wake-on-LAN).
     *
     * @returns MAC address or undefined
     */
    public async getMacAddress(): Promise<string | undefined> {
        const output = await this.client.shell(MAC_COMMAND);
        const mac = parseMacOutput(output, this.options.host);
        if (!mac) {
            this.emit(
                'log',
                'debug',
                `${this.options.host}: MAC address not found in: ${output.replace(/\s+/g, ' ').slice(0, 300)}`,
            );
        }
        return mac;
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
