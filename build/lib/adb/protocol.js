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
var protocol_exports = {};
__export(protocol_exports, {
  ADB_HEADER_LENGTH: () => ADB_HEADER_LENGTH,
  ADB_MAX_PAYLOAD: () => ADB_MAX_PAYLOAD,
  ADB_VERSION: () => ADB_VERSION,
  AdbAuthType: () => AdbAuthType,
  AdbCommand: () => AdbCommand,
  AdbPacketDecoder: () => AdbPacketDecoder,
  commandName: () => commandName,
  encodeAdbPacket: () => encodeAdbPacket
});
module.exports = __toCommonJS(protocol_exports);
const AdbCommand = {
  SYNC: 1129208147,
  CNXN: 1314410051,
  AUTH: 1213486401,
  OPEN: 1313165391,
  OKAY: 1497451343,
  CLSE: 1163086915,
  WRTE: 1163154007
};
const AdbAuthType = {
  TOKEN: 1,
  SIGNATURE: 2,
  RSAPUBLICKEY: 3
};
const ADB_VERSION = 16777217;
const ADB_MAX_PAYLOAD = 256 * 1024;
const ADB_HEADER_LENGTH = 24;
function checksum(data) {
  let sum = 0;
  for (const byte of data) {
    sum = sum + byte >>> 0;
  }
  return sum;
}
function encodeAdbPacket(packet) {
  const header = Buffer.alloc(ADB_HEADER_LENGTH);
  header.writeUInt32LE(packet.command >>> 0, 0);
  header.writeUInt32LE(packet.arg0 >>> 0, 4);
  header.writeUInt32LE(packet.arg1 >>> 0, 8);
  header.writeUInt32LE(packet.payload.length, 12);
  header.writeUInt32LE(checksum(packet.payload), 16);
  header.writeUInt32LE((packet.command ^ 4294967295) >>> 0, 20);
  return Buffer.concat([header, packet.payload]);
}
class AdbPacketDecoder {
  buffer = Buffer.alloc(0);
  /**
   * Feeds received bytes and returns all complete packets.
   *
   * @param chunk - Received data
   */
  push(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    const packets = [];
    while (this.buffer.length >= ADB_HEADER_LENGTH) {
      const command = this.buffer.readUInt32LE(0);
      const magic = this.buffer.readUInt32LE(20);
      if ((command ^ 4294967295) >>> 0 !== magic) {
        this.buffer = Buffer.alloc(0);
        throw new Error("Invalid ADB packet header (magic mismatch)");
      }
      const length = this.buffer.readUInt32LE(12);
      if (length > ADB_MAX_PAYLOAD * 4) {
        this.buffer = Buffer.alloc(0);
        throw new Error(`ADB payload too large: ${length}`);
      }
      if (this.buffer.length < ADB_HEADER_LENGTH + length) {
        break;
      }
      packets.push({
        command,
        arg0: this.buffer.readUInt32LE(4),
        arg1: this.buffer.readUInt32LE(8),
        payload: Buffer.from(this.buffer.subarray(ADB_HEADER_LENGTH, ADB_HEADER_LENGTH + length))
      });
      this.buffer = this.buffer.subarray(ADB_HEADER_LENGTH + length);
    }
    return packets;
  }
  /** Clears buffered data. */
  reset() {
    this.buffer = Buffer.alloc(0);
  }
}
function commandName(command) {
  const entry = Object.entries(AdbCommand).find(([, v]) => v === command);
  return entry ? entry[0] : `0x${command.toString(16)}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADB_HEADER_LENGTH,
  ADB_MAX_PAYLOAD,
  ADB_VERSION,
  AdbAuthType,
  AdbCommand,
  AdbPacketDecoder,
  commandName,
  encodeAdbPacket
});
//# sourceMappingURL=protocol.js.map
