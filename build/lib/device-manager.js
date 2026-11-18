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
var device_manager_exports = {};
__export(device_manager_exports, {
  AndroidTvDeviceManagement: () => AndroidTvDeviceManagement,
  DEVICE_FORM_SCHEMA: () => DEVICE_FORM_SCHEMA,
  deviceConfigToFormData: () => deviceConfigToFormData,
  parseDeviceFormData: () => parseDeviceFormData
});
module.exports = __toCommonJS(device_manager_exports);
var import_dm_utils = require("@iobroker/dm-utils");
var import_client = require("./adb/client");
var import_pairing = require("./pairing");
const CONNECTIONS = ["remote", "remote_adb", "adb"];
const MAC_PATTERN = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
const DEVICE_FORM_SCHEMA = {
  type: "panel",
  i18n: true,
  items: {
    name: {
      type: "text",
      label: "Name",
      default: "Android TV",
      validator: "data.name && data.name.trim().length > 0",
      validatorNoSaveOnError: true,
      sm: 6
    },
    host: {
      type: "text",
      label: "IP address",
      help: "ipHelp",
      validator: "data.host && data.host.trim().length > 0",
      validatorNoSaveOnError: true,
      sm: 6
    },
    enabled: {
      type: "checkbox",
      label: "Enabled",
      default: true,
      sm: 6
    },
    connection: {
      type: "select",
      label: "Device type",
      help: "connectionHelp",
      default: "remote",
      options: [
        { label: "connRemote", value: "remote" },
        { label: "connRemoteAdb", value: "remote_adb" },
        { label: "connAdb", value: "adb" }
      ],
      sm: 6
    },
    wolMac: {
      type: "text",
      label: "MAC address (Wake-on-LAN)",
      help: "wolMacHelp",
      validator: "!data.wolMac || /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(data.wolMac.trim())",
      validatorErrorText: "wolMacInvalid",
      validatorNoSaveOnError: true,
      sm: 6
    },
    enableIme: {
      type: "checkbox",
      label: "Current app & text input",
      tooltip: "enableImeTooltip",
      default: true,
      expertMode: true,
      hidden: "data.connection === 'adb'",
      sm: 6
    },
    adbPort: {
      type: "number",
      label: "ADB port",
      default: import_client.DEFAULT_ADB_PORT,
      min: 1,
      max: 65535,
      expertMode: true,
      hidden: "!(data.connection === 'adb' || data.connection === 'remote_adb')",
      sm: 6
    },
    wolBroadcast: {
      type: "text",
      label: "Wake-on-LAN broadcast address",
      help: "wolBroadcastHelp",
      default: "",
      expertMode: true,
      sm: 6
    },
    pairStep: {
      type: "staticText",
      text: "stepPair",
      hidden: "data.connection === 'adb'",
      sm: 12
    },
    adbRemoteStep: {
      type: "staticText",
      text: "stepAdbRemote",
      hidden: "data.connection !== 'remote_adb'",
      sm: 12
    },
    adbFireStep: {
      type: "staticText",
      text: "stepAdbFire",
      hidden: "data.connection !== 'adb'",
      sm: 12
    },
    adbSecurity: {
      type: "staticText",
      text: "adbSecurity",
      hidden: "!(data.connection === 'adb' || data.connection === 'remote_adb')",
      sm: 12
    }
  }
};
const PAIRING_FORM_SCHEMA = {
  type: "panel",
  i18n: true,
  items: {
    pin: {
      type: "text",
      label: "Code shown on the TV",
      maxLength: 6,
      validator: "/^[0-9a-fA-F]{6}$/.test(data.pin)",
      validatorErrorText: "invalidPin",
      validatorNoSaveOnError: true
    }
  }
};
function deviceConfigToFormData(config) {
  return {
    name: (config == null ? void 0 : config.name) || (config == null ? void 0 : config.host) || "Android TV",
    host: (config == null ? void 0 : config.host) || "",
    enabled: (config == null ? void 0 : config.enabled) !== false,
    connection: CONNECTIONS.includes(config == null ? void 0 : config.connection) ? config == null ? void 0 : config.connection : "remote",
    enableIme: (config == null ? void 0 : config.enableIme) !== false,
    adbPort: validAdbPort(config == null ? void 0 : config.adbPort) ? config == null ? void 0 : config.adbPort : import_client.DEFAULT_ADB_PORT,
    wolMac: (config == null ? void 0 : config.wolMac) || "",
    wolBroadcast: (config == null ? void 0 : config.wolBroadcast) || ""
  };
}
function parseDeviceFormData(data) {
  var _a;
  if (typeof data.name !== "string" || !data.name.trim()) {
    throw new Error("Device name is required");
  }
  if (typeof data.host !== "string" || !data.host.trim()) {
    throw new Error("IP address is required");
  }
  if (!CONNECTIONS.includes(data.connection)) {
    throw new Error("Invalid device type");
  }
  const adbPort = Number((_a = data.adbPort) != null ? _a : import_client.DEFAULT_ADB_PORT);
  if (!Number.isInteger(adbPort) || adbPort < 1 || adbPort > 65535) {
    throw new Error("ADB port must be between 1 and 65535");
  }
  if (data.wolMac !== void 0 && typeof data.wolMac !== "string") {
    throw new Error("MAC address must be text");
  }
  const wolMac = typeof data.wolMac === "string" ? data.wolMac : "";
  if (wolMac.trim() && !MAC_PATTERN.test(wolMac.trim())) {
    throw new Error("Invalid MAC address");
  }
  if (data.wolBroadcast !== void 0 && typeof data.wolBroadcast !== "string") {
    throw new Error("Wake-on-LAN broadcast address must be text");
  }
  return {
    name: data.name,
    host: data.host,
    enabled: data.enabled !== false,
    connection: data.connection,
    enableIme: data.enableIme !== false,
    adbPort,
    wolMac,
    wolBroadcast: typeof data.wolBroadcast === "string" ? data.wolBroadcast : ""
  };
}
function validAdbPort(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535;
}
class AndroidTvDeviceManagement extends import_dm_utils.DeviceManagement {
  getInstanceInfo() {
    return {
      apiVersion: "v3",
      actions: [
        {
          id: "addDevice",
          icon: "newDevice",
          title: "Add device",
          handler: async (context) => {
            const data = await context.showForm(DEVICE_FORM_SCHEMA, {
              title: "Add device",
              data: deviceConfigToFormData()
            });
            if (!data) {
              return { refresh: false };
            }
            await this.adapter.addDeviceConfiguration(parseDeviceFormData(data));
            return { refresh: true };
          }
        }
      ]
    };
  }
  loadDevices(context) {
    const devices = this.adapter.getDeviceManagerDevices();
    context.setTotalDevices(devices.length);
    for (const { id, config } of devices) {
      const mode = config.connection === "adb" || config.connection === "remote_adb" ? config.connection : "remote";
      const statePrefix = `${this.adapter.namespace}.${id}`;
      context.addDevice({
        id,
        name: config.name || config.host,
        identifier: config.host,
        enabled: config.enabled !== false,
        status: {
          connection: {
            stateId: `${statePrefix}.info.connected`,
            mapping: { true: "connected", false: "disconnected" }
          }
        },
        indicators: [
          {
            id: "androidtvStatus",
            value: { stateId: `${statePrefix}.info.status` },
            icon: "info",
            showValue: true,
            hideIfEmpty: false,
            tooltip: "Status"
          }
        ],
        hasDetails: true,
        actions: [
          {
            id: "editDevice",
            icon: "edit",
            title: "Edit device",
            handler: async (deviceId, actionContext) => this.editDevice(deviceId, actionContext)
          },
          {
            id: "removeDevice",
            icon: "delete",
            title: "Remove device",
            handler: async (deviceId, actionContext) => this.removeDevice(deviceId, actionContext)
          },
          ...mode === "adb" ? [] : [
            {
              id: "pairDevice",
              icon: "pairDevice",
              title: "Pair device",
              handler: async (deviceId, actionContext) => this.pairDevice(deviceId, actionContext)
            }
          ]
        ]
      });
    }
  }
  getDeviceDetails(id) {
    const device = this.adapter.getDeviceManagerDevices().find((item) => item.id === id);
    if (!device) {
      return null;
    }
    const items = {
      status: {
        type: "state",
        oid: `${id}.info.status`,
        control: "text",
        readOnly: true,
        label: "Status",
        sm: 12
      },
      connected: {
        type: "state",
        oid: `${id}.info.connected`,
        control: "text",
        readOnly: true,
        label: "Connected",
        sm: 6
      }
    };
    if (device.config.connection === "remote_adb" || device.config.connection === "adb") {
      Object.assign(items, {
        adbConnected: {
          type: "state",
          oid: `${id}.info.adbConnected`,
          control: "text",
          readOnly: true,
          label: "ADB connected",
          sm: 6
        },
        adbAuthorizationPending: {
          type: "state",
          oid: `${id}.info.adbAuthorizationPending`,
          control: "text",
          readOnly: true,
          label: "ADB authorization pending",
          sm: 6
        }
      });
    }
    return { id, schema: { type: "panel", i18n: true, items } };
  }
  /**
   * Shows the edit form and persists the changed device configuration.
   *
   * @param deviceId - Device object ID
   * @param context - Device Manager action context
   */
  async editDevice(deviceId, context) {
    const current = this.adapter.getDeviceManagerDevices().find((device) => device.id === deviceId);
    if (!current) {
      throw new Error("Device no longer exists");
    }
    const data = await context.showForm(DEVICE_FORM_SCHEMA, {
      title: "Edit device",
      data: deviceConfigToFormData(current.config)
    });
    if (!data) {
      return { refresh: "none" };
    }
    const config = { ...current.config, ...parseDeviceFormData(data) };
    await this.adapter.updateDeviceConfiguration(deviceId, config);
    return { refresh: "all" };
  }
  /**
   * Confirms removal and deletes the device configuration.
   *
   * @param deviceId - Device object ID
   * @param context - Device Manager action context
   */
  async removeDevice(deviceId, context) {
    const current = this.adapter.getDeviceManagerDevices().find((device) => device.id === deviceId);
    if (!current) {
      throw new Error("Device no longer exists");
    }
    if (!await context.showConfirmation("Remove this device?")) {
      return { refresh: "none" };
    }
    await this.adapter.removeDeviceConfiguration(deviceId);
    return { refresh: "all" };
  }
  /**
   * Starts pairing and retries the confirmation form after an invalid code.
   *
   * @param deviceId - Device object ID
   * @param context - Device Manager action context
   */
  async pairDevice(deviceId, context) {
    const current = this.adapter.getDeviceManagerDevices().find((device) => device.id === deviceId);
    if (!current) {
      throw new Error("Device no longer exists");
    }
    const host = current.config.host.trim();
    try {
      await this.adapter.startDevicePairing(host);
    } catch (error) {
      if (error instanceof import_pairing.PairingError) {
        await context.showMessage(this.adapter.getDeviceManagerPairingMessage(error.code));
        return { refresh: "none" };
      }
      throw error;
    }
    await context.showMessage(this.adapter.getDeviceManagerPairingMessage("pairingStarted"));
    while (true) {
      const data = await context.showForm(PAIRING_FORM_SCHEMA, { title: "Confirm code", data: { pin: "" } });
      if (!data) {
        return { refresh: "none" };
      }
      try {
        const configured = await this.adapter.finishDevicePairing(
          host,
          typeof data.pin === "string" ? data.pin : ""
        );
        await context.showMessage(
          this.adapter.getDeviceManagerPairingMessage(configured ? "pairingDone" : "pairingDoneSave")
        );
        return { refresh: "devices" };
      } catch (error) {
        if (!(error instanceof import_pairing.PairingError)) {
          throw error;
        }
        await context.showMessage(this.adapter.getDeviceManagerPairingMessage(error.code));
        if (error.code !== "invalidPin" && error.code !== "wrongPin") {
          return { refresh: "none" };
        }
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AndroidTvDeviceManagement,
  DEVICE_FORM_SCHEMA,
  deviceConfigToFormData,
  parseDeviceFormData
});
//# sourceMappingURL=device-manager.js.map
