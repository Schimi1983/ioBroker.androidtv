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
var import_auth = require("./lib/adb/auth");
var import_client = require("./lib/adb/client");
var import_device = require("./lib/adb/device");
var import_certificate = require("./lib/certificate");
var import_pairing = require("./lib/pairing");
var import_remote = require("./lib/remote");
var import_states = require("./lib/states");
const PAIRING_SESSION_TTL_MS = 12e4;
const DEFAULT_RECONNECT_MAX_S = 60;
const DEFAULT_ADB_POLL_S = 5;
const CERT_FILE = "client-certificate.json";
const ADB_KEY_FILE = "adb-key.json";
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
  statusAdbPending: {
    en: 'ADB: confirm "Allow debugging" on the TV (tick "Always allow")',
    de: "ADB: \u201EDebugging zulassen\u201C am TV best\xE4tigen (\u201EImmer zulassen\u201C anhaken)"
  },
  statusAdbOffline: {
    en: "ADB not connected (network debugging enabled on the TV?)",
    de: "ADB nicht verbunden (Netzwerk-Debugging am TV aktiviert?)"
  },
  statusAdbOk: { en: "ADB connected", de: "ADB verbunden" },
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
    en: 'Cannot reach the TV on port 6467. Check IP, power and network. Fire TV devices do not support pairing - use "ADB only".',
    de: "TV auf Port 6467 nicht erreichbar. IP, Stromversorgung und Netzwerk pr\xFCfen. Fire-TV-Ger\xE4te unterst\xFCtzen keine Kopplung - \u201ENur ADB\u201C w\xE4hlen."
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
  const umlauts = { \u00E4: "ae", \u00F6: "oe", \u00FC: "ue", \u00C4: "Ae", \u00D6: "Oe", \u00DC: "Ue", \u00DF: "ss" };
  return text.trim().replace(/[äöüÄÖÜß]/g, (c) => {
    var _a;
    return (_a = umlauts[c]) != null ? _a : c;
  }).replace(forbidden, "_").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
