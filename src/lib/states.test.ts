import { expect } from 'chai';
import { KEY_CODES } from './keycodes';
import { resolveKeyCode } from './remote';
import { DEVICE_STATES, KEY_BUTTONS } from './states';

const REQUESTED_BUTTONS: ReadonlyArray<[string, string]> = [
    ['red', 'PROG_RED'],
    ['green', 'PROG_GREEN'],
    ['yellow', 'PROG_YELLOW'],
    ['blue', 'PROG_BLUE'],
    ['guide', 'GUIDE'],
    ['input', 'TV_INPUT'],
    ['hdmi1', 'TV_INPUT_HDMI_1'],
    ['hdmi2', 'TV_INPUT_HDMI_2'],
    ['hdmi3', 'TV_INPUT_HDMI_3'],
    ['hdmi4', 'TV_INPUT_HDMI_4'],
    ['tv', 'TV'],
    ['subtitle', 'CAPTIONS'],
    ['audioTrack', 'MEDIA_AUDIO_TRACK'],
    ['enter', 'ENTER'],
];

describe('remote key state definitions', () => {
    it('exposes the requested buttons with their Android key events', () => {
        const buttonMap = new Map(KEY_BUTTONS.map(button => [button.id, button.key]));
        expect(REQUESTED_BUTTONS.map(([id]) => [id, buttonMap.get(id)])).to.deep.equal(REQUESTED_BUTTONS);
        for (const [, key] of REQUESTED_BUTTONS) {
            expect(KEY_CODES[key], `${key} must exist in keycodes.ts`).to.be.a('number');
        }
        for (const digit of '0123456789') {
            expect(resolveKeyCode(`KEYCODE_${digit}`)).to.equal(KEY_CODES[digit]);
        }
    });

    it('defines sendNumber as one writable string state', () => {
        const state = DEVICE_STATES.find(definition => definition.id === 'sendNumber');
        expect(state?.common).to.include({ type: 'string', read: false, write: true });
    });
});
