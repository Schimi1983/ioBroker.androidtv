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
var protobuf_exports = {};
__export(protobuf_exports, {
  FrameDecoder: () => FrameDecoder,
  MessageWriter: () => MessageWriter,
  WireType: () => WireType,
  decodeMessage: () => decodeMessage,
  decodeVarint: () => decodeVarint,
  encodeVarint: () => encodeVarint,
  frame: () => frame,
  getBytes: () => getBytes,
  getMessage: () => getMessage,
  getNumber: () => getNumber,
  getString: () => getString
});
module.exports = __toCommonJS(protobuf_exports);
var WireType = /* @__PURE__ */ ((WireType2) => {
  WireType2[WireType2["Varint"] = 0] = "Varint";
  WireType2[WireType2["Fixed64"] = 1] = "Fixed64";
  WireType2[WireType2["LengthDelimited"] = 2] = "LengthDelimited";
  WireType2[WireType2["Fixed32"] = 5] = "Fixed32";
  return WireType2;
})(WireType || {});
function encodeVarint(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Varint must be a non-negative integer, got ${value}`);
  }
  const bytes = [];
  let v = value;
  while (v > 127) {
    bytes.push(v % 128 | 128);
    v = Math.floor(v / 128);
  }
  bytes.push(v);
  return Buffer.from(bytes);
}
function decodeVarint(buf, offset) {
  let result = 0;
  let multiplier = 1;
  let pos = offset;
  for (let i = 0; i < 10; i++) {
    if (pos >= buf.length) {
      return null;
    }
    const byte = buf[pos++];
    result += (byte & 127) * multiplier;
    if ((byte & 128) === 0) {
      return { value: result, next: pos };
    }
    multiplier *= 128;
  }
  throw new Error("Varint too long");
}
class MessageWriter {
  parts = [];
  tag(field, wireType) {
    this.parts.push(encodeVarint(field * 8 + wireType));
  }
  /**
   * Writes an unsigned varint field (uint32, int32 ≥ 0, enum).
   *
   * @param field - Field number
   * @param value - Value; undefined skips the field
   */
  uint(field, value) {
    if (value !== void 0) {
      this.tag(field, 0 /* Varint */);
      this.parts.push(encodeVarint(value));
    }
    return this;
  }
  /**
   * Writes a bool field.
   *
   * @param field - Field number
   * @param value - Value; undefined skips the field
   */
  bool(field, value) {
    return this.uint(field, value === void 0 ? void 0 : value ? 1 : 0);
  }
  /**
   * Writes a length-delimited bytes field.
   *
   * @param field - Field number
   * @param value - Value; undefined skips the field
   */
  bytes(field, value) {
    if (value !== void 0) {
      this.tag(field, 2 /* LengthDelimited */);
      this.parts.push(encodeVarint(value.length), value);
    }
    return this;
  }
  /**
   * Writes a UTF-8 string field.
   *
   * @param field - Field number
   * @param value - Value; undefined skips the field
   */
  string(field, value) {
    return this.bytes(field, value === void 0 ? void 0 : Buffer.from(value, "utf8"));
  }
  /**
   * Writes an embedded message field. An empty sub-message is still written (presence matters).
   *
   * @param field - Field number
   * @param value - Sub-message; undefined skips the field
   */
  message(field, value) {
    return this.bytes(field, value == null ? void 0 : value.finish());
  }
  /** Returns the serialized message. */
  finish() {
    return Buffer.concat(this.parts);
  }
}
function decodeMessage(buf) {
  const fields = /* @__PURE__ */ new Map();
  let pos = 0;
  while (pos < buf.length) {
    const tag = decodeVarint(buf, pos);
    if (!tag) {
      throw new Error("Truncated tag");
    }
    pos = tag.next;
    const field = Math.floor(tag.value / 8);
    const wireType = tag.value % 8;
    let value;
    switch (wireType) {
      case 0 /* Varint */: {
        const v = decodeVarint(buf, pos);
        if (!v) {
          throw new Error("Truncated varint");
        }
        value = v.value;
        pos = v.next;
        break;
      }
      case 2 /* LengthDelimited */: {
        const len = decodeVarint(buf, pos);
        if (!len || len.next + len.value > buf.length) {
          throw new Error("Truncated length-delimited field");
        }
        value = buf.subarray(len.next, len.next + len.value);
        pos = len.next + len.value;
        break;
      }
      case 5 /* Fixed32 */:
        if (pos + 4 > buf.length) {
          throw new Error("Truncated fixed32");
        }
        value = buf.readUInt32LE(pos);
        pos += 4;
        break;
      case 1 /* Fixed64 */:
        if (pos + 8 > buf.length) {
          throw new Error("Truncated fixed64");
        }
        value = Number(buf.readBigUInt64LE(pos));
        pos += 8;
        break;
      default:
        throw new Error(`Unsupported wire type ${wireType}`);
    }
    const list = fields.get(field);
    if (list) {
      list.push(value);
    } else {
      fields.set(field, [value]);
    }
  }
  return fields;
}
function getNumber(msg, field) {
  var _a;
  const v = (_a = msg.get(field)) == null ? void 0 : _a.at(-1);
  return typeof v === "number" ? v : void 0;
}
function getBytes(msg, field) {
  var _a;
  const v = (_a = msg.get(field)) == null ? void 0 : _a.at(-1);
  return Buffer.isBuffer(v) ? v : void 0;
}
function getString(msg, field) {
  var _a;
  return (_a = getBytes(msg, field)) == null ? void 0 : _a.toString("utf8");
}
function getMessage(msg, field) {
  const b = getBytes(msg, field);
  return b ? decodeMessage(b) : void 0;
}
class FrameDecoder {
  buffer = Buffer.alloc(0);
  /** Maximum accepted frame size; protects against garbage length prefixes. */
  static MAX_FRAME = 1024 * 1024;
  /**
   * Feeds data and returns all complete frames.
   *
   * @param chunk - Received bytes
   */
  push(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    const frames = [];
    while (this.buffer.length) {
      const len = decodeVarint(this.buffer, 0);
      if (!len) {
        break;
      }
      if (len.value > FrameDecoder.MAX_FRAME) {
        this.buffer = Buffer.alloc(0);
        throw new Error(`Frame too large: ${len.value} bytes`);
      }
      const end = len.next + len.value;
      if (this.buffer.length < end) {
        break;
      }
      frames.push(this.buffer.subarray(len.next, end));
      this.buffer = this.buffer.subarray(end);
    }
    return frames;
  }
  /** Clears buffered data, e.g. after reconnect. */
  reset() {
    this.buffer = Buffer.alloc(0);
  }
}
function frame(payload) {
  return Buffer.concat([encodeVarint(payload.length), payload]);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FrameDecoder,
  MessageWriter,
  WireType,
  decodeMessage,
  decodeVarint,
  encodeVarint,
  frame,
  getBytes,
  getMessage,
  getNumber,
  getString
});
//# sourceMappingURL=protobuf.js.map
