"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_certificate = require("./lib/certificate");
var import_pairing = require("./lib/pairing");
var import_remote = require("./lib/remote");
var import_states = require("./lib/states");
const PAIRING_SESSION_TTL_MS = 12e4;
const DEFAULT_RECONNECT_MAX_S = 60;
const CERT_FILE = "client-certificate.json";
const MESSAGES = {
  pairingStarted: {
    en: 'The TV now shows a 6-character code. Enter it and click "Confirm code".',
    de: "Der TV zeigt jetzt einen 6-stelligen Code. Code eingeben und \u201ECode best\xE4tigen\u201C klicken."
  },
  pairingDone: {
    en: "Pairing successful. The connection is being established.",
    de: "Kopplung erfolgreich. Die Verbindung wird aufgebaut."
  },
  pairingDoneSave: {
    en: "Pairing successful. Save the settings to connect to this TV.",
    de: "Kopplung erfolgreich. Einstellungen speichern, damit die Verbindung aufgebaut wird."
  },
  statusConnected: { en: "Connected", de: "Verbunden" },
  statusPairing: {
    en: 'Pairing required - switch the TV on and click "Start pairing"',
    de: "Kopplung erforderlich - TV einschalten und \u201EKopplung starten\u201C klicken"
  },
  statusOffline: {
    en: "Not connected (TV off, unplugged or unreachable)",
    de: "Nicht verbunden (TV aus, ohne Strom oder nicht erreichbar)"
  },
  statusDisabled: { en: "Disabled", de: "Deaktiviert" },
  statusUnsaved: {
    en: "Not saved yet - pairing is possible, the connection starts after saving",
    de: "Noch nicht gespeichert - Kopplung ist m\xF6glich, die Verbindung startet nach dem Speichern"
  },
  statusNoHost: { en: "Enter the IP address first", de: "Zuerst die IP-Adresse eintragen" },
  noHost: { en: "Please enter the IP address of the TV.", de: "Bitte die IP-Adresse des TV eingeben." },
  noSession: {
    en: 'No pairing in progress for this IP - click "Start pairing" first.',
    de: "F\xFCr diese IP l\xE4uft keine Kopplung - zuerst \u201EKopplung starten\u201C klicken."
  },
  noCertificate: {
    en: "Client certificate not ready yet - wait a few seconds and try again.",
    de: "Client-Zertifikat noch nicht bereit - ein paar Sekunden warten und erneut versuchen."
  },
  connect: {
    en: "Cannot reach the TV on port 6467. Check IP, power and network.",
    de: "TV auf Port 6467 nicht erreichbar. IP, Stromversorgung und Netzwerk pr\xFCfen."
  },
  timeout: { en: "The TV did not answer in time.", de: "Der TV hat nicht rechtzeitig geantwortet." },
  closed: {
    en: "The TV closed the pairing (cancelled or timed out). Start again.",
    de: "Der TV hat die Kopplung beendet (abgebrochen oder Zeit abgelaufen). Erneut starten."
  },
  rejected: { en: "The TV rejected the pairing.", de: "Der TV hat die Kopplung abgelehnt." },
  invalidPin: {
    en: "The code must have 6 characters (0-9, A-F).",
    de: "Der Code muss 6 Zeichen haben (0-9, A-F)."
  },
  wrongPin: {
    en: "The code does not match. Please check it and try again.",
    de: "Der Code passt nicht. Bitte pr\xFCfen und erneut eingeben."
  }
};
function toId(text, forbidden) {
  return text.trim().replace(forbidden, "_").replace(/[\s.]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
class Androidtv extends utils.Adapter {
  devices = /* @__PURE__ */ new Map();
  appsById = /* @__PURE__ */ new Map();
  pairings = /* @__PURE__ */ new Map();
  certificate;
  uiLanguage = "en";
  constructor(options = {}) {
    super({
      ...options,
      name: "androidtv"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    var _a;
    await this.setState("info.connection", false, true);
    const sysConfig = await this.getForeignObjectAsync("system.config");
    this.uiLanguage = ((_a = sysConfig == null ? void 0 : sysConfig.common) == null ? void 0 : _a.language) === "de" ? "de" : "en";
    await this.ensureCertificate();
    const devices = (Array.isArray(this.config.devices) ? this.config.devices : []).filter(
      (d) => d && typeof d.host === "string" && d.host.trim() !== ""
    );
    const apps = (Array.isArray(this.config.apps) ? this.config.apps : []).filter(
      (a) => a && typeof a.name === "string" && a.name.trim() !== "" && typeof a.link === "string" && a.link.trim() !== ""
    );
    for (const app of apps) {
      const id = toId(app.name, this.FORBIDDEN_CHARS);
      if (id && !this.appsById.has(id)) {
        this.appsById.set(id, app);
      }
    }
    const usedIds = /* @__PURE__ */ new Set();
    for (const config of devices) {
      let id = toId(config.name || config.host, this.FORBIDDEN_CHARS) || toId(config.host, this.FORBIDDEN_CHARS);
      for (let n = 2; usedIds.has(id); n++) {
        id = `${toId(config.name || config.host, this.FORBIDDEN_CHARS)}_${n}`;
      }
      usedIds.add(id);
      await this.createDeviceObjects(id, config);
      if (config.enabled === false) {
        continue;
      }
      this.devices.set(id, this.createRuntime(id, config));
    }
    await this.removeStaleObjects(usedIds);
    if (!devices.length) {
      this.log.warn("No devices configured - add your TV in the instance settings.");
    }
    this.subscribeStates("*");
    for (const device of this.devices.values()) {
      device.connection.start();
    }
  }
  /**
   * Loads the client certificate or creates and stores a new one.
   *
   * Storage: adapter file storage `<namespace>/client-certificate.json`, private key encrypted with the
   * instance secret. Older versions kept it in `native` – it is migrated once.
   */
  async ensureCertificate() {
    var _a;
    const fromFile = await this.readCertificateFile();
    if (fromFile) {
      this.certificate = fromFile;
      return;
    }
    const fromNative = { cert: this.config.clientCert, key: this.config.clientKey };
    if ((0, import_certificate.isUsableCertificate)(fromNative)) {
      this.log.info("Moving client certificate from instance configuration to file storage");
      this.certificate = fromNative;
    } else {
      this.log.info("Creating client certificate for pairing (one-time)");
      this.certificate = (0, import_certificate.generateClientCertificate)(((_a = this.config.clientName) == null ? void 0 : _a.trim()) || "ioBroker");
    }
    await this.writeCertificateFile(this.certificate);
  }
  async readCertificateFile() {
    try {
      if (!await this.fileExistsAsync(this.namespace, CERT_FILE)) {
        return void 0;
      }
      const file = await this.readFileAsync(this.namespace, CERT_FILE);
      const raw = typeof file.file === "string" ? file.file : file.file.toString("utf8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.cert !== "string" || typeof parsed.key !== "string") {
        return void 0;
      }
      const candidate = { cert: parsed.cert, key: this.decrypt(parsed.key) };
      if ((0, import_certificate.isUsableCertificate)(candidate)) {
        return candidate;
      }
      this.log.warn("Stored client certificate is invalid or expired - creating a new one (pairing required)");
    } catch (e) {
      this.log.warn(`Cannot read stored client certificate: ${e.message}`);
    }
    return void 0;
  }
  async writeCertificateFile(certificate) {
    await this.setForeignObjectNotExistsAsync(this.namespace, {
      type: "meta",
      common: { name: "Android TV internal files", type: "meta.user" },
      native: {}
    });
    await this.writeFileAsync(
      this.namespace,
      CERT_FILE,
      JSON.stringify({ cert: certificate.cert, key: this.encrypt(certificate.key) })
    );
  }
  createRuntime(id, config) {
    if (!this.certificate) {
      throw new Error("Certificate missing");
    }
    const reconnectMax = Number(this.config.reconnectMax) > 0 ? Number(this.config.reconnectMax) : DEFAULT_RECONNECT_MAX_S;
    const connection = new import_remote.RemoteConnection({
      host: config.host.trim(),
      certificate: this.certificate,
      enableIme: config.enableIme !== false,
      reconnectMaxMs: reconnectMax * 1e3
    });
    const runtime = {
      id,
      config,
      connection,
      connected: false,
      pairingRequired: false,
      muted: void 0
    };
    const label = `${config.name || id} (${config.host})`;
    connection.on("ready", (info, peerCert) => {
      var _a, _b, _c;
      runtime.connected = true;
      runtime.pairingRequired = false;
      this.log.info(`${label}: connected`);
      void this.setDeviceStates(id, {
        "info.connected": true,
        "info.pairingRequired": false,
        "info.model": (_a = info.model) != null ? _a : null,
        "info.manufacturer": (_b = info.vendor) != null ? _b : null,
        "info.remoteServiceVersion": (_c = info.appVersion) != null ? _c : null
      });
      if (peerCert) {
        try {
          const { mac } = (0, import_certificate.parseTvIdentity)(peerCert);
          if (mac) {
            void this.setStateChangedAsync(`${id}.info.mac`, mac, true);
          }
        } catch (e) {
          this.log.debug(`${label}: cannot parse TV certificate: ${e.message}`);
        }
      }
      void this.updateConnectionState();
    });
    connection.on("disconnected", (reason) => {
      runtime.connected = false;
      this.log.debug(`${label}: disconnected (${reason}), reconnecting`);
      void this.setStateChangedAsync(`${id}.info.connected`, false, true);
      void this.updateConnectionState();
    });
    connection.on("unpaired", () => {
      runtime.connected = false;
      runtime.pairingRequired = true;
      this.log.warn(
        `${label}: the TV does not accept this ioBroker instance. Please pair it in the instance settings (tab "Devices").`
      );
      void this.setDeviceStates(id, { "info.connected": false, "info.pairingRequired": true });
      void this.updateConnectionState();
    });
    connection.on("power", (on) => void this.setStateChangedAsync(`${id}.power`, on, true));
    connection.on("currentApp", (app) => void this.setStateChangedAsync(`${id}.currentApp`, app, true));
    connection.on("volume", (volume) => {
      runtime.muted = volume.muted;
      const known = volume.max > 0;
      void this.setDeviceStates(id, {
        volume: known ? volume.level : null,
        volumeMax: known ? volume.max : null,
        muted: volume.muted
      });
    });
    connection.on("log", (level, message) => this.log[level](message));
    return runtime;
  }
  async setDeviceStates(id, values) {
    for (const [key, val] of Object.entries(values)) {
      await this.setStateChangedAsync(`${id}.${key}`, val, true);
    }
  }
  async updateConnectionState() {
    const anyConnected = [...this.devices.values()].some((d) => d.connected);
    await this.setStateChangedAsync("info.connection", anyConnected, true);
  }
  async createDeviceObjects(id, config) {
    await this.extendObjectAsync(id, {
      type: "device",
      common: {
        name: config.name || config.host,
        statusStates: { onlineId: `${this.namespace}.${id}.info.connected` }
      },
      native: { host: config.host }
    });
    await this.extendObjectAsync(`${id}.info`, {
      type: "channel",
      common: { name: { en: "Information", de: "Informationen" } },
      native: {}
    });
    await this.extendObjectAsync(`${id}.keys`, {
      type: "channel",
      common: { name: { en: "Remote keys", de: "Fernbedienungstasten" } },
      native: {}
    });
    await this.extendObjectAsync(`${id}.apps`, {
      type: "channel",
      common: { name: { en: "App favorites", de: "App-Favoriten" } },
      native: {}
    });
    for (const def of import_states.DEVICE_STATES) {
      await this.extendObjectAsync(`${id}.${def.id}`, { type: "state", common: def.common, native: {} });
    }
    for (const btn of import_states.KEY_BUTTONS) {
      await this.extendObjectAsync(`${id}.keys.${btn.id}`, {
        type: "state",
        common: { name: btn.name, type: "boolean", role: btn.role, read: false, write: true },
        native: { key: btn.key }
      });
    }
    for (const [appId, app] of this.appsById) {
      await this.extendObjectAsync(`${id}.apps.${appId}`, {
        type: "state",
        common: { name: app.name, type: "boolean", role: "button", read: false, write: true },
        native: { link: app.link }
      });
    }
  }
  /**
   * Deletes devices and app buttons that are no longer configured.
   *
   * @param deviceIds - Ids of all configured devices
   */
  async removeStaleObjects(deviceIds) {
    const prefix = `${this.namespace}.`;
    const devices = await this.getObjectViewAsync("system", "device", {
      startkey: prefix,
      endkey: `${prefix}\u9999`
    });
    for (const row of devices.rows) {
      const id = row.id.slice(prefix.length);
      if (!deviceIds.has(id)) {
        this.log.info(`Removing objects of device "${id}" (no longer configured)`);
        await this.delObjectAsync(id, { recursive: true });
      }
    }
    for (const id of deviceIds) {
      const appPrefix = `${prefix}${id}.apps.`;
      const states = await this.getObjectViewAsync("system", "state", {
        startkey: appPrefix,
        endkey: `${appPrefix}\u9999`
      });
      for (const row of states.rows) {
        if (!this.appsById.has(row.id.slice(appPrefix.length))) {
          await this.delObjectAsync(row.id.slice(prefix.length));
        }
      }
    }
  }
  onStateChange(fullId, state) {
    if (!state || state.ack) {
      return;
    }
    const parts = fullId.slice(this.namespace.length + 1).split(".");
    const device = this.devices.get(parts[0]);
    if (!device) {
      return;
    }
    const command = parts.slice(1).join(".");
    try {
      this.handleCommand(device, command, state);
    } catch (e) {
      this.log.warn(`${device.config.name || device.id}: command "${command}" failed: ${e.message}`);
    }
  }
  /**
   * Executes a user command (ack=false) on a device.
   *
   * @param device - Target device
   * @param command - State id relative to the device
   * @param state - New state
   */
  handleCommand(device, command, state) {
    const conn = device.connection;
    const ack = () => void this.setState(`${device.id}.${command}`, { val: state.val, ack: true });
    if (command.startsWith("keys.")) {
      const btn = import_states.KEY_BUTTONS.find((b) => b.id === command.slice(5));
      if (btn) {
        conn.sendKey(btn.key);
        ack();
      }
      return;
    }
    if (command.startsWith("apps.")) {
      const app = this.appsById.get(command.slice(5));
      if (app) {
        conn.launchApp(app.link);
        ack();
      }
      return;
    }
    switch (command) {
      case "power": {
        const wanted = !!state.val;
        if (conn.isOn === wanted) {
          ack();
        } else {
          conn.sendKey("POWER");
        }
        return;
      }
      case "muted":
        if (device.muted === !!state.val) {
          ack();
        } else {
          conn.sendKey("VOLUME_MUTE");
        }
        return;
      case "launchApp":
        if (typeof state.val === "string" && state.val.trim()) {
          conn.launchApp(state.val);
          ack();
        }
        return;
      case "sendKey": {
        const key = state.val === null || state.val === void 0 ? "" : String(state.val);
        if ((0, import_remote.resolveKeyCode)(key) === void 0) {
          throw new Error(`unknown key "${key}"`);
        }
        conn.sendKey(key);
        ack();
        return;
      }
      case "sendText":
        if (typeof state.val === "string" && state.val !== "") {
          conn.sendText(state.val);
          ack();
        }
        return;
      default:
        this.log.debug(`Ignoring write to read-only or unknown state ${device.id}.${command}`);
    }
  }
  text(key) {
    return MESSAGES[key][this.uiLanguage];
  }
  reply(obj, payload) {
    if (obj.callback) {
      this.sendTo(obj.from, obj.command, payload, obj.callback);
    }
  }
  async onMessage(obj) {
    var _a, _b;
    if (!obj || typeof obj !== "object") {
      return;
    }
    const msg = (_a = obj.message) != null ? _a : {};
    const host = typeof msg.host === "string" ? msg.host.trim() : "";
    try {
      switch (obj.command) {
        case "startPairing":
          await this.startPairing(host);
          this.reply(obj, { result: this.text("pairingStarted") });
          break;
        case "finishPairing": {
          const configured = await this.finishPairing(host, typeof msg.pin === "string" ? msg.pin : "");
          this.reply(obj, { result: this.text(configured ? "pairingDone" : "pairingDoneSave") });
          break;
        }
        case "deviceStatus":
          this.reply(obj, this.deviceStatus(host, ((_b = obj.message) == null ? void 0 : _b.enabled) !== false));
          return;
        default:
          this.log.debug(`Unknown message command "${obj.command}"`);
      }
    } catch (e) {
      const key = e instanceof import_pairing.PairingError ? e.code : e instanceof Error && e.message in MESSAGES ? e.message : "closed";
      this.log.warn(`Pairing with ${host || "?"} failed: ${e.message}`);
      this.reply(obj, { error: this.text(key) });
    }
  }
  /**
   * Status line for one device in the admin UI (`textSendTo`).
   *
   * @param host - Host as currently entered in the form (may be unsaved)
   * @param enabled - Checkbox value in the form
   */
  deviceStatus(host, enabled) {
    const grey = { color: "#888888" };
    if (!host) {
      return { text: this.text("statusNoHost"), icon: "connection", style: grey };
    }
    if (!enabled) {
      return { text: this.text("statusDisabled"), icon: "no-connection", style: grey };
    }
    const device = [...this.devices.values()].find((d) => d.config.host.trim() === host);
    if (!device) {
      return { text: this.text("statusUnsaved"), icon: "pair", style: grey };
    }
    if (device.connected) {
      return { text: this.text("statusConnected"), icon: "connection", style: { color: "#2e7d32" } };
    }
    if (device.pairingRequired) {
      return { text: this.text("statusPairing"), icon: "pair", style: { color: "#ed6c02" } };
    }
    return { text: this.text("statusOffline"), icon: "no-connection", style: { color: "#d32f2f" } };
  }
  async startPairing(host) {
    var _a;
    if (!host) {
      throw new Error("noHost");
    }
    if (!this.certificate) {
      throw new Error("noCertificate");
    }
    this.dropPairing(host);
    const session = new import_pairing.PairingSession({
      host,
      clientName: ((_a = this.config.clientName) == null ? void 0 : _a.trim()) || "ioBroker",
      certificate: this.certificate
    });
    const pending = { session, timer: void 0 };
    this.pairings.set(host, pending);
    try {
      await session.start();
    } catch (e) {
      this.dropPairing(host);
      throw e;
    }
    pending.timer = this.setTimeout(() => this.dropPairing(host), PAIRING_SESSION_TTL_MS);
  }
  /**
   * Completes pairing and reconnects matching devices.
   *
   * @param host - TV address
   * @param pin - Code shown on the TV
   * @returns true if a running device uses this host
   */
  async finishPairing(host, pin) {
    if (!host) {
      throw new Error("noHost");
    }
    const pending = this.pairings.get(host);
    if (!(pending == null ? void 0 : pending.session.isOpen)) {
      this.dropPairing(host);
      throw new Error("noSession");
    }
    try {
      await pending.session.finish(pin);
    } catch (e) {
      if (!(e instanceof import_pairing.PairingError && (e.code === "wrongPin" || e.code === "invalidPin"))) {
        this.dropPairing(host);
      }
      throw e;
    }
    this.dropPairing(host);
    this.log.info(`Pairing with ${host} successful`);
    let configured = false;
    for (const device of this.devices.values()) {
      if (device.config.host.trim() === host) {
        configured = true;
        device.pairingRequired = false;
        await this.setStateChangedAsync(`${device.id}.info.pairingRequired`, false, true);
        device.connection.restart();
      }
    }
    return configured;
  }
  dropPairing(host) {
    const pending = this.pairings.get(host);
    if (pending) {
      this.clearTimeout(pending.timer);
      pending.session.close();
      this.pairings.delete(host);
    }
  }
  onUnload(callback) {
    try {
      for (const host of [...this.pairings.keys()]) {
        this.dropPairing(host);
      }
      for (const device of this.devices.values()) {
        device.connection.stop();
        device.connection.removeAllListeners();
      }
      this.devices.clear();
      callback();
    } catch (error) {
      this.log.error(`Error during unloading: ${error.message}`);
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Androidtv(options);
} else {
  (() => new Androidtv())();
}
//# sourceMappingURL=main.js.map
