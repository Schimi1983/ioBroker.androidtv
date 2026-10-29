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
var auth_exports = {};
__export(auth_exports, {
  adbPublicKeyPayload: () => adbPublicKeyPayload,
  generateAdbKey: () => generateAdbKey,
  signAdbToken: () => signAdbToken
});
module.exports = __toCommonJS(auth_exports);
var import_node_crypto = require("node:crypto");
const SHA1_DIGEST_INFO = Buffer.from("3021300906052b0e03021a05000414", "hex");
const MODULUS_WORDS = 64;
function generateAdbKey() {
  const { privateKey } = (0, import_node_crypto.generateKeyPairSync)("rsa", {
    modulusLength: 2048,
    publicExponent: 65537,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" }
  });
  return { privateKey };
}
function signAdbToken(key, token) {
  return (0, import_node_crypto.privateEncrypt)(
    { key: key.privateKey, padding: import_node_crypto.constants.RSA_PKCS1_PADDING },
    Buffer.concat([SHA1_DIGEST_INFO, token])
  );
}
function toBigInt(buf) {
  return BigInt(`0x${buf.toString("hex") || "0"}`);
}
function adbPublicKeyPayload(key, name) {
  const jwk = (0, import_node_crypto.createPublicKey)(key.privateKey).export({ format: "jwk" });
  if (!jwk.n || !jwk.e) {
    throw new Error("Not an RSA key");
  }
  const n = toBigInt(Buffer.from(jwk.n, "base64url"));
  const e = Number(toBigInt(Buffer.from(jwk.e, "base64url")));
  const word = 1n << 32n;
  const n0 = n % word;
  let inv = 1n;
  for (let i = 0; i < 6; i++) {
    const t = n0 * inv % word;
    inv = inv * ((2n + word - t) % word) % word;
  }
  const n0inv = (word - inv) % word;
  const rr = (1n << BigInt(2 * 32 * MODULUS_WORDS)) % n;
  const struct = Buffer.alloc(4 + 4 + MODULUS_WORDS * 4 * 2 + 4);
  let offset = 0;
  struct.writeUInt32LE(MODULUS_WORDS, offset);
  offset += 4;
  struct.writeUInt32LE(Number(n0inv), offset);
  offset += 4;
  for (const value of [n, rr]) {
    let v = value;
    for (let i = 0; i < MODULUS_WORDS; i++) {
      struct.writeUInt32LE(Number(v % word), offset);
      v /= word;
      offset += 4;
    }
  }
  struct.writeUInt32LE(e, offset);
  return Buffer.concat([Buffer.from(`${struct.toString("base64")} ${name}`, "utf8"), Buffer.from([0])]);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adbPublicKeyPayload,
  generateAdbKey,
  signAdbToken
});
//# sourceMappingURL=auth.js.map
