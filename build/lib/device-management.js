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
var device_management_exports = {};
__export(device_management_exports, {
  AndroidTvDeviceManagement: () => AndroidTvDeviceManagement
});
module.exports = __toCommonJS(device_management_exports);
var import_dm_utils = require("@iobroker/dm-utils");
var import_dm_texts = require("./dm-texts");
var import_discovery = require("./discovery");
const MAC_PATTERN = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const PAIRING_ATTEMPTS = 3;
const CONTROL_STATES = {
  power: "power",
  muted: "muted",
  volumeDown: "keys.volumeDown",
  volumeUp: "keys.volumeUp",
  playPause: "keys.playPause",
  home: "keys.home"
};
class AndroidTvDeviceManagement extends import_dm_utils.DeviceManagement {
  bridge;
  /**
   * @param adapter - Adapter instance
   * @param bridge - Access to the device logic of the adapter
   */
  constructor(adapter, bridge) {
    super(adapter);
    this.bridge = bridge;
  }
  getInstanceInfo() {
    return {
      apiVersion: "v3",
      identifierLabel: import_dm_texts.DM_TEXTS.host,
      actions: [
        {
          id: "add",
          icon: "add",
          title: import_dm_texts.DM_TEXTS.addDevice,
          handler: (context) => this.addDevice(context)
        },
        {
          id: "discover",
          icon: "search",
          title: import_dm_texts.DM_TEXTS.discover,
          handler: (context) => this.discoverDevices(context)
        }
      ]
    };
  }
  async loadDevices(context) {
    await this.bridge.ready;
    const entries = this.bridge.devices();
    context.setTotalDevices(entries.length);
    for (const entry of entries) {
      context.addDevice(this.deviceInfo(entry));
    }
  }
  async getDeviceDetails(id) {
    var _a;
    const entry = this.find(id);
    if (!entry) {
      return { error: `unknown device ${id}` };
    }
    const status = this.bridge.statusText(id);
    const value = async (rel) => {
      const state = await this.adapter.getStateAsync(`${id}.${rel}`);
      return (state == null ? void 0 : state.val) !== null && (state == null ? void 0 : state.val) !== void 0 && state.val !== "" ? String(state.val) : "\u2013";
    };
    const schema = {
      type: "panel",
      items: {
        status: { type: "staticInfo", label: import_dm_texts.DM_TEXTS.status, data: status != null ? status : import_dm_texts.DM_TEXTS.notRunning, sm: 12 },
        host: { type: "staticInfo", label: import_dm_texts.DM_TEXTS.host, data: entry.config.host, sm: 12 },
        type: { type: "staticInfo", label: import_dm_texts.DM_TEXTS.deviceType, data: import_dm_texts.DM_TEXTS[connectionKey(entry.mode)], sm: 12 },
        mac: { type: "staticInfo", label: import_dm_texts.DM_TEXTS.mac, data: ((_a = entry.config.wolMac) == null ? void 0 : _a.trim()) || "\u2013", sm: 12 },
        app: { type: "staticInfo", label: import_dm_texts.DM_TEXTS.currentApp, data: await value("currentAppName"), sm: 12 },
        ...entry.mode !== "remote" ? { title: { type: "staticInfo", label: import_dm_texts.DM_TEXTS.title, data: await value("media.title"), sm: 12 } } : {}
      }
    };
    return { id, schema };
  }
  // --------------------------------------------------------------------------------------------------------
  // Card
  // --------------------------------------------------------------------------------------------------------
  deviceInfo(entry) {
    const base = `${this.adapter.namespace}.${entry.id}`;
    const enabled = entry.config.enabled !== false;
    const notRunningStatus = enabled ? "disconnected" : void 0;
    return {
      id: entry.id,
      identifier: entry.config.host,
      name: entry.config.name || entry.config.host,
      manufacturer: { stateId: `${base}.info.manufacturer` },
      model: { stateId: `${base}.info.model` },
      connectionType: "lan",
      enabled,
      status: entry.running ? {
        connection: {
          stateId: `${base}.info.connected`,
          mapping: { true: "connected", false: "disconnected" }
        },
        ...entry.mode !== "adb" ? {
          warning: {
            stateId: `${base}.info.pairingRequired`,
            mapping: { true: import_dm_texts.DM_TEXTS.pairingRequired, false: false }
          }
        } : {}
      } : notRunningStatus,
      actions: this.deviceActions(entry, enabled),
      controls: entry.running ? this.deviceControls(entry, base) : void 0,
      customInfo: entry.running ? this.cardInfo(entry, base) : void 0,
      hasDetails: true
    };
  }
  /**
   * Live value shown directly on the card: what is running (readable app name).
   *
   * @param entry - Device
   * @param base - Full object id of the device
   */
  cardInfo(entry, base) {
    const schema = {
      type: "panel",
      items: {
        app: {
          type: "state",
          oid: `${base}.currentAppName`,
          foreign: true,
          label: import_dm_texts.DM_TEXTS.currentApp,
          control: "text",
          sm: 12
        }
      }
    };
    return { id: entry.id, schema };
  }
  deviceActions(entry, enabled) {
    const actions = [
      {
        // reserved id: click on the status icon
        id: "status",
        description: import_dm_texts.DM_TEXTS.status,
        handler: async (id, context) => {
          var _a;
          await context.showMessage((_a = this.bridge.statusText(id)) != null ? _a : import_dm_texts.DM_TEXTS.notRunning);
          return { refresh: "none" };
        }
      },
      {
        // reserved id: switch "enabled" on the card (without this id the switch is read-only)
        id: "enable/disable",
        handler: (id) => this.changeDevice(id, (cfg) => ({ ...cfg, enabled: !enabled }))
      }
    ];
    if (entry.mode !== "adb") {
      actions.push({
        id: "pair",
        icon: "pairDevice",
        description: import_dm_texts.DM_TEXTS.pair,
        handler: (id, context) => this.pair(id, context)
      });
    }
    actions.push(
      {
        id: "reconnect",
        icon: "refresh",
        description: import_dm_texts.DM_TEXTS.reconnect,
        handler: async (id, context) => {
          if (!this.bridge.reconnect(id)) {
            await context.showMessage(import_dm_texts.DM_TEXTS.notRunning);
          }
          return { refresh: "none" };
        }
      },
      {
        id: "settings",
        icon: "settings",
        description: import_dm_texts.DM_TEXTS.settings,
        handler: (id, context) => this.editDevice(id, context)
      },
      {
        id: "remove",
        icon: "delete",
        description: import_dm_texts.DM_TEXTS.remove,
        confirmation: import_dm_texts.DM_TEXTS.confirmRemove,
        handler: (id) => {
          const entryNow = this.find(id);
          if (entryNow) {
            const devices = this.bridge.rawDevices();
            devices.splice(entryNow.index, 1);
            this.bridge.saveDevices(devices);
          }
          return { delete: id };
        }
      }
    );
    return actions;
  }
  deviceControls(entry, base) {
    const write = async (deviceId, controlId, value) => {
      const rel = CONTROL_STATES[controlId];
      if (!rel) {
        throw new Error(`unknown control ${controlId}`);
      }
      await this.adapter.setStateAsync(`${deviceId}.${rel}`, value, false);
      const now = Date.now();
      return { val: value, ack: false, ts: now, lc: now, from: `system.adapter.${this.adapter.namespace}`, q: 0 };
    };
    const read = async (deviceId, controlId) => {
      const rel = CONTROL_STATES[controlId];
      const state = rel ? await this.adapter.getStateAsync(`${deviceId}.${rel}`) : null;
      const now = Date.now();
      return state != null ? state : {
        val: null,
        ack: true,
        ts: now,
        lc: now,
        from: `system.adapter.${this.adapter.namespace}`,
        q: 0
      };
    };
    const button = (id, label) => ({
      id,
      type: "button",
      label,
      handler: (deviceId, controlId) => write(deviceId, controlId, true)
    });
    const controls = [
      {
        id: "power",
        type: "switch",
        label: import_dm_texts.DM_TEXTS.power,
        stateId: `${base}.power`,
        handler: (deviceId, controlId, state) => write(deviceId, controlId, !!state),
        getStateHandler: read
      }
    ];
    if (entry.mode !== "adb") {
      controls.push({
        id: "muted",
        type: "switch",
        label: import_dm_texts.DM_TEXTS.mute,
        stateId: `${base}.muted`,
        handler: (deviceId, controlId, state) => write(deviceId, controlId, !!state),
        getStateHandler: read
      });
    }
    controls.push(
      button("volumeDown", import_dm_texts.DM_TEXTS.volumeDown),
      button("volumeUp", import_dm_texts.DM_TEXTS.volumeUp),
      button("playPause", import_dm_texts.DM_TEXTS.playPause),
      button("home", import_dm_texts.DM_TEXTS.home)
    );
    return controls;
  }
  // --------------------------------------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------------------------------------
  /**
   * Pairing dialog: start → TV shows code → enter code (up to 3 attempts on typos).
   *
   * @param id - Device id
   * @param context - Dialog helpers
   */
  async pair(id, context) {
    const entry = this.find(id);
    if (!(entry == null ? void 0 : entry.running)) {
      await context.showMessage(import_dm_texts.DM_TEXTS.notRunning);
      return { refresh: "none" };
    }
    const host = entry.config.host.trim();
    const progress = await context.openProgress(import_dm_texts.DM_TEXTS.pair, { indeterminate: true, label: import_dm_texts.DM_TEXTS.pairStarting });
    try {
      await this.bridge.startPairing(host);
    } catch (e) {
      await progress.close();
      await context.showMessage(this.bridge.errorText(e));
      return { refresh: "none" };
    }
    await progress.close();
    const schema = {
      type: "panel",
      items: { pin: { type: "text", label: import_dm_texts.DM_TEXTS.pinLabel, maxLength: 6, sm: 12 } }
    };
    for (let attempt = 1; attempt <= PAIRING_ATTEMPTS; attempt++) {
      const data = await context.showForm(schema, { title: import_dm_texts.DM_TEXTS.pair });
      if (!data) {
        this.bridge.cancelPairing(host);
        return { refresh: "none" };
      }
      try {
        const done = await this.bridge.finishPairing(host, typeof data.pin === "string" ? data.pin : "");
        await context.showMessage(done);
        return { refresh: "devices" };
      } catch (e) {
        await context.showMessage(this.bridge.errorText(e));
        if (!this.bridge.isRetryablePairingError(e)) {
          return { refresh: "none" };
        }
      }
    }
    this.bridge.cancelPairing(host);
    return { refresh: "none" };
  }
  async discoverDevices(context) {
    var _a;
    const progress = await context.openProgress(import_dm_texts.DM_TEXTS.discover, {
      indeterminate: true,
      label: import_dm_texts.DM_TEXTS.discovering
    });
    let found;
    try {
      found = await this.bridge.discover();
    } catch (error) {
      await progress.close();
      await context.showMessage(this.bridge.errorText(error));
      return { refresh: false };
    }
    await progress.close();
    const unique = (0, import_discovery.deduplicateAndroidTvs)(found);
    const configuredHosts = this.bridge.rawDevices().map((device) => typeof (device == null ? void 0 : device.host) === "string" ? device.host : "").filter(Boolean);
    const notConfigured = (0, import_discovery.excludeConfiguredAndroidTvs)(unique, configuredHosts);
    const candidates = notConfigured.map((device) => {
      const host = (0, import_discovery.getDiscoveredDeviceHost)(device);
      return host ? { device, host, name: discoveredDeviceName(device) } : void 0;
    }).filter((candidate2) => candidate2 !== void 0);
    if (!candidates.length) {
      await context.showMessage(
        !unique.length ? import_dm_texts.DM_TEXTS.noDevicesFound : !notConfigured.length ? import_dm_texts.DM_TEXTS.noNewDevices : import_dm_texts.DM_TEXTS.noUsableDevices
      );
      return { refresh: false };
    }
    const selection = await context.showForm(
      {
        type: "panel",
        items: {
          device: {
            type: "select",
            label: import_dm_texts.DM_TEXTS.foundDevices,
            options: candidates.map((candidate2, index2) => ({
              label: [
                `${candidate2.name} (${candidate2.host})`,
                safeDisplayText(candidate2.device.manufacturer),
                safeDisplayText(candidate2.device.model),
                candidate2.device.port ? `TCP ${candidate2.device.port}` : void 0
              ].filter(Boolean).join(" \xB7 "),
              value: String(index2)
            })),
            sm: 12
          }
        }
      },
      { title: import_dm_texts.DM_TEXTS.discover }
    );
    if (!selection || typeof selection.device !== "string" && typeof selection.device !== "number") {
      return { refresh: false };
    }
    const index = Number(selection.device);
    const candidate = Number.isInteger(index) && index >= 0 ? candidates[index] : void 0;
    if (!candidate) {
      return { refresh: false };
    }
    const data = await this.askSettings(context, import_dm_texts.DM_TEXTS.addDevice, {
      name: candidate.name,
      host: candidate.host,
      enabled: true,
      connection: "remote",
      enableIme: true,
      remotePort: (_a = candidate.device.port) != null ? _a : 6466,
      adbPort: 5555,
      wolMac: "",
      wolBroadcast: ""
    });
    if (data) {
      const devices = this.bridge.rawDevices();
      devices.push(data);
      await context.showMessage(import_dm_texts.DM_TEXTS.saved);
      this.bridge.saveDevices(devices);
    }
    return { refresh: false };
  }
  async addDevice(context) {
    const data = await this.askSettings(context, import_dm_texts.DM_TEXTS.addDevice, {
      name: "Android TV",
      host: "",
      enabled: true,
      connection: "remote",
      enableIme: true,
      remotePort: 6466,
      adbPort: 5555,
      wolMac: "",
      wolBroadcast: ""
    });
    if (data) {
      const devices = this.bridge.rawDevices();
      devices.push(data);
      await context.showMessage(import_dm_texts.DM_TEXTS.saved);
      this.bridge.saveDevices(devices);
    }
    return { refresh: false };
  }
  async editDevice(id, context) {
    const entry = this.find(id);
    if (!entry) {
      return { refresh: "devices" };
    }
    const data = await this.askSettings(context, import_dm_texts.DM_TEXTS.settings, { ...entry.config }, entry.index);
    if (data) {
      const devices = this.bridge.rawDevices();
      devices[entry.index] = { ...devices[entry.index], ...data };
      await context.showMessage(import_dm_texts.DM_TEXTS.saved);
      this.bridge.saveDevices(devices);
    }
    return { refresh: "none" };
  }
  /**
   * Applies a change to one configuration row and stores it.
   *
   * @param id - Device id
   * @param change - Returns the new row
   */
  changeDevice(id, change) {
    const entry = this.find(id);
    if (entry) {
      const devices = this.bridge.rawDevices();
      devices[entry.index] = change(devices[entry.index]);
      this.bridge.saveDevices(devices);
    }
    return { refresh: "none" };
  }
  /**
   * Settings form (same fields as the table in the instance settings), validated in code.
   *
   * @param context - Dialog helpers
   * @param title - Dialog title
   * @param initial - Start values
   * @param ownIndex - Row being edited (excluded from the duplicate check)
   * @returns the validated row or undefined on cancel
   */
  async askSettings(context, title, initial, ownIndex = -1) {
    var _a, _b;
    const schema = {
      type: "panel",
      items: {
        // @KI_HINWEIS: Validatoren direkt im Dialog (Idee aus PR #11, Voodoo2man); validate() prüft zusätzlich im Code.
        name: {
          type: "text",
          label: import_dm_texts.DM_TEXTS.name,
          validator: "data.name && data.name.trim().length > 0",
          validatorNoSaveOnError: true,
          sm: 12
        },
        host: {
          type: "text",
          label: import_dm_texts.DM_TEXTS.host,
          help: import_dm_texts.DM_TEXTS.hostHelp,
          validator: "data.host && data.host.trim().length > 0",
          validatorNoSaveOnError: true,
          sm: 12
        },
        connection: {
          type: "select",
          label: import_dm_texts.DM_TEXTS.deviceType,
          help: import_dm_texts.DM_TEXTS.connectionHelp,
          options: [
            { label: import_dm_texts.DM_TEXTS.connRemote, value: "remote" },
            { label: import_dm_texts.DM_TEXTS.connRemoteAdb, value: "remote_adb" },
            { label: import_dm_texts.DM_TEXTS.connAdb, value: "adb" }
          ],
          sm: 12
        },
        enabled: { type: "checkbox", label: import_dm_texts.DM_TEXTS.enabled, sm: 12 },
        wolMac: {
          type: "text",
          label: import_dm_texts.DM_TEXTS.mac,
          help: import_dm_texts.DM_TEXTS.macHelp,
          validator: "!data.wolMac || /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(data.wolMac.trim())",
          validatorNoSaveOnError: true,
          sm: 12
        },
        // @KI_HINWEIS: Broadcast nur zeigen, wenn eine MAC eingetragen ist – ohne MAC kein Wake-on-LAN.
        wolBroadcast: {
          type: "text",
          label: import_dm_texts.DM_TEXTS.broadcast,
          help: import_dm_texts.DM_TEXTS.broadcastHelp,
          hidden: "!data.wolMac",
          sm: 12
        },
        enableIme: { type: "checkbox", label: import_dm_texts.DM_TEXTS.ime, hidden: "data.connection === 'adb'", sm: 12 },
        remotePort: {
          type: "number",
          label: import_dm_texts.DM_TEXTS.remotePort,
          min: 1,
          max: 65535,
          hidden: "data.connection === 'adb'",
          sm: 12
        },
        adbPort: {
          type: "number",
          label: import_dm_texts.DM_TEXTS.adbPort,
          min: 1,
          max: 65535,
          hidden: "data.connection === 'remote'",
          sm: 12
        },
        // what to do on the device after saving (step texts from PR #11)
        stepPair: { type: "staticText", text: import_dm_texts.DM_TEXTS.stepPair, hidden: "data.connection === 'adb'", sm: 12 },
        stepAdbRemote: {
          type: "staticText",
          text: import_dm_texts.DM_TEXTS.stepAdbRemote,
          hidden: "data.connection !== 'remote_adb'",
          sm: 12
        },
        stepAdbFire: { type: "staticText", text: import_dm_texts.DM_TEXTS.stepAdbFire, hidden: "data.connection !== 'adb'", sm: 12 },
        adbSecurity: {
          type: "staticText",
          text: import_dm_texts.DM_TEXTS.adbSecurity,
          hidden: "data.connection === 'remote'",
          sm: 12
        }
      }
    };
    let data = {
      ...initial,
      connection: (_a = initial.connection) != null ? _a : "remote",
      remotePort: (_b = initial.remotePort) != null ? _b : 6466
    };
    for (; ; ) {
      const result = await context.showForm(schema, { data, title, ignoreApplyDisabled: true });
      if (!result) {
        return void 0;
      }
      data = result;
      const row = toDeviceConfig(result);
      const error = this.validate(row, ownIndex);
      if (!error) {
        return row;
      }
      await context.showMessage(error);
    }
  }
  validate(row, ownIndex) {
    if (!row.name || !row.host) {
      return import_dm_texts.DM_TEXTS.missingFields;
    }
    if (row.wolMac && !MAC_PATTERN.test(row.wolMac)) {
      return import_dm_texts.DM_TEXTS.macInvalid;
    }
    const host = row.host.toLowerCase();
    const duplicate = this.bridge.rawDevices().some((d, i) => i !== ownIndex && typeof (d == null ? void 0 : d.host) === "string" && d.host.trim().toLowerCase() === host);
    return duplicate ? import_dm_texts.DM_TEXTS.duplicateHost : void 0;
  }
  find(id) {
    return this.bridge.devices().find((e) => e.id === id);
  }
}
function connectionKey(mode) {
  return mode === "adb" ? "connAdb" : mode === "remote_adb" ? "connRemoteAdb" : "connRemote";
}
function safeDisplayText(value) {
  const safe = value == null ? void 0 : value.replace(new RegExp("\\p{Cc}", "gu"), "").trim().slice(0, 128);
  return safe || void 0;
}
function discoveredDeviceName(device) {
  var _a;
  const advertisedName = safeDisplayText(device.deviceName);
  if (advertisedName) {
    return advertisedName.slice(0, 64);
  }
  const serviceSuffix = import_discovery.ANDROID_TV_REMOTE_SERVICE;
  const instanceName = device.serviceName.toLowerCase().endsWith(serviceSuffix.toLowerCase()) ? device.serviceName.slice(0, -serviceSuffix.length) : device.serviceName;
  return ((_a = safeDisplayText(instanceName)) == null ? void 0 : _a.slice(0, 64)) || "Android TV";
}
function toDeviceConfig(data) {
  const str = (v) => typeof v === "string" ? v.trim() : "";
  const connection = data.connection === "adb" || data.connection === "remote_adb" ? data.connection : "remote";
  const port = Number(data.adbPort);
  const remotePort = Number(data.remotePort);
  return {
    name: str(data.name),
    host: str(data.host),
    enabled: data.enabled !== false,
    connection,
    enableIme: data.enableIme !== false,
    remotePort: Number.isInteger(remotePort) && remotePort >= 1 && remotePort <= 65535 ? remotePort : 6466,
    adbPort: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 5555,
    wolMac: str(data.wolMac),
    wolBroadcast: str(data.wolBroadcast)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AndroidTvDeviceManagement
});
//# sourceMappingURL=device-management.js.map
