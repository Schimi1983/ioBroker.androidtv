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
var client_exports = {};
__export(client_exports, {
  AdbClient: () => AdbClient,
  DEFAULT_ADB_PORT: () => DEFAULT_ADB_PORT,
  parseBanner: () => parseBanner
});
module.exports = __toCommonJS(client_exports);
var import_node_events = require("node:events");
var net = __toESM(require("node:net"));
var import_auth = require("./auth");
var import_protocol = require("./protocol");
const DEFAULT_ADB_PORT = 5555;
const CONNECT_TIMEOUT_MS = 5e3;
const RECONNECT_MIN_MS = 2e3;
const DEFAULT_SHELL_TIMEOUT_MS = 1e4;
const HANDSHAKE_TIMEOUT_MS = 1e4;
class AdbClient extends import_node_events.EventEmitter {
  /** @param options - Connection options */
  constructor(options) {
    var _a;
    super();
    this.options = options;
    this.minDelay = (_a = options.reconnectMinMs) != null ? _a : RECONNECT_MIN_MS;
    this.reconnectDelay = this.minDelay;
  }
  socket;
  decoder = new import_protocol.AdbPacketDecoder();
  running = false;
  ready = false;
  signatureSent = false;
  publicKeySent = false;
  reconnectTimer;
  handshakeTimer;
  reconnectDelay;
  minDelay;
  maxPayload = import_protocol.ADB_MAX_PAYLOAD;
  nextLocalId = 1;
  streams = /* @__PURE__ */ new Map();
  /** Whether shell commands can be executed. */
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
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = void 0;
    this.teardown("stopped");
  }
  /**
   * Executes a shell command and returns its output (stdout and stderr combined).
   *
   * @param command - Shell command line, e.g. "dumpsys media_session"
   * @param timeoutMs - Timeout; on expiry the connection is considered broken and re-established
   */
  shell(command, timeoutMs = DEFAULT_SHELL_TIMEOUT_MS) {
    if (!this.ready || !this.socket) {
      return Promise.reject(new Error("ADB not connected"));
    }
    const localId = this.nextLocalId;
    this.nextLocalId = this.nextLocalId >= 2147483647 ? 1 : this.nextLocalId + 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        var _a;
        this.streams.delete(localId);
        reject(
          new Error(`ADB command timed out: ${command.length > 60 ? `${command.slice(0, 60)}\u2026` : command}`)
        );
        (_a = this.socket) == null ? void 0 : _a.destroy(new Error("shell timeout"));
      }, timeoutMs);
      this.streams.set(localId, { remoteId: 0, chunks: [], resolve, reject, timer });
      this.write(import_protocol.AdbCommand.OPEN, localId, 0, Buffer.from(`shell:${command}\0`, "utf8"));
    });
  }
  write(command, arg0, arg1, payload = Buffer.alloc(0)) {
    var _a;
    (_a = this.socket) == null ? void 0 : _a.write((0, import_protocol.encodeAdbPacket)({ command, arg0, arg1, payload }));
  }
  connect() {
    var _a;
    this.decoder.reset();
    this.signatureSent = false;
    this.publicKeySent = false;
    const socket = net.connect({ host: this.options.host, port: (_a = this.options.port) != null ? _a : DEFAULT_ADB_PORT });
    this.socket = socket;
    socket.setNoDelay(true);
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("timeout", () => socket.destroy(new Error("connect timeout")));
    socket.once("connect", () => {
      socket.setTimeout(0);
      socket.setKeepAlive(true, 1e4);
      this.write(import_protocol.AdbCommand.CNXN, import_protocol.ADB_VERSION, import_protocol.ADB_MAX_PAYLOAD, Buffer.from("host::\0", "utf8"));
      this.armHandshakeTimer();
    });
    socket.on("data", (chunk) => this.onData(chunk));
    socket.on(
      "error",
      (err) => this.emit(
        "log",
        "debug",
        `${this.options.host}: ADB socket error: ${[err.code, err.message].filter(Boolean).join(" ")}`
      )
    );
    socket.once("close", () => this.onClose());
  }
  armHandshakeTimer() {
    clearTimeout(this.handshakeTimer);
    this.handshakeTimer = setTimeout(() => {
      var _a;
      this.emit("log", "debug", `${this.options.host}: no ADB handshake answer, reconnecting`);
      (_a = this.socket) == null ? void 0 : _a.destroy();
    }, HANDSHAKE_TIMEOUT_MS);
  }
  onClose() {
    const wasReady = this.ready;
    this.teardown("connection closed");
    if (wasReady) {
      this.emit("disconnected", "connection closed");
    }
    if (!this.running) {
      return;
    }
    const delay = wasReady ? this.minDelay : this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, Math.max(this.options.reconnectMaxMs, this.minDelay));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = void 0;
      if (this.running) {
        this.connect();
      }
    }, delay);
  }
  teardown(reason) {
    clearTimeout(this.handshakeTimer);
    this.handshakeTimer = void 0;
    this.ready = false;
    for (const stream of this.streams.values()) {
      clearTimeout(stream.timer);
      stream.reject(new Error(`ADB ${reason}`));
    }
    this.streams.clear();
    if (this.socket) {
      const old = this.socket;
      this.socket = void 0;
      old.removeAllListeners();
      old.on("error", () => void 0);
      old.destroy();
    }
  }
  onData(chunk) {
    var _a;
    let packets;
    try {
      packets = this.decoder.push(chunk);
    } catch (e) {
      this.emit("log", "warn", `${this.options.host}: ${e.message}`);
      (_a = this.socket) == null ? void 0 : _a.destroy();
      return;
    }
    for (const packet of packets) {
      this.handlePacket(packet);
    }
  }
  handlePacket(p) {
    switch (p.command) {
      case import_protocol.AdbCommand.AUTH:
        this.handleAuth(p);
        break;
      case import_protocol.AdbCommand.CNXN: {
        clearTimeout(this.handshakeTimer);
        this.handshakeTimer = void 0;
        this.maxPayload = Math.min(p.arg1 || import_protocol.ADB_MAX_PAYLOAD, import_protocol.ADB_MAX_PAYLOAD);
        this.ready = true;
        this.reconnectDelay = this.minDelay;
        this.emit("ready", parseBanner(p.payload.toString("utf8")));
        break;
      }
      case import_protocol.AdbCommand.OKAY: {
        const stream = this.streams.get(p.arg1);
        if (stream && !stream.remoteId) {
          stream.remoteId = p.arg0;
        }
        break;
      }
      case import_protocol.AdbCommand.WRTE: {
        const stream = this.streams.get(p.arg1);
        if (stream) {
          stream.chunks.push(p.payload);
        }
        this.write(import_protocol.AdbCommand.OKAY, p.arg1, p.arg0);
        break;
      }
      case import_protocol.AdbCommand.CLSE: {
        const stream = this.streams.get(p.arg1);
        if (stream) {
          this.streams.delete(p.arg1);
          clearTimeout(stream.timer);
          if (stream.remoteId) {
            this.write(import_protocol.AdbCommand.CLSE, p.arg1, stream.remoteId);
            stream.resolve(Buffer.concat(stream.chunks).toString("utf8"));
          } else {
            stream.reject(new Error("ADB stream rejected by device"));
          }
        }
        break;
      }
      default:
        this.emit("log", "debug", `${this.options.host}: ignoring ADB packet ${(0, import_protocol.commandName)(p.command)}`);
    }
  }
  handleAuth(p) {
    if (p.arg0 !== import_protocol.AdbAuthType.TOKEN) {
      return;
    }
    if (!this.signatureSent) {
      this.signatureSent = true;
      this.write(import_protocol.AdbCommand.AUTH, import_protocol.AdbAuthType.SIGNATURE, 0, (0, import_auth.signAdbToken)(this.options.key, p.payload));
      this.armHandshakeTimer();
      return;
    }
    if (!this.publicKeySent) {
      this.publicKeySent = true;
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = void 0;
      this.write(
        import_protocol.AdbCommand.AUTH,
        import_protocol.AdbAuthType.RSAPUBLICKEY,
        0,
        (0, import_auth.adbPublicKeyPayload)(this.options.key, this.options.keyName)
      );
      this.emit("authPending");
    }
  }
  /** Maximum payload size negotiated with the device (for diagnostics). */
  get negotiatedMaxPayload() {
    return this.maxPayload;
  }
}
function parseBanner(banner) {
  var _a;
  const props = /* @__PURE__ */ new Map();
  const body = (_a = banner.replace(/\0+$/, "").split("::")[1]) != null ? _a : "";
  for (const part of body.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      props.set(part.slice(0, idx), part.slice(idx + 1));
    }
  }
  return {
    model: props.get("ro.product.model"),
    product: props.get("ro.product.name"),
    device: props.get("ro.product.device")
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AdbClient,
  DEFAULT_ADB_PORT,
  parseBanner
});
//# sourceMappingURL=client.js.map
