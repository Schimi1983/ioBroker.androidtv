"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var remote_exports = {};
__export(remote_exports, {
  DEFAULT_REMOTE_PORT: () => DEFAULT_REMOTE_PORT,
  RemoteConnection: () => RemoteConnection,
  resolveKeyCode: () => resolveKeyCode
});
module.exports = __toCommonJS(remote_exports);
var import_node_events = require("node:events");
var tls = __toESM(require("node:tls"));
var import_keycodes = require("./keycodes");
var import_messages = require("./messages");
var import_protobuf = require("./protobuf");
var import_timers = require("./timers");
const DEFAULT_REMOTE_PORT = 6466;
const IDLE_TIMEOUT_MS = 16e3;
const CONNECT_TIMEOUT_MS = 5e3;
const RECONNECT_MIN_MS = 2e3;
const UNPAIRED_AFTER_ALERTS = 2;
const UNPAIRED_AFTER_SILENT_CLOSES = 5;
class RemoteConnection extends import_node_events.EventEmitter {
  /** @param options - Connection options */
  constructor(options) {
    var _a;
    super();
    this.options = options;
    this.minDelay = (_a = options.reconnectMinMs) != null ? _a : RECONNECT_MIN_MS;
    this.reconnectDelay = this.minDelay;
    this.activeFeatures = import_messages.Feature.PING | import_messages.Feature.KEY | import_messages.Feature.POWER | import_messages.Feature.VOLUME | import_messages.Feature.APP_LINK | (options.enableIme ? import_messages.Feature.IME : 0);
  }
  socket;
  decoder = new import_protobuf.FrameDecoder();
  idleTimer;
  reconnectTimer;
  reconnectDelay;
  minDelay;
  running = false;
  activeFeatures;
  imeCounter = 0;
  fieldCounter = 0;
  ready = false;
  /** Last known screen state, undefined until the TV reported it. */
  isOn;
  /** Timer functions: injected by the adapter or plain Node timers. */
  get timers() {
    var _a;
    return (_a = this.options.timers) != null ? _a : import_timers.NODE_TIMERS;
  }
  /** Whether commands can be sent. */
  get isReady() {
    return this.ready;
  }
  /** Starts connecting; reconnects automatically until {@link stop} is called. */
  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.connect();
  }
  /** Closes the connection and cancels reconnects. */
  stop() {
    this.running = false;
    this.timers.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = void 0;
    this.teardown();
  }
  /** Drops the current connection and reconnects immediately (e.g. after a new pairing). */
  restart() {
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
  sendKey(key, direction = import_messages.KeyDirection.SHORT) {
    const code = typeof key === "number" ? key : resolveKeyCode(key);
    if (code === void 0) {
      throw new Error(`Unknown key "${key}"`);
    }
    this.send((0, import_messages.encodeKeyInject)(code, direction), `key ${key}`);
  }
  /**
   * Launches an app by deep link or package name.
   *
   * @param appLinkOrPackage - URL (e.g. https://www.netflix.com/title) or package (org.xbmc.kodi)
   */
  launchApp(appLinkOrPackage) {
    const target = appLinkOrPackage.trim();
    if (!target) {
      throw new Error("App link must not be empty");
    }
    const link = /^[a-z][a-z0-9+.-]*:/i.test(target) ? target : `market://launch?id=${target}`;
    this.send((0, import_messages.encodeAppLink)(link), `app link ${link}`);
  }
  /**
   * Types text into the focused input field (requires IME).
   *
   * @param text - Text
   */
  sendText(text) {
    if (!text) {
      throw new Error("Text must not be empty");
    }
    if (!(this.activeFeatures & import_messages.Feature.IME)) {
      throw new Error("Text input requires the IME option");
    }
    this.send((0, import_messages.encodeImeText)(text, this.imeCounter, this.fieldCounter), "text input");
  }
  send(payload, description) {
    if (!this.ready || !this.socket || this.socket.destroyed) {
      throw new Error("Not connected to the TV");
    }
    this.lastCommand = description;
    this.socket.write((0, import_protobuf.frame)(payload));
    this.armIdleTimer();
  }
  write(payload) {
    var _a;
    (_a = this.socket) == null ? void 0 : _a.write((0, import_protobuf.frame)(payload));
  }
  connect() {
    var _a;
    this.decoder.reset();
    this.receivedAny = false;
    const socket = tls.connect({
      host: this.options.host,
      port: (_a = this.options.port) != null ? _a : DEFAULT_REMOTE_PORT,
      cert: this.options.certificate.cert,
      key: this.options.certificate.key,
      // @KI_HINWEIS: TV-Zertifikat ist selbstsigniert; die Gegenseite prüft unser Client-Zertifikat (mTLS).
      rejectUnauthorized: false,
      timeout: CONNECT_TIMEOUT_MS
    });
    this.socket = socket;
    let secured = false;
    let tlsRejected = false;
    socket.once("timeout", () => {
      if (!secured) {
        socket.destroy(new Error("connect timeout"));
      }
    });
    socket.once("secureConnect", () => {
      var _a2;
      secured = true;
      this.peerCertificate = (_a2 = socket.getPeerCertificate(true)) == null ? void 0 : _a2.raw;
      socket.setTimeout(0);
      socket.setKeepAlive(true, 1e4);
      this.armIdleTimer();
    });
    socket.on("data", (chunk) => this.onData(chunk));
    socket.on("error", (err) => {
      if (/alert|handshake|certificate|SSL/i.test(err.message)) {
        tlsRejected = true;
      }
      this.emit(
        "log",
        "debug",
        `${this.options.host}: socket error: ${[err.code, err.message].filter(Boolean).join(" ")}`
      );
    });
    socket.once("close", () => {
      const failure = tlsRejected ? "alert" : secured && !this.receivedAny ? "silent" : void 0;
      this.onClose(failure);
    });
  }
  receivedAny = false;
  lastCommand;
  alertFailures = 0;
  silentFailures = 0;
  unpairedReported = false;
  peerCertificate;
  onClose(failure) {
    const wasReady = this.ready;
    this.teardown();
    if (wasReady) {
      this.emit("disconnected", "connection closed");
    }
    if (!this.running) {
      return;
    }
    const maxDelay = Math.max(this.options.reconnectMaxMs, this.minDelay);
    this.alertFailures = failure === "alert" ? this.alertFailures + 1 : 0;
    this.silentFailures = failure ? this.silentFailures + 1 : 0;
    let delay;
    if (this.alertFailures >= UNPAIRED_AFTER_ALERTS || this.silentFailures >= UNPAIRED_AFTER_SILENT_CLOSES) {
      if (!this.unpairedReported) {
        this.unpairedReported = true;
        this.emit("unpaired");
      }
      delay = maxDelay;
    } else {
      delay = wasReady ? this.minDelay : this.reconnectDelay;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, maxDelay);
    }
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = void 0;
      if (this.running) {
        this.connect();
      }
    }, delay);
  }
  teardown() {
    this.timers.clearTimeout(this.idleTimer);
    this.idleTimer = void 0;
    this.ready = false;
    if (this.socket) {
      const old = this.socket;
      this.socket = void 0;
      old.removeAllListeners();
      old.on("error", () => void 0);
      old.destroy();
    }
  }
  armIdleTimer() {
    var _a;
    this.timers.clearTimeout(this.idleTimer);
    this.idleTimer = this.timers.setTimeout(() => {
      var _a2;
      this.emit("log", "debug", `${this.options.host}: idle timeout, reconnecting`);
      (_a2 = this.socket) == null ? void 0 : _a2.destroy();
    }, (_a = this.options.idleTimeoutMs) != null ? _a : IDLE_TIMEOUT_MS);
  }
  onData(chunk) {
    var _a;
    this.receivedAny = true;
    this.armIdleTimer();
    let frames;
    try {
      frames = this.decoder.push(chunk);
    } catch (e) {
      this.emit("log", "warn", `${this.options.host}: invalid data (${e.message})`);
      (_a = this.socket) == null ? void 0 : _a.destroy();
      return;
    }
    for (const raw of frames) {
      try {
        this.handleMessage(raw);
      } catch (e) {
        this.emit("log", "debug", `${this.options.host}: cannot parse message: ${e.message}`);
      }
    }
  }
  handleMessage(raw) {
    var _a;
    const msg = (0, import_messages.decodeRemoteMessage)(raw);
    switch (msg.type) {
      case "configure":
        this.activeFeatures &= msg.features;
        if (!(msg.features & import_messages.Feature.KEY) || !(msg.features & import_messages.Feature.APP_LINK)) {
          this.emit(
            "log",
            "warn",
            `${this.options.host}: TV does not offer key/app-link control. Clear the storage of the system app "Android TV Remote Service" on the TV.`
          );
        }
        this.write((0, import_messages.encodeRemoteConfigure)(this.activeFeatures));
        this.deviceInfo = msg.deviceInfo;
        break;
      case "setActive":
        this.write((0, import_messages.encodeRemoteSetActive)(this.activeFeatures));
        break;
      case "start":
        if (!this.ready) {
          this.ready = true;
          this.reconnectDelay = this.minDelay;
          this.alertFailures = 0;
          this.silentFailures = 0;
          this.unpairedReported = false;
          this.emit("ready", this.deviceInfo, this.peerCertificate);
        }
        this.isOn = msg.started;
        this.emit("power", msg.started);
        break;
      case "pingRequest":
        this.write((0, import_messages.encodePingResponse)(msg.val1));
        break;
      case "imeKeyInject":
        if (msg.appPackage) {
          this.emit("currentApp", msg.appPackage);
        }
        break;
      case "imeBatchEdit":
        this.imeCounter = msg.imeCounter;
        this.fieldCounter = msg.fieldCounter;
        break;
      case "volume":
        this.emit("volume", msg.volume);
        break;
      case "error": {
        const cmd = (_a = this.lastCommand) != null ? _a : "last command";
        const hint = cmd.startsWith("app link ") ? " - this device accepts only https deep links (e.g. https://www.netflix.com/title), not package names" : "";
        this.emit("log", "warn", `${this.options.host}: TV rejected ${cmd}${hint}`);
        break;
      }
      default:
        this.emit("log", "debug", `${this.options.host}: unhandled message fields ${msg.fields.join(",")}`);
    }
  }
  deviceInfo = {};
}
function resolveKeyCode(key) {
  const k = key.trim();
  if (/^\d+$/.test(k)) {
    return Number(k);
  }
  return import_keycodes.KEY_CODES[k.toUpperCase().replace(/^KEYCODE_/, "")];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_REMOTE_PORT,
  RemoteConnection,
  resolveKeyCode
});
//# sourceMappingURL=remote.js.map