function modeOf(config) {
  return config.connection === "adb" || config.connection === "remote_adb" ? config.connection : "remote";
}
function isLink(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target.trim());
}
class Androidtv extends utils.Adapter {
  devices = /* @__PURE__ */ new Map();
  appsById = /* @__PURE__ */ new Map();
  pairings = /* @__PURE__ */ new Map();
  certificate;
  adbKey;
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
    var _a, _b, _c;
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
    if (devices.some((d) => d.enabled !== false && modeOf(d) !== "remote")) {
      await this.ensureAdbKey();
    }
    const usedIds = /* @__PURE__ */ new Set();
    for (const config of devices) {
      const base = toId(config.name || config.host, this.FORBIDDEN_CHARS) || toId(config.host, this.FORBIDDEN_CHARS);
      let id = base;
      for (let n = 2; usedIds.has(id); n++) {
        id = `${base}_${n}`;
      }
      usedIds.add(id);
      await this.createDeviceObjects(id, config);
      if (config.enabled === false) {
        continue;
      }
      this.devices.set(id, this.createRuntime(id, config));
    }
    await this.removeStaleObjects(usedIds, devices);
    if (!devices.length) {
      this.log.warn("No devices configured - add your TV in the instance settings.");
    }
    this.subscribeStates("*");
    for (const device of this.devices.values()) {
      (_b = device.remote) == null ? void 0 : _b.start();
      (_c = device.adb) == null ? void 0 : _c.start();
    }
  }
  // ------------------------------------------------------------------------------------------------------------
  // Keys and certificates (adapter file storage, private keys encrypted with the instance secret)
  // ------------------------------------------------------------------------------------------------------------
  /**
   * Loads the client certificate or creates and stores a new one.
   *
   * Storage: adapter file storage `<namespace>/client-certificate.json`, private key encrypted with the
   * instance secret. Older versions kept it in `native` – it is migrated once.
   */
  async ensureCertificate() {
    var _a;
    const stored = await this.readSecretFile(CERT_FILE);
    if (typeof (stored == null ? void 0 : stored.cert) === "string" && typeof stored.key === "string") {
      const candidate = { cert: stored.cert, key: this.decrypt(stored.key) };
      if ((0, import_certificate.isUsableCertificate)(candidate)) {
        this.certificate = candidate;
        return;
      }
      this.log.warn("Stored client certificate is invalid or expired - creating a new one (pairing required)");
    }
    const fromNative = { cert: this.config.clientCert, key: this.config.clientKey };
    if ((0, import_certificate.isUsableCertificate)(fromNative)) {
      this.log.info("Moving client certificate from instance configuration to file storage");
      this.certificate = fromNative;
    } else {
      this.log.info("Creating client certificate for pairing (one-time)");
      this.certificate = (0, import_certificate.generateClientCertificate)(((_a = this.config.clientName) == null ? void 0 : _a.trim()) || "ioBroker");
    }
    await this.writeSecretFile(CERT_FILE, { cert: this.certificate.cert, key: this.encrypt(this.certificate.key) });
  }
  /** Loads or creates the RSA key used for ADB authentication. */
  async ensureAdbKey() {
    const stored = await this.readSecretFile(ADB_KEY_FILE);
    if (typeof (stored == null ? void 0 : stored.key) === "string") {
      try {
        const privateKey = this.decrypt(stored.key);
        if (privateKey.includes("PRIVATE KEY")) {
          this.adbKey = { privateKey };
          return;
        }
      } catch (e) {
        this.log.warn(`Cannot read stored ADB key: ${e.message}`);
      }
    }
    this.log.info('Creating ADB key (one-time) - confirm "Allow debugging" on the TV at the first connection');
    this.adbKey = (0, import_auth.generateAdbKey)();
    await this.writeSecretFile(ADB_KEY_FILE, { key: this.encrypt(this.adbKey.privateKey) });
  }
  async readSecretFile(name) {
    try {
      if (!await this.fileExistsAsync(this.namespace, name)) {
        return void 0;
      }
      const file = await this.readFileAsync(this.namespace, name);
      const raw = typeof file.file === "string" ? file.file : file.file.toString("utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : void 0;
    } catch (e) {
      this.log.warn(`Cannot read ${name}: ${e.message}`);
      return void 0;
    }
  }
  async writeSecretFile(name, content) {
    await this.setForeignObjectNotExistsAsync(this.namespace, {
      type: "meta",
      common: { name: "Android TV internal files", type: "meta.user" },
      native: {}
    });
    await this.writeFileAsync(this.namespace, name, JSON.stringify(content));
  }
  // ------------------------------------------------------------------------------------------------------------
  // Device runtime
  // ------------------------------------------------------------------------------------------------------------
  createRuntime(id, config) {
    var _a;
    const mode = modeOf(config);
    const reconnectMax = Number(this.config.reconnectMax) > 0 ? Number(this.config.reconnectMax) : DEFAULT_RECONNECT_MAX_S;
    const runtime = {
      id,
      config,
      mode,
      label: `${config.name || id} (${config.host})`,
      remoteConnected: false,
      adbConnected: false,
      adbAuthPending: false,
      pairingRequired: false,
      muted: void 0
    };
    if (mode !== "adb") {
      if (!this.certificate) {
        throw new Error("Certificate missing");
      }
      runtime.remote = new import_remote.RemoteConnection({
        host: config.host.trim(),
        certificate: this.certificate,
        enableIme: config.enableIme !== false,
        reconnectMaxMs: reconnectMax * 1e3
      });
      this.attachRemote(runtime, runtime.remote);
    }
    if (mode !== "remote") {
      if (!this.adbKey) {
        throw new Error("ADB key missing");
      }
      const pollS = Number(this.config.adbPollInterval) >= 2 ? Number(this.config.adbPollInterval) : DEFAULT_ADB_POLL_S;
      const port = Number(config.adbPort) > 0 ? Number(config.adbPort) : import_client.DEFAULT_ADB_PORT;
      runtime.adb = new import_device.AdbDevice({
        host: config.host.trim(),
        port,
        key: this.adbKey,
        keyName: `ioBroker@${(_a = this.host) != null ? _a : "iobroker"}`,
        pollIntervalMs: pollS * 1e3,
        reconnectMaxMs: reconnectMax * 1e3,
        externalPower: () => {
          var _a2;
          return runtime.remoteConnected ? (_a2 = runtime.remote) == null ? void 0 : _a2.isOn : void 0;
        }
      });
      this.attachAdb(runtime, runtime.adb);
    }
    return runtime;
  }
  attachRemote(runtime, remote) {
    const { id, label } = runtime;
    remote.on("ready", (info, peerCert) => {
      var _a, _b, _c;
      runtime.remoteConnected = true;
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
    remote.on("disconnected", (reason) => {
      runtime.remoteConnected = false;
      this.log.debug(`${label}: disconnected (${reason}), reconnecting`);
      void this.setStateChangedAsync(`${id}.info.connected`, false, true);
      void this.updateConnectionState();
    });
    remote.on("unpaired", () => {
      runtime.remoteConnected = false;
      runtime.pairingRequired = true;
      this.log.warn(
        `${label}: the TV does not accept this ioBroker instance. Please pair it in the instance settings (tab "Devices").`
      );
      void this.setDeviceStates(id, { "info.connected": false, "info.pairingRequired": true });
      void this.updateConnectionState();
    });
    remote.on("power", (on) => {
      var _a;
      void this.setStateChangedAsync(`${id}.power`, on, true);
      if (on) {
        (_a = runtime.adb) == null ? void 0 : _a.pollSoon();
      } else if (runtime.adb) {
        void this.setMediaStates(id, null);
      }
    });
    remote.on("currentApp", (app) => {
      var _a;
      void this.setStateChangedAsync(`${id}.currentApp`, app, true);
      (_a = runtime.adb) == null ? void 0 : _a.pollSoon();
    });
    remote.on("volume", (volume) => {
      runtime.muted = volume.muted;
      const known = volume.max > 0;
      void this.setDeviceStates(id, {
        volume: known ? volume.level : null,
        volumeMax: known ? volume.max : null,
        muted: volume.muted
      });
    });
    remote.on("log", (level, message) => this.log[level](message));
  }
  attachAdb(runtime, adb) {
    const { id, label } = runtime;
    const adbOnly = runtime.mode === "adb";
    adb.on("ready", (info) => {
      var _a;
      runtime.adbConnected = true;
      runtime.adbAuthPending = false;
      this.log.info(`${label}: ADB connected${info.model ? ` (${info.model})` : ""}`);
      const values = {
        "info.adbConnected": true,
        "info.adbAuthorizationPending": false
      };
      if (adbOnly) {
        values["info.connected"] = true;
        values["info.model"] = (_a = info.model) != null ? _a : null;
      }
      void this.setDeviceStates(id, values);
      void this.updateConnectionState();
    });
    adb.on("authPending", () => {
      var _a;
      runtime.adbAuthPending = true;
      this.log.warn(
        `${label}: confirm "Allow debugging" on the TV and tick "Always allow from this computer" (key ioBroker@${(_a = this.host) != null ? _a : "iobroker"})`
      );
      void this.setStateChangedAsync(`${id}.info.adbAuthorizationPending`, true, true);
    });
    adb.on("disconnected", () => {
      runtime.adbConnected = false;
      this.log.debug(`${label}: ADB disconnected, reconnecting`);
      const values = { "info.adbConnected": false };
      if (adbOnly) {
        values["info.connected"] = false;
      }
      void this.setDeviceStates(id, values);
      void this.updateConnectionState();
    });
    adb.on("poll", (result) => void this.applyPoll(runtime, result));
    adb.on("log", (level, message) => this.log[level](message));
  }
  /**
   * Writes the result of an ADB poll to the states.
   *
   * @param runtime - Device
   * @param result - Parsed poll output
   */
  async applyPoll(runtime, result) {
    const { id } = runtime;
    if (runtime.mode === "adb") {
      if (result.awake !== void 0) {
        await this.setStateChangedAsync(`${id}.power`, result.awake, true);
      }
      if (result.currentApp) {
        await this.setStateChangedAsync(`${id}.currentApp`, result.currentApp, true);
      }
    }
    if (result.awake === false) {
      await this.setMediaStates(id, null);
    } else if (result.media !== void 0) {
      await this.setMediaStates(id, result.media);
    }
  }
  async setMediaStates(id, media) {
    var _a, _b, _c, _d, _e;
    await this.setDeviceStates(id, {
      "media.state": (_a = media == null ? void 0 : media.state) != null ? _a : "idle",
      "media.title": (_b = media == null ? void 0 : media.title) != null ? _b : null,
      "media.subtitle": (_c = media == null ? void 0 : media.subtitle) != null ? _c : null,
      "media.app": (_d = media == null ? void 0 : media.app) != null ? _d : null,
      "media.position": (_e = media == null ? void 0 : media.position) != null ? _e : null
    });
  }
  async setDeviceStates(id, values) {
    for (const [key, val] of Object.entries(values)) {
      await this.setStateChangedAsync(`${id}.${key}`, val, true);
    }
  }
  async updateConnectionState() {
    const anyConnected = [...this.devices.values()].some(
      (d) => d.mode === "adb" ? d.adbConnected : d.remoteConnected
    );
    await this.setStateChangedAsync("info.connection", anyConnected, true);
  }
  // ------------------------------------------------------------------------------------------------------------
  // Objects
  // ------------------------------------------------------------------------------------------------------------
  /**
   * State definitions that apply to a device in its connection mode.
   *
   * @param config - Device configuration
   */
  stateDefinitionsFor(config) {
    const mode = modeOf(config);
    const base = import_states.DEVICE_STATES.filter((d) => mode !== "adb" || !d.remoteOnly);
    return mode === "remote" ? base : [...base, ...import_states.ADB_STATES];
  }
  async createDeviceObjects(id, config) {
    const mode = modeOf(config);
    await this.extendObjectAsync(id, {
      type: "device",
      common: {
        name: config.name || config.host,
        statusStates: { onlineId: `${this.namespace}.${id}.info.connected` }
      },
      native: { host: config.host, connection: mode }
    });
    const channels = [
      ["info", { en: "Information", de: "Informationen" }],
      ["keys", { en: "Remote keys", de: "Fernbedienungstasten" }],
      ["apps", { en: "App favorites", de: "App-Favoriten" }]
    ];
    if (mode !== "remote") {
      channels.push(["media", { en: "Media (via ADB)", de: "Medien (\xFCber ADB)" }]);
    }
    for (const [channel, name] of channels) {
      await this.extendObjectAsync(`${id}.${channel}`, { type: "channel", common: { name }, native: {} });
    }
    for (const def of this.stateDefinitionsFor(config)) {
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
   * Deletes devices, states and channels that no longer apply (device removed, app removed, mode changed).
   *
   * @param deviceIds - Ids of all configured devices
   * @param configs - Device configurations (same order as ids were assigned)
   */
  async removeStaleObjects(deviceIds, configs) {
    const prefix = `${this.namespace}.`;
    const range = (start) => ({
      startkey: start,
      endkey: `${start}\u9999`
    });
    const devices = await this.getObjectViewAsync("system", "device", range(prefix));
    for (const row of devices.rows) {
      const id = row.id.slice(prefix.length);
      if (!deviceIds.has(id)) {
        this.log.info(`Removing objects of device "${id}" (no longer configured)`);
        await this.delObjectAsync(id, { recursive: true });
      }
    }
    const ids = [...deviceIds];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const config = configs[i];
      const expected = /* @__PURE__ */ new Set([
        ...this.stateDefinitionsFor(config).map((d) => d.id),
        ...import_states.KEY_BUTTONS.map((b) => `keys.${b.id}`),
        ...[...this.appsById.keys()].map((a) => `apps.${a}`)
      ]);
      const devPrefix = `${prefix}${id}.`;
      const states = await this.getObjectViewAsync("system", "state", range(devPrefix));
      for (const row of states.rows) {
        const rel = row.id.slice(devPrefix.length);
        if (!expected.has(rel)) {
          await this.delObjectAsync(row.id.slice(prefix.length));
        }
      }
      if (modeOf(config) === "remote") {
        const media = await this.getObjectAsync(`${id}.media`);
        if (media) {
          await this.delObjectAsync(`${id}.media`);
        }
      }
    }
  }
  // ------------------------------------------------------------------------------------------------------------
  // Commands
  // ------------------------------------------------------------------------------------------------------------
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
    this.handleCommand(device, command, state).catch(
      (e) => this.log.warn(`${device.config.name || device.id}: command "${command}" failed: ${e.message}`)
    );
  }
  /**
   * Executes a user command (ack=false) on a device, using Remote v2 where possible and ADB otherwise.
   *
   * @param device - Target device
   * @param command - State id relative to the device
   * @param state - New state
   */
  async handleCommand(device, command, state) {
    var _a, _b, _c;
    const ack = () => void this.setState(`${device.id}.${command}`, { val: state.val, ack: true });
    if (command.startsWith("keys.")) {
      const btn = import_states.KEY_BUTTONS.find((b) => b.id === command.slice(5));
      if (btn) {
        await this.sendKey(device, btn.key);
        ack();
      }
      return;
    }
    if (command.startsWith("apps.")) {
      const app = this.appsById.get(command.slice(5));
      if (app) {
        await this.launch(device, app.link);
        ack();
      }
      return;
    }
    switch (command) {
      case "power":
        await this.setPower(device, !!state.val, ack);
        return;
      case "muted":
        if (device.muted === !!state.val) {
          ack();
        } else {
          await this.sendKey(device, "VOLUME_MUTE");
          if (!((_a = device.remote) == null ? void 0 : _a.isReady)) {
            ack();
          }
        }
        return;
      case "launchApp":
        if (typeof state.val === "string" && state.val.trim()) {
          await this.launch(device, state.val);
          ack();
        }
        return;
      case "sendKey": {
        const key = state.val === null || state.val === void 0 ? "" : String(state.val);
        if ((0, import_remote.resolveKeyCode)(key) === void 0) {
          throw new Error(`unknown key "${key}"`);
        }
        await this.sendKey(device, key);
        ack();
        return;
      }
      case "sendText":
        if (typeof state.val === "string" && state.val !== "") {
          if (((_b = device.remote) == null ? void 0 : _b.isReady) && device.config.enableIme !== false) {
            device.remote.sendText(state.val);
          } else if ((_c = device.adb) == null ? void 0 : _c.isReady) {
            await device.adb.sendText(state.val);
          } else {
            throw new Error("not connected");
          }
          ack();
        }
        return;
      default:
        this.log.debug(`Ignoring write to read-only or unknown state ${device.id}.${command}`);
    }
  }
  async sendKey(device, key) {
    var _a, _b;
    if ((_a = device.remote) == null ? void 0 : _a.isReady) {
      device.remote.sendKey(key);
    } else if ((_b = device.adb) == null ? void 0 : _b.isReady) {
      await device.adb.sendKey(key);
    } else {
      throw new Error("not connected");
    }
  }
  /**
   * Starts an app: https deep links preferably via Remote v2, package names preferably via ADB.
   *
   * @param device - Target device
   * @param target - Deep link or package name
   */
  async launch(device, target) {
    var _a, _b, _c;
    const preferAdb = !isLink(target);
    if (preferAdb && ((_a = device.adb) == null ? void 0 : _a.isReady)) {
      await device.adb.launch(target);
    } else if ((_b = device.remote) == null ? void 0 : _b.isReady) {
      device.remote.launchApp(target);
    } else if ((_c = device.adb) == null ? void 0 : _c.isReady) {
      await device.adb.launch(target);
    } else {
      throw new Error("not connected");
    }
  }
  /**
   * Switches the device on/off. Remote v2 only knows the POWER toggle, ADB has idempotent WAKEUP/SLEEP.
   * The ack is set by the state feedback of the device (remote_start or ADB poll).
   *
   * @param device - Target device
   * @param wanted - Desired state
   * @param ack - Acknowledges the command immediately
   */
  async setPower(device, wanted, ack) {
    var _a, _b;
    if ((_a = device.remote) == null ? void 0 : _a.isReady) {
      if (device.remote.isOn === wanted) {
        ack();
      } else {
        device.remote.sendKey("POWER");
      }
    } else if ((_b = device.adb) == null ? void 0 : _b.isReady) {
      await device.adb.setPower(wanted);
    } else {
      throw new Error("not connected");
    }
  }
  // ------------------------------------------------------------------------------------------------------------
  // Admin messages (pairing, status)
  // ------------------------------------------------------------------------------------------------------------
  text(key) {
    return MESSAGES[key][this.uiLanguage];
  }
  reply(obj, payload) {
    if (obj.callback) {
      this.sendTo(obj.from, obj.command, payload, obj.callback);
    }
  }
  async onMessage(obj) {
    var _a;
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
          this.reply(obj, this.deviceStatus(host, msg.enabled !== false));
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
    const green = { color: "#2e7d32" };
    const orange = { color: "#ed6c02" };
    const red = { color: "#d32f2f" };
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
    const adbPart = () => device.adbConnected ? { key: "statusAdbOk", style: green } : device.adbAuthPending ? { key: "statusAdbPending", style: orange } : { key: "statusAdbOffline", style: red };
    if (device.mode === "adb") {
      const a = adbPart();
      return {
        text: this.text(a.key === "statusAdbOk" ? "statusConnected" : a.key),
        icon: device.adbConnected ? "connection" : "no-connection",
        style: a.style
      };
    }
    let main;
    if (device.remoteConnected) {
      main = { text: this.text("statusConnected"), icon: "connection", style: green };
    } else if (device.pairingRequired) {
      main = { text: this.text("statusPairing"), icon: "pair", style: orange };
    } else {
      main = { text: this.text("statusOffline"), icon: "no-connection", style: red };
    }
    if (device.mode === "remote_adb") {
      const a = adbPart();
      main.text = `${main.text} \xB7 ${this.text(a.key)}`;
      if (main.style === green && a.style !== green) {
        main.style = a.style;
      }
    }
    return main;
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
      if (device.config.host.trim() === host && device.remote) {
        configured = true;
        device.pairingRequired = false;
        await this.setStateChangedAsync(`${device.id}.info.pairingRequired`, false, true);
        device.remote.restart();
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
    var _a, _b, _c, _d;
    try {
      for (const host of [...this.pairings.keys()]) {
        this.dropPairing(host);
      }
      for (const device of this.devices.values()) {
        (_a = device.remote) == null ? void 0 : _a.stop();
        (_b = device.remote) == null ? void 0 : _b.removeAllListeners();
        (_c = device.adb) == null ? void 0 : _c.stop();
        (_d = device.adb) == null ? void 0 : _d.removeAllListeners();
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
