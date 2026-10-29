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
var wol_exports = {};
__export(wol_exports, {
  WOL_PORT: () => WOL_PORT,
  magicPacket: () => magicPacket,
  parseMac: () => parseMac,
  sendWakeOnLan: () => sendWakeOnLan,
  wolTargets: () => wolTargets
});
module.exports = __toCommonJS(wol_exports);
var import_node_dgram = require("node:dgram");
var import_node_net = require("node:net");
const WOL_PORT = 9;
function parseMac(mac) {
  const hex = (mac != null ? mac : "").trim().replace(/[:\-.\s]/g, "");
  if (!/^[0-9a-f]{12}$/i.test(hex) || /^0{12}$/.test(hex)) {
    return void 0;
  }
  return Buffer.from(hex, "hex");
}
function magicPacket(mac) {
  return Buffer.concat([Buffer.alloc(6, 255), ...Array.from({ length: 16 }, () => mac)]);
}
function wolTargets(host, broadcast) {
  const targets = /* @__PURE__ */ new Set();
  const configured = broadcast == null ? void 0 : broadcast.trim();
  if (configured && ((0, import_node_net.isIPv4)(configured) || (0, import_node_net.isIPv6)(configured))) {
    targets.add(configured);
  }
  if ((0, import_node_net.isIPv4)(host)) {
    targets.add("255.255.255.255");
    targets.add(host.replace(/\.\d+$/, ".255"));
    targets.add(host);
  } else if ((0, import_node_net.isIPv6)(host)) {
    targets.add(host);
  }
  return [...targets];
}
async function sendWakeOnLan(mac, targets, port = WOL_PORT) {
  const bytes = parseMac(mac);
  if (!bytes) {
    throw new Error(`Invalid MAC address "${mac}"`);
  }
  const packet = magicPacket(bytes);
  let sent = 0;
  for (const family of ["udp4", "udp6"]) {
    const list = targets.filter((t) => family === "udp4" ? (0, import_node_net.isIPv4)(t) : (0, import_node_net.isIPv6)(t));
    if (!list.length) {
      continue;
    }
    const socket = (0, import_node_dgram.createSocket)(family);
    try {
      await new Promise((resolve, reject) => {
        socket.once("error", reject);
        socket.bind(0, () => {
          socket.off("error", reject);
          resolve();
        });
      });
      if (family === "udp4") {
        socket.setBroadcast(true);
      }
      for (let round = 0; round < 3; round++) {
        for (const target of list) {
          try {
            await new Promise(
              (resolve, reject) => socket.send(packet, port, target, (err) => err ? reject(err) : resolve())
            );
            sent++;
          } catch {
          }
        }
      }
    } finally {
      socket.close();
    }
  }
  return sent;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  WOL_PORT,
  magicPacket,
  parseMac,
  sendWakeOnLan,
  wolTargets
});
//# sourceMappingURL=wol.js.map
