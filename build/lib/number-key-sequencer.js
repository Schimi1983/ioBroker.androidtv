"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var number_key_sequencer_exports = {};
__export(number_key_sequencer_exports, {
  DEFAULT_NUMBER_KEY_GAP_MS: () => DEFAULT_NUMBER_KEY_GAP_MS,
  NumberKeySequencer: () => NumberKeySequencer
});
module.exports = __toCommonJS(number_key_sequencer_exports);
var import_timers = require("./timers");
const DEFAULT_NUMBER_KEY_GAP_MS = 150;
class NumberKeySequencer {
  /**
   * @param sendKey - Sends one Android key through the adapter's shared key-command path
   * @param timers - Timer functions used for the inter-digit pause
   * @param gapMs - Pause between key events
   */
  constructor(sendKey, timers = import_timers.NODE_TIMERS, gapMs = DEFAULT_NUMBER_KEY_GAP_MS) {
    this.sendKey = sendKey;
    this.timers = timers;
    this.gapMs = gapMs;
  }
  tail = Promise.resolve();
  generation = 0;
  activeDelay;
  /**
   * Adds one validated number to the queue. Returns false if it was cancelled before completion.
   *
   * @param value - Value to validate and send
   */
  enqueue(value) {
    if (typeof value !== "string" || value.length < 1 || value.length > 20) {
      throw new Error("sendNumber must be a string of 1 to 20 ASCII digits");
    }
    for (const digit of value) {
      if (digit < "0" || digit > "9") {
        throw new Error("sendNumber must be a string of 1 to 20 ASCII digits");
      }
    }
    const generation = this.generation;
    const task = this.tail.then(() => this.sendDigits(value, generation));
    this.tail = task.then(
      () => void 0,
      () => void 0
    );
    return task;
  }
  /** Cancels queued sequences and stops the active sequence after its current key event. */
  cancel() {
    this.generation++;
    const delay = this.activeDelay;
    if (delay) {
      this.activeDelay = void 0;
      this.timers.clearTimeout(delay.handle);
      delay.resolve(false);
    }
  }
  async sendDigits(value, generation) {
    for (let index = 0; index < value.length; index++) {
      if (generation !== this.generation) {
        return false;
      }
      await this.sendKey(`KEYCODE_${value[index]}`);
      if (generation !== this.generation) {
        return false;
      }
      if (index < value.length - 1 && !await this.wait(generation)) {
        return false;
      }
    }
    return true;
  }
  wait(generation) {
    return new Promise((resolve) => {
      const delay = { handle: void 0, resolve };
      this.activeDelay = delay;
      delay.handle = this.timers.setTimeout(() => {
        if (this.activeDelay === delay) {
          this.activeDelay = void 0;
        }
        resolve(generation === this.generation);
      }, this.gapMs);
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_NUMBER_KEY_GAP_MS,
  NumberKeySequencer
});
//# sourceMappingURL=number-key-sequencer.js.map
