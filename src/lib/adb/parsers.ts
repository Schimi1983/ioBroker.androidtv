/**
 * Parsers for the (filtered) output of `dumpsys` on Android TV / Fire TV devices.
 * All functions are pure and tolerant: unknown formats yield undefined instead of throwing.
 */

/** Media playback state as exposed in ioBroker (`media.state`). */
export type MediaState = 'play' | 'pause' | 'stop' | 'buffering' | 'idle';

/** Information about the active media session. */
export interface MediaInfo {
    /** Package owning the session, e.g. com.netflix.ninja */
    app: string;
    /** Playback state */
    state: MediaState;
    /** Media title */
    title?: string;
    /** Media subtitle (e.g. artist or episode) */
    subtitle?: string;
    /** Playback position in seconds at the time of the last update by the app */
    position?: number;
}

/** Result of one poll. */
export interface PollResult {
    /** Screen/device awake; undefined if not reported */
    awake?: boolean;
    /** Foreground app package (only when awake) */
    currentApp?: string;
    /** Active media session, null = none (only when awake) */
    media?: MediaInfo | null;
}

/** Separator between the sections of the combined poll command. */
export const SECTION_SEPARATOR = '---IOBATV---';

/**
 * Shell command for one poll. Media and activity are only queried when the device is awake, and the output is
 * reduced on the device with grep, so a poll transfers only a few hundred bytes.
 */
export const POLL_COMMAND =
    'w=$(dumpsys power | grep -m1 -E "mWakefulness="); echo "$w"; ' +
    'case "$w" in *Awake*|*Dreaming*) ' +
    `echo ${SECTION_SEPARATOR}; dumpsys activity activities | grep -E "ResumedActivity"; ` +
    `echo ${SECTION_SEPARATOR}; dumpsys media_session | grep -E "package=|active=|state=PlaybackState|description="` +
    ' ;; esac';

/** Android PlaybackState constants → ioBroker media state. */
const PLAYBACK_STATES: Record<number, MediaState> = {
    0: 'idle', // STATE_NONE
    1: 'stop', // STATE_STOPPED
    2: 'pause', // STATE_PAUSED
    3: 'play', // STATE_PLAYING
    4: 'play', // STATE_FAST_FORWARDING
    5: 'play', // STATE_REWINDING
    6: 'buffering', // STATE_BUFFERING
    7: 'stop', // STATE_ERROR
    8: 'buffering', // STATE_CONNECTING
    9: 'play', // STATE_SKIPPING_TO_PREVIOUS
    10: 'play', // STATE_SKIPPING_TO_NEXT
    11: 'play', // STATE_SKIPPING_TO_QUEUE_ITEM
};

/**
 * Parses `mWakefulness=Awake|Asleep|Dozing|Dreaming`.
 *
 * @param text - Output section
 */
export function parseWakefulness(text: string): boolean | undefined {
    const m = /mWakefulness=(\w+)/.exec(text);
    if (!m) {
        return undefined;
    }
    // Dreaming = screensaver: the screen is still on
    return m[1] === 'Awake' || m[1] === 'Dreaming';
}

/**
 * Parses the resumed activity, e.g. `mResumedActivity: ActivityRecord{1a2b u0 com.netflix.ninja/.MainActivity t12}`
 * or `topResumedActivity=ActivityRecord{…}`.
 *
 * @param text - Output section
 */
export function parseResumedActivity(text: string): string | undefined {
    const m = /ResumedActivity[:=]\s*ActivityRecord\{\S+ u\d+ ([A-Za-z][\w.]*)\//.exec(text);
    return m?.[1];
}

/**
 * Parses the filtered `dumpsys media_session` output and returns the most relevant session:
 * a playing one first, then paused/buffering, then any other active one.
 *
 * @param text - Output section (lines with package=, active=, state=PlaybackState, description=)
 */
export function parseMediaSessions(text: string): MediaInfo | null {
    interface Session {
        app: string;
        active: boolean;
        state?: number;
        position?: number;
        description?: string;
    }
    const sessions: Session[] = [];
    let current: Session | undefined;
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        const pkg = /^package=([A-Za-z][\w.]*)/.exec(line);
        if (pkg) {
            current = { app: pkg[1], active: false };
            sessions.push(current);
            continue;
        }
        if (!current) {
            continue;
        }
        if (line.startsWith('active=')) {
            current.active = line === 'active=true';
        } else if (line.startsWith('state=PlaybackState')) {
            const st = /\bstate=(\d+)/.exec(line.slice('state=PlaybackState'.length));
            const pos = /\bposition=(-?\d+)/.exec(line);
            current.state = st ? Number(st[1]) : undefined;
            current.position = pos && Number(pos[1]) >= 0 ? Math.round(Number(pos[1]) / 1000) : undefined;
        } else if (line.includes('description=')) {
            current.description = line.slice(line.indexOf('description=') + 'description='.length);
        }
    }
    const active = sessions.filter(s => s.active && s.state !== undefined);
    const rank = (s: Session): number => {
        const st = PLAYBACK_STATES[s.state ?? 0] ?? 'idle';
        return st === 'play' ? 0 : st === 'pause' || st === 'buffering' ? 1 : 2;
    };
    const best = active.sort((a, b) => rank(a) - rank(b))[0];
    if (!best) {
        return null;
    }
    // description = "<title>, <subtitle>, <description>" – "null" for missing parts
    const parts = (best.description ?? '').split(', ').map(p => p.trim());
    const clean = (v: string | undefined): string | undefined => (v && v !== 'null' ? v : undefined);
    return {
        app: best.app,
        state: PLAYBACK_STATES[best.state ?? 0] ?? 'idle',
        title: clean(parts[0]),
        subtitle: clean(parts[1]),
        position: best.position,
    };
}

/**
 * Splits and parses the output of {@link POLL_COMMAND}.
 *
 * @param output - Complete shell output
 */
export function parsePollOutput(output: string): PollResult {
    const [power = '', activity, media] = output.split(SECTION_SEPARATOR);
    const awake = parseWakefulness(power);
    const result: PollResult = { awake };
    if (awake && activity !== undefined) {
        result.currentApp = parseResumedActivity(activity);
        result.media = media !== undefined ? parseMediaSessions(media) : null;
    }
    return result;
}

/**
 * Quotes a value for the Android shell (mksh) using single quotes.
 *
 * @param value - Raw value
 */
export function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Valid Android package name (prevents shell injection). */
export const PACKAGE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
