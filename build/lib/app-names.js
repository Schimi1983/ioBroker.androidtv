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
var app_names_exports = {};
__export(app_names_exports, {
  appDisplayName: () => appDisplayName
});
module.exports = __toCommonJS(app_names_exports);
const KNOWN_APPS = {
  "com.netflix.ninja": "Netflix",
  "com.netflix.mediaclient": "Netflix",
  "com.google.android.youtube.tv": "YouTube",
  "com.amazon.firetv.youtube": "YouTube",
  "com.google.android.youtube.tvmusic": "YouTube Music",
  "com.amazon.amazonvideo.livingroom": "Prime Video",
  "com.amazon.avod": "Prime Video",
  "com.amazon.firebat": "Prime Video",
  "com.amazon.bueller.music": "Amazon Music",
  "com.disney.disneyplus": "Disney+",
  "org.xbmc.kodi": "Kodi",
  "com.plexapp.android": "Plex",
  "org.jellyfin.androidtv": "Jellyfin",
  "com.spotify.tv.android": "Spotify",
  "com.dazn": "DAZN",
  "com.apple.atve.androidtv.appletv": "Apple TV",
  "com.apple.atve.amazon.appletv": "Apple TV"
};
const LAUNCHERS = /* @__PURE__ */ new Set([
  "com.google.android.tvlauncher",
  "com.google.android.apps.tv.launcherx",
  "com.google.android.leanbacklauncher",
  "com.amazon.tv.launcher"
]);
const TV_INPUTS = /* @__PURE__ */ new Set(["com.amazon.tv.inputpreference.service"]);
const SETTINGS = /* @__PURE__ */ new Set(["com.android.tv.settings", "com.amazon.tv.settings.v2"]);
const HOME_SCREEN = {
  en: "Home screen",
  de: "Startbildschirm",
  ru: "\u0413\u043B\u0430\u0432\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D",
  pt: "Ecr\xE3 inicial",
  nl: "Startscherm",
  fr: "\xC9cran d'accueil",
  it: "Schermata Home",
  es: "Pantalla de inicio",
  pl: "Ekran g\u0142\xF3wny",
  uk: "\u0413\u043E\u043B\u043E\u0432\u043D\u0438\u0439 \u0435\u043A\u0440\u0430\u043D",
  "zh-cn": "\u4E3B\u5C4F\u5E55"
};
const TV_INPUT_NAME = {
  en: "TV input (HDMI)",
  de: "TV-Eingang (HDMI)",
  ru: "\u0412\u0445\u043E\u0434 \u0422\u0412 (HDMI)",
  pt: "Entrada de TV (HDMI)",
  nl: "Tv-ingang (HDMI)",
  fr: "Entr\xE9e TV (HDMI)",
  it: "Ingresso TV (HDMI)",
  es: "Entrada de TV (HDMI)",
  pl: "Wej\u015Bcie TV (HDMI)",
  uk: "\u0412\u0445\u0456\u0434 \u0422\u0411 (HDMI)",
  "zh-cn": "\u7535\u89C6\u8F93\u5165\uFF08HDMI\uFF09"
};
const SETTINGS_NAME = {
  en: "Settings",
  de: "Einstellungen",
  ru: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",
  pt: "Defini\xE7\xF5es",
  nl: "Instellingen",
  fr: "Param\xE8tres",
  it: "Impostazioni",
  es: "Ajustes",
  pl: "Ustawienia",
  uk: "\u041D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F",
  "zh-cn": "\u8BBE\u7F6E"
};
function appDisplayName(appId, favorites, language) {
  var _a;
  for (const fav of favorites) {
    if (fav.link.trim() === appId) {
      return fav.name.trim();
    }
  }
  if (LAUNCHERS.has(appId)) {
    return HOME_SCREEN[language];
  }
  if (TV_INPUTS.has(appId)) {
    return TV_INPUT_NAME[language];
  }
  if (SETTINGS.has(appId)) {
    return SETTINGS_NAME[language];
  }
  return (_a = KNOWN_APPS[appId]) != null ? _a : appId;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  appDisplayName
});
//# sourceMappingURL=app-names.js.map
