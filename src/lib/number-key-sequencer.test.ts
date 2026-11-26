import { expect } from 'chai';
import { NumberKeySequencer } from './number-key-sequencer';
import type { Timers } from './timers';

function controlledTimers(): {
    timers: Timers;
    delays: number[];
    advance: () => void;
    isWaiting: () => boolean;
} {
    let callback: (() => void) | undefined;
    const delays: number[] = [];
    return {
        timers: {
            setTimeout: (next, ms) => {
                callback = next;
                delays.push(ms);
                return undefined;
            },
            clearTimeout: () => {
                callback = undefined;
            },
        },
        delays,
        advance: () => {
            const next = callback;
            callback = undefined;
            next?.();
        },
        isWaiting: () => callback !== undefined,
    };
}

async function flush(): Promise<void> {
    await new Promise<void>(resolve => setImmediate(resolve));
}

describe('number key sequencer', () => {
    it('validates full ASCII digit strings of 1 to 20 characters', () => {
        const sequence = new NumberKeySequencer(() => Promise.resolve());
        for (const invalid of [null, 0, '', '123456789012345678901', '１２３', '12a', '1\n']) {
            expect(() => sequence.enqueue(invalid)).to.throw('1 to 20 ASCII digits');
        }
    });

    it('accepts values at the 1- and 20-digit boundaries', async () => {
        const timer = controlledTimers();
        const keys: string[] = [];
        const sequence = new NumberKeySequencer(key => {
            keys.push(key);
            return Promise.resolve();
        }, timer.timers);
        const oneDigit = sequence.enqueue('0');
        const twentyDigits = sequence.enqueue('1'.repeat(20));

        await flush();
        expect(keys[0]).to.equal('KEYCODE_0');
        expect(await oneDigit).to.equal(true);
        await flush();
        expect(keys.slice(0, 2)).to.deep.equal(['KEYCODE_0', 'KEYCODE_1']);
        while (timer.isWaiting()) {
            timer.advance();
            await flush();
        }

        expect(await twentyDigits).to.equal(true);
        expect(keys).to.have.length(21);
        expect(timer.delays).to.have.length(19);
    });

    it('preserves leading zeros, repeats identical writes, and queues complete sequences with the 150ms gap', async () => {
        const timer = controlledTimers();
        const keys: string[] = [];
        const sequence = new NumberKeySequencer(key => {
            keys.push(key);
            return Promise.resolve();
        }, timer.timers);
        const first = sequence.enqueue('012');
        const second = sequence.enqueue('34');
        const repeated = sequence.enqueue('34');

        await flush();
        expect(keys).to.deep.equal(['KEYCODE_0']);
        for (let index = 0; index < 4; index++) {
            expect(timer.isWaiting()).to.equal(true);
            expect(timer.delays[index]).to.equal(150);
            timer.advance();
            await flush();
        }

        expect(await Promise.all([first, second, repeated])).to.deep.equal([true, true, true]);
        expect(keys).to.deep.equal([
            'KEYCODE_0',
            'KEYCODE_1',
            'KEYCODE_2',
            'KEYCODE_3',
            'KEYCODE_4',
            'KEYCODE_3',
            'KEYCODE_4',
        ]);
    });

    it('cancels the active and queued sequences', async () => {
        const timer = controlledTimers();
        const keys: string[] = [];
        const sequence = new NumberKeySequencer(key => {
            keys.push(key);
            return Promise.resolve();
        }, timer.timers);
        const active = sequence.enqueue('123');
        const queued = sequence.enqueue('45');

        await flush();
        expect(keys).to.deep.equal(['KEYCODE_1']);
        sequence.cancel();

        expect(await Promise.all([active, queued])).to.deep.equal([false, false]);
        expect(timer.isWaiting()).to.equal(false);
        expect(keys).to.deep.equal(['KEYCODE_1']);
    });
});
