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
var discovery_exports = {};
__export(discovery_exports, {
  ANDROID_TV_REMOTE_SERVICE: () => ANDROID_TV_REMOTE_SERVICE,
  deduplicateAndroidTvs: () => deduplicateAndroidTvs,
  discoverAndroidTvs: () => discoverAndroidTvs,
  excludeConfiguredAndroidTvs: () => excludeConfiguredAndroidTvs,
  getDiscoveredDeviceHost: () => getDiscoveredDeviceHost,
  isUsableDiscoveredHost: () => isUsableDiscoveredHost
});
module.exports = __toCommonJS(discovery_exports);
var import_node_dgram = require("node:dgram");
var import_node_net = require("node:net");
const ANDROID_TV_REMOTE_SERVICE = "_androidtvremote2._tcp.local.";
const MDNS_PORT = 5353;
const MDNS_IPV4 = "224.0.0.251";
const MDNS_IPV6 = "ff02::fb";
const MAX_SERVICES = 128;
const MAX_HOSTS = 256;
const MAX_ADDRESSES_PER_HOST = 16;
const MAX_TXT_ENTRIES = 64;
const MAX_TXT_ENTRIES_PER_SERVICE = 64;
const MAX_TXT_BYTES_PER_SERVICE = 4096;
const MAX_DNS_LABELS = 127;
const PTR = 12;
const TXT = 16;
const SRV = 33;
const A = 1;
const AAAA = 28;
function normalizeHost(host) {
  let value = host.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) {
    value = value.slice(1, -1);
  }
  value = value.replace(/\.$/, "");
  if ((0, import_node_net.isIP)(value) === 6) {
    try {
      const canonical = new URL(`http://[${value}]/`).hostname;
      return canonical.slice(1, -1);
    } catch {
    }
  }
  return value;
}
function isLinkLocalIpv6(address) {
  const normalized = normalizeHost(address);
  if ((0, import_node_net.isIP)(normalized) !== 6) {
    return false;
  }
  const firstGroup = normalized.split(":", 1)[0];
  return !!firstGroup && (Number.parseInt(firstGroup, 16) & 65472) === 65152;
}
function isUsableDiscoveredHost(host) {
  const candidate = host.trim().replace(/\.$/, "");
  if ((0, import_node_net.isIP)(candidate)) {
    return !isLinkLocalIpv6(candidate);
  }
  if (candidate.length > 253 || !candidate.length) {
    return false;
  }
  return candidate.split(".").every((label) => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
}
function getDiscoveredDeviceHost(device) {
  var _a, _b;
  const addresses = [...new Set([device.address, ...device.addresses].filter((value) => !!value))];
  const ipv4 = addresses.find((address) => (0, import_node_net.isIP)(address) === 4);
  const ipv6 = addresses.find((address) => (0, import_node_net.isIP)(address) === 6 && isUsableDiscoveredHost(address));
  const hostname = [device.hostname, ...(_a = device.alternateHostnames) != null ? _a : []].find(
    (candidate) => Boolean(candidate && isUsableDiscoveredHost(candidate))
  );
  const host = (_b = ipv4 != null ? ipv4 : ipv6) != null ? _b : hostname;
  if (!host || !isUsableDiscoveredHost(host)) {
    return void 0;
  }
  return host.replace(/\.$/, "");
}
function hostAliases(device) {
  var _a;
  return [
    ...new Set(
      [device.hostname, ...(_a = device.alternateHostnames) != null ? _a : [], device.address, ...device.addresses].filter((host) => Boolean(host)).map(normalizeHost).filter(Boolean)
    )
  ];
}
function deduplicationAliases(device) {
  return [...hostAliases(device), `service:${normalizeHost(device.serviceName)}`];
}
function mergeDevices(target, source) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const addresses = [
    ...new Set(
      [target.address, ...target.addresses, source.address, ...source.addresses].filter((value) => Boolean(value)).map(normalizeHost)
    )
  ];
  const address = (_b = (_a = target.address) != null ? _a : source.address) != null ? _b : addresses[0];
  const hostname = (_c = target.hostname) != null ? _c : source.hostname;
  const primaryHostname = hostname ? normalizeHost(hostname) : void 0;
  const alternateHostnames = [
    ...new Set(
      [
        target.hostname,
        ...(_d = target.alternateHostnames) != null ? _d : [],
        source.hostname,
        ...(_e = source.alternateHostnames) != null ? _e : []
      ].filter((host) => Boolean(host)).map(normalizeHost)
    )
  ].filter((host) => host !== primaryHostname);
  const txtMetadata = { ...source.txtMetadata, ...target.txtMetadata };
  return {
    ...source,
    ...target,
    hostname,
    ...alternateHostnames.length ? { alternateHostnames } : {},
    address,
    addresses,
    port: (_f = target.port) != null ? _f : source.port,
    txtMetadata,
    deviceName: (_g = target.deviceName) != null ? _g : source.deviceName,
    model: (_h = target.model) != null ? _h : source.model,
    manufacturer: (_i = target.manufacturer) != null ? _i : source.manufacturer,
    macAddress: (_j = target.macAddress) != null ? _j : source.macAddress
  };
}
function deduplicateAndroidTvs(devices) {
  const unique = [];
  const aliasesByDevice = [];
  for (const device of devices) {
    const deviceAliases = new Set(deduplicationAliases(device));
    const matches = [];
    for (let index = 0; index < aliasesByDevice.length; index++) {
      if ([...deviceAliases].some((alias) => aliasesByDevice[index].has(alias))) {
        matches.push(index);
      }
    }
    if (!matches.length) {
      unique.push(device);
      aliasesByDevice.push(deviceAliases);
      continue;
    }
    const primary = matches[0];
    unique[primary] = mergeDevices(unique[primary], device);
    for (const alias of deviceAliases) {
      aliasesByDevice[primary].add(alias);
    }
    for (const index of matches.slice(1).reverse()) {
      unique[primary] = mergeDevices(unique[primary], unique[index]);
      for (const alias of aliasesByDevice[index]) {
        aliasesByDevice[primary].add(alias);
      }
      unique.splice(index, 1);
      aliasesByDevice.splice(index, 1);
    }
  }
  return unique;
}
function excludeConfiguredAndroidTvs(devices, configuredHosts) {
  const configured = new Set([...configuredHosts].map(normalizeHost).filter(Boolean));
  return devices.filter((device) => !hostAliases(device).some((alias) => configured.has(alias)));
}
function readName(packet, initialOffset) {
  const labels = [];
  const visited = /* @__PURE__ */ new Set();
  let offset = initialOffset;
  let nextOffset = -1;
  let wireLength = 0;
  let steps = 0;
  while (offset < packet.length && steps++ < MAX_DNS_LABELS * 2) {
    const length = packet[offset];
    if (length === void 0) {
      throw new Error("Truncated DNS name");
    }
    if ((length & 192) === 192) {
      if (offset + 1 >= packet.length) {
        throw new Error("Truncated DNS compression pointer");
      }
      const pointer = (length & 63) << 8 | packet[offset + 1];
      if (pointer >= packet.length || visited.has(pointer)) {
        throw new Error("Invalid or cyclic DNS compression pointer");
      }
      visited.add(offset);
      if (nextOffset < 0) {
        nextOffset = offset + 2;
      }
      offset = pointer;
      continue;
    }
    if ((length & 192) !== 0) {
      throw new Error("Invalid DNS label length");
    }
    offset++;
    if (length === 0) {
      return { name: `${labels.join(".")}.`, offset: nextOffset < 0 ? offset : nextOffset };
    }
    if (length > 63 || offset + length > packet.length) {
      throw new Error("Invalid DNS label");
    }
    wireLength += length + 1;
    if (wireLength > 255) {
      throw new Error("DNS name exceeds the protocol limit");
    }
    labels.push(packet.toString("utf8", offset, offset + length));
    offset += length;
  }
  throw new Error("Malformed or cyclic DNS name");
}
function parseRecords(packet) {
  if (packet.length < 12) {
    return [];
  }
  const questions = packet.readUInt16BE(4);
  const totalRecords = packet.readUInt16BE(6) + packet.readUInt16BE(8) + packet.readUInt16BE(10);
  let offset = 12;
  try {
    for (let index = 0; index < questions; index++) {
      offset = readName(packet, offset).offset + 4;
      if (offset > packet.length) {
        return [];
      }
    }
  } catch {
    return [];
  }
  const records = [];
  for (let index = 0; index < totalRecords && offset < packet.length; index++) {
    let parsedName;
    try {
      parsedName = readName(packet, offset);
    } catch {
      break;
    }
    offset = parsedName.offset;
    if (offset + 10 > packet.length) {
      break;
    }
    const type = packet.readUInt16BE(offset);
    const recordClass = packet.readUInt16BE(offset + 2) & 32767;
    const dataLength = packet.readUInt16BE(offset + 8);
    const dataOffset = offset + 10;
    const end = dataOffset + dataLength;
    if (end > packet.length) {
      break;
    }
    if (recordClass === 1) {
      records.push({
        name: parsedName.name.toLowerCase(),
        type,
        data: packet.subarray(dataOffset, end),
        dataOffset
      });
    }
    offset = end;
  }
  return records;
}
function parseTxt(data) {
  const result = {};
  let entries = 0;
  for (let offset = 0; offset < data.length && entries < MAX_TXT_ENTRIES; entries++) {
    const length = data[offset++];
    if (length === void 0 || offset + length > data.length) {
      break;
    }
    const entry = data.toString("utf8", offset, offset + length).replace(new RegExp("\\p{Cc}", "gu"), "").trim();
    offset += length;
    const separator = entry.indexOf("=");
    const key = (separator < 0 ? entry : entry.slice(0, separator)).trim();
    const value = separator < 0 ? "" : entry.slice(separator + 1).trim().slice(0, 255);
    if (key && key.length <= 64) {
      Object.defineProperty(result, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
  }
  return result;
}
function getTxtValue(metadata, ...keys) {
  var _a;
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  return (_a = Object.entries(metadata).find(([key, value]) => wanted.has(key.toLowerCase()) && value)) == null ? void 0 : _a[1];
}
function decodeAddress(record) {
  if (record.type === A && record.data.length === 4) {
    return [...record.data].join(".");
  }
  if (record.type !== AAAA || record.data.length !== 16) {
    return void 0;
  }
  const groups = [];
  for (let index = 0; index < 16; index += 2) {
    groups.push(record.data.readUInt16BE(index).toString(16));
  }
  try {
    return new URL(`http://[${groups.join(":")}]/`).hostname.slice(1, -1);
  } catch {
    return void 0;
  }
}
function parseSrv(packet, record) {
  if (record.data.length < 7) {
    return void 0;
  }
  try {
    const target = readName(packet, record.dataOffset + 6);
    if (target.offset > record.dataOffset + record.data.length) {
      return void 0;
    }
    const hostname = target.name === "." ? void 0 : target.name;
    const port = record.data.readUInt16BE(4);
    return { ...hostname ? { hostname } : {}, ...port > 0 ? { port } : {} };
  } catch {
    return void 0;
  }
}
function parsePtr(packet, record) {
  try {
    const target = readName(packet, record.dataOffset);
    if (target.offset > record.dataOffset + record.data.length || target.name === ".") {
      return void 0;
    }
    return target.name;
  } catch {
    return void 0;
  }
}
function addAddress(map, hostname, address) {
  var _a;
  const key = hostname.toLowerCase();
  if (!map.has(key) && map.size >= MAX_HOSTS) {
    return;
  }
  const found = (_a = map.get(key)) != null ? _a : /* @__PURE__ */ new Set();
  if (found.size < MAX_ADDRESSES_PER_HOST) {
    found.add(address);
  }
  map.set(key, found);
}
function mergeTxt(metadata, source) {
  for (const [key, value] of Object.entries(source)) {
    const hasPrevious = Object.prototype.hasOwnProperty.call(metadata.txtMetadata, key);
    const previous = hasPrevious ? metadata.txtMetadata[key] : "";
    const entryCount = metadata.txtEntryCount + (hasPrevious ? 0 : 1);
    const keyBytes = Buffer.byteLength(key, "utf8");
    const previousBytes = hasPrevious ? keyBytes + Buffer.byteLength(previous, "utf8") : 0;
    const bytes = metadata.txtByteCount - previousBytes + keyBytes + Buffer.byteLength(value, "utf8");
    if (entryCount > MAX_TXT_ENTRIES_PER_SERVICE || bytes > MAX_TXT_BYTES_PER_SERVICE) {
      continue;
    }
    Object.defineProperty(metadata.txtMetadata, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    metadata.txtEntryCount = entryCount;
    metadata.txtByteCount = bytes;
  }
}
function parseResponse(packet, services, serviceMetadata, addressRecords) {
  var _a, _b, _c;
  const records = parseRecords(packet);
  for (const record of records) {
    if (record.name === ANDROID_TV_REMOTE_SERVICE && record.type === PTR) {
      const serviceName = parsePtr(packet, record);
      if (!serviceName) {
        continue;
      }
      const key = serviceName.toLowerCase();
      if (!services.has(key) && services.size < MAX_SERVICES) {
        services.set(key, { serviceName });
      }
    } else if (record.type === A || record.type === AAAA) {
      const address = decodeAddress(record);
      if (address) {
        addAddress(addressRecords, record.name, address);
      }
    } else if (record.type === SRV || record.type === TXT) {
      if (!serviceMetadata.has(record.name) && serviceMetadata.size >= MAX_SERVICES * 2) {
        continue;
      }
      const metadata = (_a = serviceMetadata.get(record.name)) != null ? _a : { txtMetadata: {}, txtEntryCount: 0, txtByteCount: 0 };
      if (record.type === SRV) {
        const srv = parseSrv(packet, record);
        if (srv) {
          metadata.hostname = (_b = srv.hostname) != null ? _b : metadata.hostname;
          metadata.port = (_c = srv.port) != null ? _c : metadata.port;
        }
      } else {
        mergeTxt(metadata, parseTxt(record.data));
      }
      serviceMetadata.set(record.name, metadata);
    }
  }
}
function buildQuery() {
  const labels = ANDROID_TV_REMOTE_SERVICE.slice(0, -1).split(".");
  const name = Buffer.concat([
    ...labels.map((label) => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])),
    Buffer.from([0])
  ]);
  const header = Buffer.alloc(12);
  header.writeUInt16BE(1, 4);
  const question = Buffer.alloc(4);
  question.writeUInt16BE(PTR, 0);
  question.writeUInt16BE(1, 2);
  return Buffer.concat([header, name, question]);
}
function validMacAddress(value) {
  return value && /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$|^(?:[0-9a-f]{2}-){5}[0-9a-f]{2}$/i.test(value) ? value : void 0;
}
function safeError(options, family, error) {
  var _a;
  try {
    (_a = options.onError) == null ? void 0 : _a.call(options, family, error);
  } catch {
  }
}
function discoverAndroidTvs(options = {}) {
  var _a, _b, _c, _d;
  const timeoutMs = Math.max(0, Math.min((_a = options.timeoutMs) != null ? _a : 2e3, 1e4));
  const createSocket = (_b = options.createSocket) != null ? _b : ((family) => (0, import_node_dgram.createSocket)({ type: family, reuseAddr: true }));
  const schedule = (_c = options.setTimeout) != null ? _c : setTimeout;
  const cancel = (_d = options.clearTimeout) != null ? _d : ((timer2) => clearTimeout(timer2));
  const services = /* @__PURE__ */ new Map();
  const serviceMetadata = /* @__PURE__ */ new Map();
  const addressRecords = /* @__PURE__ */ new Map();
  const sockets = [];
  const listeners = [];
  let timer;
  let hasTimer = false;
  let finished = false;
  return new Promise((resolve) => {
    let abortListener;
    const close = () => {
      var _a2, _b2, _c2;
      if (finished) {
        return;
      }
      finished = true;
      if (hasTimer) {
        cancel(timer);
        hasTimer = false;
      }
      if (abortListener) {
        (_a2 = options.signal) == null ? void 0 : _a2.removeEventListener("abort", abortListener);
      }
      for (const { socket, message, error } of listeners) {
        try {
          socket.off("message", message);
          socket.off("error", error);
        } catch {
        }
      }
      for (const socket of sockets) {
        try {
          socket.close();
        } catch {
        }
      }
      const devices = [];
      for (const info of services.values()) {
        const metadata = serviceMetadata.get(info.serviceName.toLowerCase());
        const hostname = metadata == null ? void 0 : metadata.hostname;
        const addresses = hostname ? [...(_b2 = addressRecords.get(hostname.toLowerCase())) != null ? _b2 : []] : [];
        const txtMetadata = (_c2 = metadata == null ? void 0 : metadata.txtMetadata) != null ? _c2 : {};
        const deviceName = getTxtValue(txtMetadata, "fn");
        const model = getTxtValue(txtMetadata, "md", "model");
        const manufacturer = getTxtValue(txtMetadata, "mf", "manufacturer");
        const macAddress = validMacAddress(txtMetadata.bt);
        devices.push({
          serviceName: info.serviceName,
          ...hostname ? { hostname } : {},
          ...addresses[0] ? { address: addresses[0] } : {},
          addresses,
          ...(metadata == null ? void 0 : metadata.port) ? { port: metadata.port } : {},
          txtMetadata,
          ...deviceName ? { deviceName } : {},
          ...model ? { model } : {},
          ...manufacturer ? { manufacturer } : {},
          ...macAddress ? { macAddress } : {},
          connectionTypeSuggestion: "remote-v2"
        });
      }
      resolve(deduplicateAndroidTvs(devices));
    };
    if (options.signal) {
      abortListener = close;
      if (options.signal.aborted) {
        close();
        return;
      }
      options.signal.addEventListener("abort", abortListener, { once: true });
    }
    const query = buildQuery();
    for (const [family, multicastAddress] of [
      ["udp4", MDNS_IPV4],
      ["udp6", MDNS_IPV6]
    ]) {
      if (finished) {
        break;
      }
      try {
        const socket = createSocket(family);
        sockets.push(socket);
        const message = (packet) => {
          if (!finished) {
            parseResponse(packet, services, serviceMetadata, addressRecords);
          }
        };
        const error = (cause) => safeError(options, family, cause);
        listeners.push({ socket, message, error });
        socket.on("message", message);
        socket.on("error", error);
        socket.bind(MDNS_PORT, void 0, () => {
          if (finished) {
            return;
          }
          try {
            socket.addMembership(multicastAddress);
            socket.send(query, MDNS_PORT, multicastAddress, (cause) => {
              if (cause) {
                safeError(options, family, cause);
              }
            });
          } catch (cause) {
            safeError(options, family, cause instanceof Error ? cause : new Error(String(cause)));
          }
        });
      } catch (cause) {
        safeError(options, family, cause instanceof Error ? cause : new Error(String(cause)));
      }
    }
    if (!finished) {
      timer = schedule(close, timeoutMs);
      if (finished) {
        cancel(timer);
      } else {
        hasTimer = true;
      }
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ANDROID_TV_REMOTE_SERVICE,
  deduplicateAndroidTvs,
  discoverAndroidTvs,
  excludeConfiguredAndroidTvs,
  getDiscoveredDeviceHost,
  isUsableDiscoveredHost
});
//# sourceMappingURL=discovery.js.map
