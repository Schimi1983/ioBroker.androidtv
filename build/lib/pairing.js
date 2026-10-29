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
var pairing_exports = {};
__export(pairing_exports, {
  DEFAULT_PAIRING_PORT: () => DEFAULT_PAIRING_PORT,
  PairingError: () => PairingError,
  PairingSession: () => PairingSession
});
module.exports = __toCommonJS(pairing_exports);
var tls = __toESM(require("node:tls"));
var import_certificate = require("./certificate");
var import_messages = require("./messages");
var import_protobuf = require("./protobuf");
var import_timers = require("./timers");
const DEFAULT_PAIRING_PORT = 6467;
const STEP_TIMEOUT_MS = 1e4;
class PairingError extends Error {
  /**
   * @param code - Reason code (translated in admin)
   * @param message - Technical message
   */
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "PairingError";
  }
}
class PairingSession {
  /** @param options - Connection and identity */
  constructor(options) {
    this.options = options;
  }
  socket;
  decoder = new import_protobuf.FrameDecoder();
  waiter;
  closedError;
  serverCertificate;
  /** Timer functions: injected by the adapter or plain Node timers. */
  get timers() {
    var _a;
    return (_a = this.options.timers) != null ? _a : import_timers.NODE_TIMERS;
  }
  /** Whether the TLS connection is still open. */
  get isOpen() {
    return !!this.socket && !this.socket.destroyed;
  }
  /** Connects and runs the handshake until the TV displays the code. */
  async start() {
    await this.connect();
    this.send((0, import_messages.encodePairingRequest)(this.options.clientName));
    await this.waitFor("pairingRequestAck");
    this.send((0, import_messages.encodePairingOptions)());
    await this.waitFor("options");
    this.send((0, import_messages.encodePairingConfiguration)());
    await this.waitFor("configurationAck");
  }
  /**
   * Sends the secret derived from the PIN and waits for the TV to accept it.
   *
   * @param pin - Code shown on the TV
   */
  async finish(pin) {
    if (!this.socket || this.socket.destroyed) {
      throw new PairingError("closed", "Pairing connection is closed - start pairing again");
    }
    if (!/^[0-9a-fA-F]{6}$/.test(pin.trim())) {
      throw new PairingError("invalidPin", "The code must consist of 6 characters (0-9, A-F)");
    }
    const serverDer = this.serverCertificate;
    if (!serverDer) {
      throw new PairingError("closed", "TV certificate not available");
    }
    const secret = (0, import_certificate.computePairingSecret)(
      (0, import_certificate.rsaPartsFromPem)(this.options.certificate.cert),
      (0, import_certificate.rsaPartsFromDer)(serverDer),
      pin
    );
    if (!secret) {
      throw new PairingError("wrongPin", "The code does not match - please check it");
    }
    this.send((0, import_messages.encodePairingSecret)(secret));
    try {
      await this.waitFor("secretAck");
    } finally {
      this.close();
    }
  }
  /** Closes the connection; pending waits are rejected. */
  close() {
    var _a;
    (_a = this.socket) == null ? void 0 : _a.destroy();
    this.socket = void 0;
  }
  connect() {
    return new Promise((resolve, reject) => {
      var _a;
      const socket = tls.connect({
        host: this.options.host,
        port: (_a = this.options.port) != null ? _a : DEFAULT_PAIRING_PORT,
        cert: this.options.certificate.cert,
        key: this.options.certificate.key,
        // @KI_HINWEIS: Die TV-Zertifikate sind selbstsigniert; Vertrauen entsteht durch das PIN-Pairing.
        rejectUnauthorized: false,
        timeout: STEP_TIMEOUT_MS
      });
      this.socket = socket;
      const onError = (err) => {
        reject(new PairingError("connect", `Cannot connect: ${err.message}`));
      };
      socket.once("error", onError);
      socket.once("timeout", () => socket.destroy(new Error("connect timeout")));
      socket.once("secureConnect", () => {
        var _a2;
        socket.off("error", onError);
        this.serverCertificate = (_a2 = socket.getPeerCertificate(true)) == null ? void 0 : _a2.raw;
        socket.setTimeout(0);
        socket.on("data", (chunk) => this.onData(chunk));
        socket.on("error", (err) => this.fail(new PairingError("closed", err.message)));
        socket.on("close", () => this.fail(new PairingError("closed", "Connection closed by TV")));
        resolve();
      });
    });
  }
  send(payload) {
    var _a;
    (_a = this.socket) == null ? void 0 : _a.write((0, import_protobuf.frame)(payload));
  }
  onData(chunk) {
    let frames;
    try {
      frames = this.decoder.push(chunk);
    } catch (e) {
      this.fail(new PairingError("closed", e.message));
      return;
    }
    for (const raw of frames) {
      const msg = (0, import_messages.decodePairingMessage)(raw);
      if (msg.status !== import_messages.PairingStatus.OK) {
        this.fail(new PairingError("rejected", `TV answered with status ${msg.status}`));
        return;
      }
      if (this.waiter && msg.kind === this.waiter.expect) {
        const w = this.waiter;
        this.waiter = void 0;
        this.timers.clearTimeout(w.timer);
        w.resolve();
      }
    }
  }
  fail(err) {
    var _a;
    (_a = this.closedError) != null ? _a : this.closedError = err;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = void 0;
      this.timers.clearTimeout(w.timer);
      w.reject(err);
    }
    this.close();
  }
  waitFor(expect) {
    var _a;
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject((_a = this.closedError) != null ? _a : new PairingError("closed", "Connection closed"));
    }
    return new Promise((resolve, reject) => {
      const timer = this.timers.setTimeout(() => {
        this.waiter = void 0;
        reject(new PairingError("timeout", `No answer from TV (${expect})`));
        this.close();
      }, STEP_TIMEOUT_MS);
      this.waiter = { expect, resolve, reject, timer };
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PAIRING_PORT,
  PairingError,
  PairingSession
});
//# sourceMappingURL=pairing.js.map
