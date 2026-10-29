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
var device_exports = {};
__export(device_exports, {
  AdbDevice: () => AdbDevice
});
module.exports = __toCommonJS(device_exports);
var import_node_events = require("node:events");
var import_keycodes = require("../keycodes");
var import_client = require("./client");
var import_parsers = require("./parsers");
var import_timers = require("../timers");
const KEYCODE_WAKEUP = 224;
const LAUNCHER_CATEGORIES = ["android.intent.category.LEANBACK_LAUNCHER", "android.intent.category.LAUNCHER"];
const KEYCODE_SLEEP = 223;
class AdbDevice extends import_node_events.EventEmitter {
  /** @param options - Device options */
  constructor(options) {
    super();
    this.options = options;
    this.client = new import_client.AdbClient({
      timers: options.timers,
      host: options.host,
      port: options.port,
      key: options.key,
      keyName: options.keyName,
      reconnectMaxMs: options.reconnectMaxMs
    });
    this.client.on("ready", (info) => {
      this.emit("ready", info);
      this.schedulePoll(0);
    });
    this.client.on("authPending", () => this.emit("authPending"));
    this.client.on("disconnected", () => {
      this.timers.clearTimeout(this.pollTimer);
      this.emit("disconnected");
    });
    this.client.on("log", (level, msg) => this.emit("log", level, msg));
  }
  client;
  pollTimer;
  polling = false;
  stopped = true;
  /** Timer functions: injected by the adapter or plain Node timers. */
  get timers() {
    var _a;
    return (_a = this.options.timers) != null ? _a : import_timers.NODE_TIMERS;
  }
  /** Whether commands can be sent. */
  get isReady() {
    return this.client.isReady;
  }
  /** Starts the connection and polling. */
  start() {
    this.stopped = false;
    this.client.start();
  }
  /** Stops polling and closes the connection. */
  stop() {
    this.stopped = true;
    this.timers.clearTimeout(this.pollTimer);
    this.pollTimer = void 0;
    this.client.stop();
  }
  /** Triggers a poll soon, e.g. after a command or when the screen was switched on. */
  pollSoon() {
    this.schedulePoll(1e3);
  }
  schedulePoll(delay) {
    this.timers.clearTimeout(this.pollTimer);
    if (this.stopped) {
      return;
    }
    this.pollTimer = this.timers.setTimeout(() => void this.poll(), delay);
  }
  async poll() {
    if (this.stopped || this.polling || !this.client.isReady) {
      return;
    }
    if (this.options.externalPower() === false) {
      this.schedulePoll(this.options.pollIntervalMs);
      return;
    }
    this.polling = true;
    try {
      const output = await this.client.shell(import_parsers.POLL_COMMAND);
      this.emit("poll", (0, import_parsers.parsePollOutput)(output));
    } catch (e) {
      this.emit("log", "debug", `${this.options.host}: ADB poll failed: ${e.message}`);
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
  async sendKey(key) {
    const code = typeof key === "number" ? key : /^\d+$/.test(key.trim()) ? Number(key) : import_keycodes.KEY_CODES[key.trim().toUpperCase().replace(/^KEYCODE_/, "")];
    if (code === void 0 || !Number.isInteger(code)) {
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
  async setPower(on) {
    await this.client.shell(`input keyevent ${on ? KEYCODE_WAKEUP : KEYCODE_SLEEP}`);
    this.pollSoon();
  }
  /**
   * Starts an app by package name (launcher activity) or opens a URL/deep link.
   *
   * @param target - Package name (e.g. org.xbmc.kodi) or URL with scheme
   */
  async launch(target) {
    var _a;
    const value = target.trim();
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      const { component, browserOnly } = await this.resolveLinkHandler(value);
      if (browserOnly) {
        throw new Error(
          `no app on the device opens "${value}" (only a web browser would). Enter the app ID instead \u2013 start the app on the TV and read it from currentApp`
        );
      }
      await this.client.shell(
        `am start -a android.intent.action.VIEW -d ${(0, import_parsers.shellQuote)(value)}${component ? ` -n ${component}` : ""}`
      );
    } else {
      if (!import_parsers.PACKAGE_PATTERN.test(value)) {
        throw new Error(`Invalid package name "${value}"`);
      }
      for (const category of LAUNCHER_CATEGORIES) {
        const resolved = await this.client.shell(
          `cmd package resolve-activity --brief -a android.intent.action.MAIN -c ${category} ${value}`
        );
        const component = (_a = /^\s*([A-Za-z][\w.]*\/[\w.$]+)\s*$/m.exec(resolved)) == null ? void 0 : _a[1];
        if (component) {
          await this.client.shell(`am start -a android.intent.action.MAIN -c ${category} -n ${component}`);
          this.pollSoon();
          return;
        }
      }
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
  async resolveLinkHandler(url) {
    if (!/^https?:/i.test(url)) {
      return { browserOnly: false };
    }
    const query = (u) => this.client.shell(
      `cmd package query-activities --components -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d ${(0, import_parsers.shellQuote)(u)}`
    );
    try {
      const [specific, generic] = await Promise.all([query(url), query("https://example.com/")]);
      const parse = (out) => [...out.matchAll(/^\s*([A-Za-z][\w.]*\/[\w.$]+)\s*$/gm)].map((m) => m[1]);
      const handlers = parse(specific);
      const browsers = new Set(parse(generic).map((c) => c.split("/")[0]));
      const candidates = handlers.filter((c) => !browsers.has(c.split("/")[0]));
      this.emit(
        "log",
        "debug",
        `${this.options.host}: link handlers ${JSON.stringify(handlers)}, apps ${JSON.stringify(candidates)}`
      );
      return { component: candidates[0], browserOnly: handlers.length > 0 && candidates.length === 0 };
    } catch (e) {
      this.emit("log", "debug", `${this.options.host}: cannot resolve link handler: ${e.message}`);
      return { browserOnly: false };
    }
  }
  /**
   * Reads a system property, e.g. ro.product.manufacturer.
   *
   * @param name - Property name
   */
  async getProp(name) {
    if (!/^[\w.]+$/.test(name)) {
      throw new Error(`Invalid property name "${name}"`);
    }
    const value = (await this.client.shell(`getprop ${name}`)).trim();
    return value || void 0;
  }
  /**
   * Types text into the focused input field via `input text`.
   *
   * @param text - Text (spaces are supported)
   */
  async sendText(text) {
    if (!text) {
      throw new Error("Text must not be empty");
    }
    await this.client.shell(`input text ${(0, import_parsers.shellQuote)(text.replace(/ /g, "%s"))}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AdbDevice
});
//# sourceMappingURL=device.js.map
