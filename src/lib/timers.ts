/**
 * Timer abstraction for the protocol classes.
 * The adapter injects its own `setTimeout`/`clearTimeout` so that all timers are cleared on unload.
 */

/** Timer handle (Node timer or ioBroker.Timeout). */
export type TimerHandle = NodeJS.Timeout | ioBroker.Timeout;

/** Timer functions used by the protocol classes. */
export interface Timers {
    /**
     * Starts a one-shot timer.
     *
     * @param callback - Function to call
     * @param ms - Delay in milliseconds
     */
    setTimeout: (callback: () => void, ms: number) => TimerHandle | undefined;
    /**
     * Stops a timer; ignores undefined handles.
     *
     * @param handle - Handle returned by setTimeout
     */
    clearTimeout: (handle: TimerHandle | undefined) => void;
}

/** Plain Node.js timers (unit tests, standalone use). */
export const NODE_TIMERS: Timers = {
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: handle => globalThis.clearTimeout(handle as NodeJS.Timeout | undefined),
};
