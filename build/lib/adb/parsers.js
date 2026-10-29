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
var parsers_exports = {};
__export(parsers_exports, {
  MAC_COMMAND: () => MAC_COMMAND,
  PACKAGE_PATTERN: () => PACKAGE_PATTERN,
  POLL_COMMAND: () => POLL_COMMAND,
  SECTION_SEPARATOR: () => SECTION_SEPARATOR,
  parseMacOutput: () => parseMacOutput,
  parseMediaSessions: () => parseMediaSessions,
  parsePollOutput: () => parsePollOutput,
  parseResumedActivity: () => parseResumedActivity,
  parseWakefulness: () => parseWakefulness,
  shellQuote: () => shellQuote
});
module.exports = __toCommonJS(parsers_exports);
const SECTION_SEPARATOR = "---IOBATV---";
const POLL_COMMAND = `w=$(dumpsys power | grep -m1 -E "mWakefulness="); echo "$w"; case "$w" in *Awake*|*Dreaming*) echo ${SECTION_SEPARATOR}; cat /proc/uptime; echo ${SECTION_SEPARATOR}; dumpsys activity activities | grep -E "ResumedActivity"; echo ${SECTION_SEPARATOR}; dumpsys media_session | grep -E "package=|active=|state=PlaybackState|description=" ;; esac`;
const PLAYBACK_STATES = {
  0: "idle",
  // STATE_NONE
  1: "stop",
  // STATE_STOPPED
  2: "pause",
  // STATE_PAUSED
  3: "play",
  // STATE_PLAYING
  4: "play",
  // STATE_FAST_FORWARDING
  5: "play",
  // STATE_REWINDING
  6: "buffering",
  // STATE_BUFFERING
  7: "stop",
  // STATE_ERROR
  8: "buffering",
  // STATE_CONNECTING
  9: "play",
  // STATE_SKIPPING_TO_PREVIOUS
  10: "play",
  // STATE_SKIPPING_TO_NEXT
  11: "play"
  // STATE_SKIPPING_TO_QUEUE_ITEM
};
function parseWakefulness(text) {
  const m = /mWakefulness=(\w+)/.exec(text);
  if (!m) {
    return void 0;
  }
  return m[1] === "Awake" || m[1] === "Dreaming";
}
function parseResumedActivity(text) {
  const m = /ResumedActivity[:=]\s*ActivityRecord\{\S+ u\d+ ([A-Za-z][\w.]*)\//.exec(text);
  return m == null ? void 0 : m[1];
}
function parseMediaSessions(text, nowMs) {
  var _a, _b, _c, _d;
  const sessions = [];
  let current;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const pkg = /^package=([A-Za-z][\w.]*)/.exec(line);
    if (pkg) {
      current = { app: pkg[1], active: false };
      sessions.push(current);
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("active=")) {
      current.active = line === "active=true";
    } else if (line.startsWith("state=PlaybackState")) {
      const st = /\bstate=(\d+)/.exec(line.slice("state=PlaybackState".length));
      const pos = /\bposition=(-?\d+)/.exec(line);
      const upd = /\bupdated=(\d+)/.exec(line);
      const spd = /\bspeed=(-?[\d.]+)/.exec(line);
      current.state = st ? Number(st[1]) : void 0;
      current.positionMs = pos && Number(pos[1]) >= 0 ? Number(pos[1]) : void 0;
      current.updatedMs = upd ? Number(upd[1]) : void 0;
      current.speed = spd ? Number(spd[1]) : void 0;
    } else if (line.includes("description=")) {
      current.description = line.slice(line.indexOf("description=") + "description=".length);
    }
  }
  const active = sessions.filter((s) => s.active && s.state !== void 0);
  const rank = (s) => {
    var _a2, _b2;
    const st = (_b2 = PLAYBACK_STATES[(_a2 = s.state) != null ? _a2 : 0]) != null ? _b2 : "idle";
    return st === "play" ? 0 : st === "pause" || st === "buffering" ? 1 : 2;
  };
  const best = active.sort((a, b) => rank(a) - rank(b))[0];
  if (!best) {
    return null;
  }
  const parts = ((_a = best.description) != null ? _a : "").split(", ").map((p) => p.trim());
  const clean = (v) => v && v !== "null" ? v : void 0;
  const title = parts.length >= 3 ? parts.slice(0, -2).join(", ") : parts[0];
  const subtitle = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  const state = (_c = PLAYBACK_STATES[(_b = best.state) != null ? _b : 0]) != null ? _c : "idle";
  let positionMs = best.positionMs;
  if (state === "play" && positionMs !== void 0 && nowMs !== void 0 && best.updatedMs !== void 0 && best.updatedMs > 0 && nowMs >= best.updatedMs) {
    positionMs += (nowMs - best.updatedMs) * ((_d = best.speed) != null ? _d : 1);
  }
  return {
    app: best.app,
    state,
    title: clean(title),
    subtitle: clean(subtitle),
    position: positionMs !== void 0 ? Math.max(0, Math.round(positionMs / 1e3)) : void 0
  };
}
function parsePollOutput(output) {
  const [power = "", uptime, activity, media] = output.split(SECTION_SEPARATOR);
  const awake = parseWakefulness(power);
  const result = { awake };
  if (awake && activity !== void 0) {
    const up = /^\s*([\d.]+)/.exec(uptime != null ? uptime : "");
    const nowMs = up ? Math.round(Number(up[1]) * 1e3) : void 0;
    result.currentApp = parseResumedActivity(activity);
    result.media = media !== void 0 ? parseMediaSessions(media, nowMs) : null;
  }
  return result;
}
function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
const PACKAGE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const MAC_COMMAND = `ip -o link show 2>/dev/null; echo ${SECTION_SEPARATOR}; ip -o -4 addr show 2>/dev/null`;
function parseMacOutput(output, host) {
  const [linkPart, addrPart = ""] = output.split(SECTION_SEPARATOR);
  const macs = /* @__PURE__ */ new Map();
  const up = [];
  for (const line of linkPart.split("\n")) {
    const m = /^\d+:\s+([^:@\s]+)[^:]*:.*link\/ether\s+([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i.exec(line);
    if (m && m[2] !== "00:00:00:00:00:00") {
      macs.set(m[1], m[2].toLowerCase());
      if (/[<,]UP[,>]/.test(line)) {
        up.push(m[1]);
      }
    }
  }
  if (host) {
    for (const line of addrPart.split("\n")) {
      const m = /^\d+:\s+(\S+)\s+inet\s+([\d.]+)\//.exec(line);
      if (m && m[2] === host && macs.has(m[1])) {
        return macs.get(m[1]);
      }
    }
  }
  return up.length === 1 ? macs.get(up[0]) : void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MAC_COMMAND,
  PACKAGE_PATTERN,
  POLL_COMMAND,
  SECTION_SEPARATOR,
  parseMacOutput,
  parseMediaSessions,
  parsePollOutput,
  parseResumedActivity,
  parseWakefulness,
  shellQuote
});
//# sourceMappingURL=parsers.js.map
