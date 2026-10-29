"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var certificate_exports = {};
__export(certificate_exports, {
  computePairingSecret: () => computePairingSecret,
  generateClientCertificate: () => generateClientCertificate,
  isUsableCertificate: () => isUsableCertificate,
  parseTvIdentity: () => parseTvIdentity,
  rsaPartsFromDer: () => rsaPartsFromDer,
  rsaPartsFromPem: () => rsaPartsFromPem
});
module.exports = __toCommonJS(certificate_exports);
var import_node_crypto = require("node:crypto");
var import_node_forge = __toESM(require("node-forge"));
function generateClientCertificate(commonName) {
  const { privateKey } = (0, import_node_crypto.generateKeyPairSync)("rsa", {
    modulusLength: 2048,
    publicExponent: 65537,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" }
  });
  const forgeKey = import_node_forge.default.pki.privateKeyFromPem(privateKey);
  const publicKey = import_node_forge.default.pki.setRsaPublicKey(forgeKey.n, forgeKey.e);
  const cert = import_node_forge.default.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = "01";
  const now = /* @__PURE__ */ new Date();
  cert.validity.notBefore = new Date(now.getTime() - 24 * 3600 * 1e3);
  cert.validity.notAfter = new Date(now.getTime() + 10 * 365 * 24 * 3600 * 1e3);
  const attrs = [{ name: "commonName", value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true, pathLenConstraint: 0 },
    { name: "subjectAltName", altNames: [{ type: 2, value: commonName }] }
  ]);
  cert.sign(forgeKey, import_node_forge.default.md.sha256.create());
  return { cert: import_node_forge.default.pki.certificateToPem(cert), key: privateKey };
}
function isUsableCertificate(client) {
  if (!(client == null ? void 0 : client.cert) || !client.key) {
    return false;
  }
  try {
    const x509 = new import_node_crypto.X509Certificate(client.cert);
    return new Date(x509.validTo).getTime() > Date.now() + 24 * 3600 * 1e3;
  } catch {
    return false;
  }
}
function normalizeHex(hex) {
  let h = hex.replace(/^0x/i, "").replace(/^0+/, "").toUpperCase();
  if (h.length % 2 === 1) {
    h = `0${h}`;
  }
  return h;
}
function rsaPartsFromPem(pem) {
  const jwk = new import_node_crypto.X509Certificate(pem).publicKey.export({ format: "jwk" });
  if (!jwk.n || !jwk.e) {
    throw new Error("Certificate does not contain an RSA public key");
  }
  return {
    modulus: normalizeHex(Buffer.from(jwk.n, "base64url").toString("hex")),
    exponent: normalizeHex(Buffer.from(jwk.e, "base64url").toString("hex"))
  };
}
function rsaPartsFromDer(der) {
  return rsaPartsFromPem(new import_node_crypto.X509Certificate(der).toString());
}
function computePairingSecret(client, server, pin) {
  const code = pin.trim().toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(code)) {
    throw new Error("PIN must consist of exactly 6 hexadecimal characters");
  }
  const hash = (0, import_node_crypto.createHash)("sha256").update(Buffer.from(client.modulus, "hex")).update(Buffer.from(client.exponent, "hex")).update(Buffer.from(server.modulus, "hex")).update(Buffer.from(server.exponent, "hex")).update(Buffer.from(code.slice(2), "hex")).digest();
  return hash[0] === parseInt(code.slice(0, 2), 16) ? hash : null;
}
function parseTvIdentity(der) {
  var _a, _b, _c, _d, _e, _f, _g;
  const subject = new import_node_crypto.X509Certificate(der).subject;
  const cn = (_b = (_a = /(?:^|\n)CN=([^\n]*)/.exec(subject)) == null ? void 0 : _a[1]) != null ? _b : "";
  const dnq = (_d = (_c = /(?:^|\n)dnQualifier=([^\n]*)/.exec(subject)) == null ? void 0 : _c[1]) != null ? _d : "";
  const cnParts = cn.split("/");
  const name = dnq ? (_e = dnq.split("/").at(-1)) != null ? _e : "" : cnParts.length > 1 ? (_f = cnParts.at(-2)) != null ? _f : "" : cn;
  const mac = (_g = cnParts.at(-1)) != null ? _g : "";
  return { name, mac: /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i.test(mac) ? mac.toUpperCase() : "" };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  computePairingSecret,
  generateClientCertificate,
  isUsableCertificate,
  parseTvIdentity,
  rsaPartsFromDer,
  rsaPartsFromPem
});
//# sourceMappingURL=certificate.js.map
