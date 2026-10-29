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
var messages_exports = {};
__export(messages_exports, {
  Feature: () => Feature,
  KeyDirection: () => KeyDirection,
  PairingStatus: () => PairingStatus,
  decodePairingMessage: () => decodePairingMessage,
  decodeRemoteMessage: () => decodeRemoteMessage,
  encodeAppLink: () => encodeAppLink,
  encodeImeText: () => encodeImeText,
  encodeKeyInject: () => encodeKeyInject,
  encodePairingConfiguration: () => encodePairingConfiguration,
  encodePairingOptions: () => encodePairingOptions,
  encodePairingRequest: () => encodePairingRequest,
  encodePairingSecret: () => encodePairingSecret,
  encodePingResponse: () => encodePingResponse,
  encodeRemoteConfigure: () => encodeRemoteConfigure,
  encodeRemoteSetActive: () => encodeRemoteSetActive
});
module.exports = __toCommonJS(messages_exports);
var import_protobuf = require("./protobuf");
const PairingStatus = {
  OK: 200,
  ERROR: 400,
  BAD_CONFIGURATION: 401,
  BAD_SECRET: 402
};
const PROTOCOL_VERSION = 2;
const ROLE_TYPE_INPUT = 1;
const ENCODING_TYPE_HEXADECIMAL = 3;
const SYMBOL_LENGTH = 6;
const Outer = {
  protocolVersion: 1,
  status: 2,
  pairingRequest: 10,
  pairingRequestAck: 11,
  options: 20,
  configuration: 30,
  configurationAck: 31,
  secret: 40,
  secretAck: 41
};
function outer() {
  return new import_protobuf.MessageWriter().uint(Outer.protocolVersion, PROTOCOL_VERSION).uint(Outer.status, PairingStatus.OK);
}
function encoding() {
  return new import_protobuf.MessageWriter().uint(1, ENCODING_TYPE_HEXADECIMAL).uint(2, SYMBOL_LENGTH);
}
function encodePairingRequest(clientName) {
  return outer().message(Outer.pairingRequest, new import_protobuf.MessageWriter().string(1, "atvremote").string(2, clientName)).finish();
}
function encodePairingOptions() {
  return outer().message(Outer.options, new import_protobuf.MessageWriter().message(1, encoding()).uint(3, ROLE_TYPE_INPUT)).finish();
}
function encodePairingConfiguration() {
  return outer().message(Outer.configuration, new import_protobuf.MessageWriter().message(1, encoding()).uint(2, ROLE_TYPE_INPUT)).finish();
}
function encodePairingSecret(secret) {
  return outer().message(Outer.secret, new import_protobuf.MessageWriter().bytes(1, secret)).finish();
}
function decodePairingMessage(raw) {
  var _a;
  const msg = (0, import_protobuf.decodeMessage)(raw);
  const status = (_a = (0, import_protobuf.getNumber)(msg, Outer.status)) != null ? _a : 0;
  let kind = "unknown";
  if (msg.has(Outer.pairingRequestAck)) {
    kind = "pairingRequestAck";
  } else if (msg.has(Outer.options)) {
    kind = "options";
  } else if (msg.has(Outer.configurationAck)) {
    kind = "configurationAck";
  } else if (msg.has(Outer.secretAck)) {
    kind = "secretAck";
  }
  return { status, kind };
}
const Feature = {
  PING: 1 << 0,
  KEY: 1 << 1,
  IME: 1 << 2,
  VOICE: 1 << 3,
  POWER: 1 << 5,
  VOLUME: 1 << 6,
  APP_LINK: 1 << 9
};
const KeyDirection = {
  START_LONG: 1,
  END_LONG: 2,
  SHORT: 3
};
const Remote = {
  configure: 1,
  setActive: 2,
  error: 3,
  pingRequest: 8,
  pingResponse: 9,
  keyInject: 10,
  imeKeyInject: 20,
  imeBatchEdit: 21,
  start: 40,
  setVolumeLevel: 50,
  appLinkLaunchRequest: 90
};
function decodeRemoteMessage(raw) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const msg = (0, import_protobuf.decodeMessage)(raw);
  const configure = (0, import_protobuf.getMessage)(msg, Remote.configure);
  if (configure) {
    const info = (0, import_protobuf.getMessage)(configure, 2);
    return {
      type: "configure",
      features: (_a = (0, import_protobuf.getNumber)(configure, 1)) != null ? _a : 0,
      deviceInfo: info ? { model: (0, import_protobuf.getString)(info, 1), vendor: (0, import_protobuf.getString)(info, 2), appVersion: (0, import_protobuf.getString)(info, 6) } : {}
    };
  }
  if (msg.has(Remote.setActive)) {
    return { type: "setActive" };
  }
  const ping = (0, import_protobuf.getMessage)(msg, Remote.pingRequest);
  if (ping) {
    return { type: "pingRequest", val1: (_b = (0, import_protobuf.getNumber)(ping, 1)) != null ? _b : 0 };
  }
  const ime = (0, import_protobuf.getMessage)(msg, Remote.imeKeyInject);
  if (ime) {
    const appInfo = (0, import_protobuf.getMessage)(ime, 1);
    return { type: "imeKeyInject", appPackage: appInfo ? (0, import_protobuf.getString)(appInfo, 12) : void 0 };
  }
  const batch = (0, import_protobuf.getMessage)(msg, Remote.imeBatchEdit);
  if (batch) {
    return {
      type: "imeBatchEdit",
      imeCounter: (_c = (0, import_protobuf.getNumber)(batch, 1)) != null ? _c : 0,
      fieldCounter: (_d = (0, import_protobuf.getNumber)(batch, 2)) != null ? _d : 0
    };
  }
  const start = (0, import_protobuf.getMessage)(msg, Remote.start);
  if (start) {
    return { type: "start", started: ((_e = (0, import_protobuf.getNumber)(start, 1)) != null ? _e : 0) !== 0 };
  }
  const vol = (0, import_protobuf.getMessage)(msg, Remote.setVolumeLevel);
  if (vol) {
    return {
      type: "volume",
      volume: {
        max: (_f = (0, import_protobuf.getNumber)(vol, 6)) != null ? _f : 0,
        level: (_g = (0, import_protobuf.getNumber)(vol, 7)) != null ? _g : 0,
        muted: ((_h = (0, import_protobuf.getNumber)(vol, 8)) != null ? _h : 0) !== 0
      }
    };
  }
  if ((0, import_protobuf.getBytes)(msg, Remote.error)) {
    return { type: "error" };
  }
  return { type: "unknown", fields: [...msg.keys()] };
}
function encodeRemoteConfigure(features) {
  const deviceInfo = new import_protobuf.MessageWriter().uint(3, 1).string(4, "1").string(5, "atvremote").string(6, "1.0.0");
  return new import_protobuf.MessageWriter().message(Remote.configure, new import_protobuf.MessageWriter().uint(1, features).message(2, deviceInfo)).finish();
}
function encodeRemoteSetActive(features) {
  return new import_protobuf.MessageWriter().message(Remote.setActive, new import_protobuf.MessageWriter().uint(1, features)).finish();
}
function encodePingResponse(val1) {
  return new import_protobuf.MessageWriter().message(Remote.pingResponse, new import_protobuf.MessageWriter().uint(1, val1)).finish();
}
function encodeKeyInject(keyCode, direction = KeyDirection.SHORT) {
  return new import_protobuf.MessageWriter().message(Remote.keyInject, new import_protobuf.MessageWriter().uint(1, keyCode).uint(2, direction)).finish();
}
function encodeAppLink(appLink) {
  return new import_protobuf.MessageWriter().message(Remote.appLinkLaunchRequest, new import_protobuf.MessageWriter().string(1, appLink)).finish();
}
function encodeImeText(text, imeCounter, fieldCounter) {
  const pos = Math.max(0, text.length - 1);
  const imeObject = new import_protobuf.MessageWriter().uint(1, pos).uint(2, pos).string(3, text);
  const editInfo = new import_protobuf.MessageWriter().uint(1, 1).message(2, imeObject);
  return new import_protobuf.MessageWriter().message(
    Remote.imeBatchEdit,
    new import_protobuf.MessageWriter().uint(1, imeCounter).uint(2, fieldCounter).message(3, editInfo)
  ).finish();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Feature,
  KeyDirection,
  PairingStatus,
  decodePairingMessage,
  decodeRemoteMessage,
  encodeAppLink,
  encodeImeText,
  encodeKeyInject,
  encodePairingConfiguration,
  encodePairingOptions,
  encodePairingRequest,
  encodePairingSecret,
  encodePingResponse,
  encodeRemoteConfigure,
  encodeRemoteSetActive
});
//# sourceMappingURL=messages.js.map
