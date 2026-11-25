import { NODE_TIMERS, type TimerHandle, type Timers } from './timers';

/** Default pause between key events when entering a channel number. */
export const DEFAULT_NUMBER_KEY_GAP_MS = 150;

/** Serializes channel-number entry so simultaneous writes are sent as complete sequences. */
export class NumberKeySequencer {
    private tail: Promise<void> = Promise.resolve();
    private generation = 0;
    private activeDelay: { handle: TimerHandle | undefined; resolve: (completed: boolean) => void } | undefined;

    /**
     * @param sendKey - Sends one Android key through the adapter's shared key-command path
     * @param timers - Timer functions used for the inter-digit pause
     * @param gapMs - Pause between key events
     */
    public constructor(
        private readonly sendKey: (key: string) => Promise<void>,
        private readonly timers: Timers = NODE_TIMERS,
        private readonly gapMs = DEFAULT_NUMBER_KEY_GAP_MS,
    ) {}

    /**
     * Adds one validated number to the queue. Returns false if it was cancelled before completion.
     *
     * @param value - Value to validate and send
     */
    public enqueue(value: unknown): Promise<boolean> {
        if (typeof value !== 'string' || value.length < 1 || value.length > 20) {
            throw new Error('sendNumber must be a string of 1 to 20 ASCII digits');
        }
        for (const digit of value) {
            if (digit < '0' || digit > '9') {
                throw new Error('sendNumber must be a string of 1 to 20 ASCII digits');
            }
        }

        const generation = this.generation;
        const task = this.tail.then(() => this.sendDigits(value, generation));
        this.tail = task.then(
            () => undefined,
            () => undefined,
        );
        return task;
    }

    /** Cancels queued sequences and stops the active sequence after its current key event. */
    public cancel(): void {
        this.generation++;
        const delay = this.activeDelay;
        if (delay) {
            this.activeDelay = undefined;
            this.timers.clearTimeout(delay.handle);
            delay.resolve(false);
        }
    }

    private async sendDigits(value: string, generation: number): Promise<boolean> {
        for (let index = 0; index < value.length; index++) {
            if (generation !== this.generation) {
                return false;
            }
            // The prefix ensures ADB treats this as a digit key, not as a numeric key-code value.
            await this.sendKey(`KEYCODE_${value[index]}`);
            if (generation !== this.generation) {
                return false;
            }
            if (index < value.length - 1 && !(await this.wait(generation))) {
                return false;
            }
        }
        return true;
    }

    private wait(generation: number): Promise<boolean> {
        return new Promise(resolve => {
            const delay = { handle: undefined as TimerHandle | undefined, resolve };
            this.activeDelay = delay;
            delay.handle = this.timers.setTimeout(() => {
                if (this.activeDelay === delay) {
                    this.activeDelay = undefined;
                }
                resolve(generation === this.generation);
            }, this.gapMs);
        });
    }
}
