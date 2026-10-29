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
var states_exports = {};
__export(states_exports, {
  ADB_STATES: () => ADB_STATES,
  DEVICE_STATES: () => DEVICE_STATES,
  KEY_BUTTONS: () => KEY_BUTTONS
});
module.exports = __toCommonJS(states_exports);
const KEY_BUTTONS = [
  { id: "home", key: "HOME", role: "button", name: { en: "Home", de: "Home" } },
  { id: "back", key: "BACK", role: "button", name: { en: "Back", de: "Zur\xFCck" } },
  { id: "menu", key: "MENU", role: "button", name: { en: "Menu", de: "Men\xFC" } },
  { id: "settings", key: "SETTINGS", role: "button", name: { en: "Settings", de: "Einstellungen" } },
  { id: "up", key: "DPAD_UP", role: "button", name: { en: "Up", de: "Hoch" } },
  { id: "down", key: "DPAD_DOWN", role: "button", name: { en: "Down", de: "Runter" } },
  { id: "left", key: "DPAD_LEFT", role: "button", name: { en: "Left", de: "Links" } },
  { id: "right", key: "DPAD_RIGHT", role: "button", name: { en: "Right", de: "Rechts" } },
  { id: "ok", key: "DPAD_CENTER", role: "button", name: { en: "OK", de: "OK" } },
  { id: "playPause", key: "MEDIA_PLAY_PAUSE", role: "button", name: { en: "Play/Pause", de: "Play/Pause" } },
  { id: "play", key: "MEDIA_PLAY", role: "button.play", name: { en: "Play", de: "Wiedergabe" } },
  { id: "pause", key: "MEDIA_PAUSE", role: "button.pause", name: { en: "Pause", de: "Pause" } },
  { id: "stop", key: "MEDIA_STOP", role: "button.stop", name: { en: "Stop", de: "Stopp" } },
  { id: "next", key: "MEDIA_NEXT", role: "button.next", name: { en: "Next", de: "Weiter" } },
  { id: "previous", key: "MEDIA_PREVIOUS", role: "button.prev", name: { en: "Previous", de: "Zur\xFCck (Titel)" } },
  {
    id: "fastForward",
    key: "MEDIA_FAST_FORWARD",
    role: "button.forward",
    name: { en: "Fast forward", de: "Vorspulen" }
  },
  { id: "rewind", key: "MEDIA_REWIND", role: "button.reverse", name: { en: "Rewind", de: "Zur\xFCckspulen" } },
  { id: "volumeUp", key: "VOLUME_UP", role: "button.volume.up", name: { en: "Volume up", de: "Lauter" } },
  { id: "volumeDown", key: "VOLUME_DOWN", role: "button.volume.down", name: { en: "Volume down", de: "Leiser" } },
  { id: "channelUp", key: "CHANNEL_UP", role: "button", name: { en: "Channel up", de: "Kanal hoch" } },
  { id: "channelDown", key: "CHANNEL_DOWN", role: "button", name: { en: "Channel down", de: "Kanal runter" } },
  { id: "search", key: "SEARCH", role: "button", name: { en: "Search", de: "Suche" } },
  { id: "info", key: "INFO", role: "button", name: { en: "Info", de: "Info" } }
];
const DEVICE_STATES = [
  {
    id: "info.status",
    common: {
      name: { en: "Connection status (text)", de: "Verbindungsstatus (Text)" },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "info.connected",
    common: {
      name: { en: "Connected", de: "Verbunden" },
      type: "boolean",
      role: "indicator.connected",
      read: true,
      write: false,
      def: false
    }
  },
  {
    id: "info.pairingRequired",
    remoteOnly: true,
    common: {
      name: { en: "Pairing required", de: "Kopplung erforderlich" },
      type: "boolean",
      role: "indicator.maintenance",
      read: true,
      write: false,
      def: false
    }
  },
  {
    id: "info.model",
    common: { name: { en: "Model", de: "Modell" }, type: "string", role: "info.model", read: true, write: false }
  },
  {
    id: "info.manufacturer",
    common: {
      name: { en: "Manufacturer", de: "Hersteller" },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "info.remoteServiceVersion",
    remoteOnly: true,
    common: {
      name: { en: "Remote service version", de: "Version Remote-Dienst" },
      type: "string",
      role: "info.firmware",
      read: true,
      write: false
    }
  },
  {
    id: "info.mac",
    remoteOnly: true,
    common: {
      name: { en: "MAC address", de: "MAC-Adresse" },
      type: "string",
      role: "info.mac",
      read: true,
      write: false
    }
  },
  {
    id: "power",
    common: {
      name: { en: "Power (screen on)", de: "Eingeschaltet (Bildschirm an)" },
      type: "boolean",
      role: "switch.power",
      read: true,
      write: true
    }
  },
  {
    id: "currentApp",
    common: {
      name: { en: "Current app (package)", de: "Aktuelle App (Paket)" },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "volume",
    remoteOnly: true,
    common: {
      name: { en: "Volume", de: "Lautst\xE4rke" },
      type: "number",
      role: "value.volume",
      read: true,
      write: false,
      min: 0
    }
  },
  {
    id: "volumeMax",
    remoteOnly: true,
    common: {
      name: { en: "Maximum volume", de: "Maximale Lautst\xE4rke" },
      type: "number",
      role: "value",
      read: true,
      write: false
    }
  },
  {
    id: "muted",
    remoteOnly: true,
    common: { name: { en: "Muted", de: "Stumm" }, type: "boolean", role: "media.mute", read: true, write: true }
  },
  {
    id: "launchApp",
    common: {
      name: { en: "Launch app (deep link or package)", de: "App starten (Deep Link oder Paket)" },
      type: "string",
      role: "text",
      read: true,
      write: true,
      def: ""
    }
  },
  {
    id: "sendKey",
    common: {
      name: { en: "Send key (e.g. HOME, DPAD_UP or code)", de: "Taste senden (z. B. HOME, DPAD_UP oder Code)" },
      type: "string",
      role: "text",
      read: true,
      write: true,
      def: ""
    }
  },
  {
    id: "sendText",
    common: {
      name: { en: "Send text to input field", de: "Text in Eingabefeld senden" },
      type: "string",
      role: "text",
      read: true,
      write: true,
      def: ""
    }
  }
];
const ADB_STATES = [
  {
    id: "info.adbConnected",
    common: {
      name: { en: "ADB connected", de: "ADB verbunden" },
      type: "boolean",
      role: "indicator.connected",
      read: true,
      write: false,
      def: false
    }
  },
  {
    id: "info.adbAuthorizationPending",
    common: {
      name: {
        en: 'ADB: confirm "Allow debugging" on the TV',
        de: "ADB: \u201EDebugging zulassen\u201C am TV best\xE4tigen"
      },
      type: "boolean",
      role: "indicator.maintenance",
      read: true,
      write: false,
      def: false
    }
  },
  {
    id: "media.state",
    common: {
      name: { en: "Playback state", de: "Wiedergabestatus" },
      type: "string",
      role: "media.state",
      read: true,
      write: false,
      states: { play: "play", pause: "pause", stop: "stop", buffering: "buffering", idle: "idle" }
    }
  },
  {
    id: "media.title",
    common: { name: { en: "Title", de: "Titel" }, type: "string", role: "media.title", read: true, write: false }
  },
  {
    id: "media.subtitle",
    common: {
      name: { en: "Subtitle (artist, episode \u2026)", de: "Untertitel (Interpret, Folge \u2026)" },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "media.app",
    common: {
      name: { en: "App playing the media", de: "App der Wiedergabe" },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "media.position",
    common: {
      name: { en: "Position", de: "Position" },
      type: "number",
      role: "media.elapsed",
      unit: "s",
      read: true,
      write: false
    }
  }
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADB_STATES,
  DEVICE_STATES,
  KEY_BUTTONS
});
//# sourceMappingURL=states.js.map
