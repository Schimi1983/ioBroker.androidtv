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
var dm_texts_exports = {};
__export(dm_texts_exports, {
  DM_TEXTS: () => DM_TEXTS
});
module.exports = __toCommonJS(dm_texts_exports);
const DM_TEXTS = {
  name: {
    en: "Name",
    de: "Name",
    ru: "\u0418\u043C\u044F",
    pt: "Nome",
    nl: "Naam",
    fr: "Nom",
    it: "Nome",
    es: "Nombre",
    pl: "Nazwa",
    uk: "\u041D\u0430\u0437\u0432\u0430",
    "zh-cn": "\u540D\u79F0"
  },
  host: {
    en: "IP address",
    de: "IP-Adresse",
    ru: "IP-\u0430\u0434\u0440\u0435\u0441",
    pt: "Endere\xE7o IP",
    nl: "IP-adres",
    fr: "Adresse IP",
    it: "Indirizzo IP",
    es: "Direcci\xF3n IP",
    pl: "Adres IP",
    uk: "IP-\u0430\u0434\u0440\u0435\u0441\u0430",
    "zh-cn": "IP \u5730\u5740"
  },
  hostHelp: {
    en: "Shown in the device's network settings",
    de: "Steht in den Netzwerkeinstellungen des Ger\xE4ts",
    ru: "\u0423\u043A\u0430\u0437\u0430\u043D \u0432 \u0441\u0435\u0442\u0435\u0432\u044B\u0445 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",
    pt: "Indicado nas defini\xE7\xF5es de rede do dispositivo",
    nl: "Staat in de netwerkinstellingen van het apparaat",
    fr: "Indiqu\xE9e dans les param\xE8tres r\xE9seau de l'appareil",
    it: "Indicato nelle impostazioni di rete del dispositivo",
    es: "Aparece en los ajustes de red del dispositivo",
    pl: "Widoczny w ustawieniach sieci urz\u0105dzenia",
    uk: "\u0412\u043A\u0430\u0437\u0430\u043D\u0430 \u0432 \u043C\u0435\u0440\u0435\u0436\u0435\u0432\u0438\u0445 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F\u0445 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u044E",
    "zh-cn": "\u53EF\u5728\u8BBE\u5907\u7684\u7F51\u7EDC\u8BBE\u7F6E\u4E2D\u627E\u5230"
  },
  enabled: {
    en: "Enabled",
    de: "Aktiv",
    ru: "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
    pt: "Ativado",
    nl: "Ingeschakeld",
    fr: "Activ\xE9",
    it: "Attivo",
    es: "Activado",
    pl: "W\u0142\u0105czone",
    uk: "\u0423\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E",
    "zh-cn": "\u542F\u7528"
  },
  deviceType: {
    en: "Device type",
    de: "Ger\xE4tetyp",
    ru: "\u0422\u0438\u043F \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",
    pt: "Tipo de dispositivo",
    nl: "Apparaattype",
    fr: "Type d'appareil",
    it: "Tipo di dispositivo",
    es: "Tipo de dispositivo",
    pl: "Typ urz\u0105dzenia",
    uk: "\u0422\u0438\u043F \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u044E",
    "zh-cn": "\u8BBE\u5907\u7C7B\u578B"
  },
  connRemote: {
    en: "Android TV / Google TV (e.g. NVIDIA SHIELD)",
    de: "Android TV / Google TV (z. B. NVIDIA SHIELD)",
    ru: "Android TV / Google TV (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, NVIDIA SHIELD)",
    pt: "Android TV / Google TV (por ex. NVIDIA SHIELD)",
    nl: "Android TV / Google TV (bijv. NVIDIA SHIELD)",
    fr: "Android TV / Google TV (p. ex. NVIDIA SHIELD)",
    it: "Android TV / Google TV (ad es. NVIDIA SHIELD)",
    es: "Android TV / Google TV (p. ej. NVIDIA SHIELD)",
    pl: "Android TV / Google TV (np. NVIDIA SHIELD)",
    uk: "Android TV / Google TV (\u043D\u0430\u043F\u0440\u0438\u043A\u043B\u0430\u0434, NVIDIA SHIELD)",
    "zh-cn": "Android TV / Google TV\uFF08\u5982 NVIDIA SHIELD\uFF09"
  },
  connRemoteAdb: {
    en: "Android TV / Google TV + playback info (title, play/pause)",
    de: "Android TV / Google TV + Wiedergabe-Infos (Titel, Play/Pause)",
    ru: "Android TV / Google TV + \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u043E \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0438 (\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u043F\u0430\u0443\u0437\u0430)",
    pt: "Android TV / Google TV + info de reprodu\xE7\xE3o (t\xEDtulo, pausa)",
    nl: "Android TV / Google TV + afspeelinfo (titel, pauze)",
    fr: "Android TV / Google TV + infos de lecture (titre, pause)",
    it: "Android TV / Google TV + info di riproduzione (titolo, pausa)",
    es: "Android TV / Google TV + info de reproducci\xF3n (t\xEDtulo, pausa)",
    pl: "Android TV / Google TV + informacje o odtwarzaniu (tytu\u0142, pauza)",
    uk: "Android TV / Google TV + \u0456\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u044F \u043F\u0440\u043E \u0432\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F (\u043D\u0430\u0437\u0432\u0430, \u043F\u0430\u0443\u0437\u0430)",
    "zh-cn": "Android TV / Google TV + \u64AD\u653E\u4FE1\u606F\uFF08\u6807\u9898\u3001\u64AD\u653E/\u6682\u505C\uFF09"
  },
  connAdb: {
    en: "Amazon Fire TV (or other device without pairing)",
    de: "Amazon Fire TV (oder anderes Ger\xE4t ohne Kopplung)",
    ru: "Amazon Fire TV (\u0438\u043B\u0438 \u0434\u0440\u0443\u0433\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0431\u0435\u0437 \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u044F)",
    pt: "Amazon Fire TV (ou outro dispositivo sem emparelhamento)",
    nl: "Amazon Fire TV (of ander apparaat zonder koppelen)",
    fr: "Amazon Fire TV (ou autre appareil sans association)",
    it: "Amazon Fire TV (o altro dispositivo senza associazione)",
    es: "Amazon Fire TV (u otro dispositivo sin vinculaci\xF3n)",
    pl: "Amazon Fire TV (lub inne urz\u0105dzenie bez parowania)",
    uk: "Amazon Fire TV (\u0430\u0431\u043E \u0456\u043D\u0448\u0438\u0439 \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u0431\u0435\u0437 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F)",
    "zh-cn": "Amazon Fire TV\uFF08\u6216\u5176\u4ED6\u65E0\u9700\u914D\u5BF9\u7684\u8BBE\u5907\uFF09"
  },
  ime: {
    en: "Current app & text input",
    de: "Aktuelle App & Texteingabe",
    ru: "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0438 \u0432\u0432\u043E\u0434 \u0442\u0435\u043A\u0441\u0442\u0430",
    pt: "App atual e entrada de texto",
    nl: "Huidige app & tekstinvoer",
    fr: "Application actuelle et saisie de texte",
    it: "App attuale e inserimento testo",
    es: "App actual y entrada de texto",
    pl: "Bie\u017C\u0105ca aplikacja i wpisywanie tekstu",
    uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A \u0456 \u0432\u0432\u0435\u0434\u0435\u043D\u043D\u044F \u0442\u0435\u043A\u0441\u0442\u0443",
    "zh-cn": "\u5F53\u524D\u5E94\u7528\u548C\u6587\u672C\u8F93\u5165"
  },
  adbPort: {
    en: "ADB port",
    de: "ADB-Port",
    ru: "\u041F\u043E\u0440\u0442 ADB",
    pt: "Porta ADB",
    nl: "ADB-poort",
    fr: "Port ADB",
    it: "Porta ADB",
    es: "Puerto ADB",
    pl: "Port ADB",
    uk: "\u041F\u043E\u0440\u0442 ADB",
    "zh-cn": "ADB \u7AEF\u53E3"
  },
  mac: {
    en: "MAC address (Wake-on-LAN)",
    de: "MAC-Adresse (Wake-on-LAN)",
    ru: "MAC-\u0430\u0434\u0440\u0435\u0441 (Wake-on-LAN)",
    pt: "Endere\xE7o MAC (Wake-on-LAN)",
    nl: "MAC-adres (Wake-on-LAN)",
    fr: "Adresse MAC (Wake-on-LAN)",
    it: "Indirizzo MAC (Wake-on-LAN)",
    es: "Direcci\xF3n MAC (Wake-on-LAN)",
    pl: "Adres MAC (Wake-on-LAN)",
    uk: "MAC-\u0430\u0434\u0440\u0435\u0441\u0430 (Wake-on-LAN)",
    "zh-cn": "MAC \u5730\u5740\uFF08\u7F51\u7EDC\u5524\u9192\uFF09"
  },
  macHelp: {
    en: "Optional, only needed to switch the device on from deep standby. Shown in the network settings of the device or in your router (with a cable: the MAC of the LAN port)",
    de: "Optional, nur n\xF6tig zum Einschalten aus dem tiefen Standby. Steht in den Netzwerkeinstellungen des Ger\xE4ts oder im Router (bei Kabel: die MAC der LAN-Schnittstelle)",
    ru: "\u041D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E, \u043D\u0443\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F \u0438\u0437 \u0433\u043B\u0443\u0431\u043E\u043A\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430 \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u044F. \u0423\u043A\u0430\u0437\u0430\u043D \u0432 \u0441\u0435\u0442\u0435\u0432\u044B\u0445 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0438\u043B\u0438 \u0432 \u0440\u043E\u0443\u0442\u0435\u0440\u0435 (\u043F\u0440\u0438 \u043A\u0430\u0431\u0435\u043B\u0435: MAC \u043F\u043E\u0440\u0442\u0430 LAN)",
    pt: "Opcional, s\xF3 necess\xE1rio para ligar o dispositivo a partir do modo de espera profundo. Indicado nas defini\xE7\xF5es de rede do dispositivo ou no router (com cabo: o MAC da porta LAN)",
    nl: "Optioneel, alleen nodig om het apparaat uit diepe stand-by in te schakelen. Staat in de netwerkinstellingen van het apparaat of in de router (met kabel: het MAC van de LAN-poort)",
    fr: "Facultatif, n\xE9cessaire uniquement pour allumer l'appareil depuis la veille profonde. Indiqu\xE9e dans les param\xE8tres r\xE9seau de l'appareil ou dans le routeur (avec c\xE2ble : la MAC du port LAN)",
    it: "Facoltativo, serve solo per accendere il dispositivo dallo standby profondo. Indicato nelle impostazioni di rete del dispositivo o nel router (con cavo: il MAC della porta LAN)",
    es: "Opcional, solo necesario para encender el dispositivo desde el modo de espera profundo. Aparece en los ajustes de red del dispositivo o en el router (con cable: la MAC del puerto LAN)",
    pl: "Opcjonalnie, potrzebny tylko do w\u0142\u0105czenia urz\u0105dzenia z g\u0142\u0119bokiego czuwania. Podany w ustawieniach sieci urz\u0105dzenia lub w routerze (przy kablu: MAC portu LAN)",
    uk: "\u041D\u0435\u043E\u0431\u043E\u0432'\u044F\u0437\u043A\u043E\u0432\u043E, \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u043E \u043B\u0438\u0448\u0435 \u0434\u043B\u044F \u0432\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043D\u044F \u0437 \u0433\u043B\u0438\u0431\u043E\u043A\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0443 \u043E\u0447\u0456\u043A\u0443\u0432\u0430\u043D\u043D\u044F. \u0412\u043A\u0430\u0437\u0430\u043D\u043E \u0432 \u043C\u0435\u0440\u0435\u0436\u0435\u0432\u0438\u0445 \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F\u0445 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u044E \u0430\u0431\u043E \u0432 \u0440\u043E\u0443\u0442\u0435\u0440\u0456 (\u0437 \u043A\u0430\u0431\u0435\u043B\u0435\u043C: MAC \u043F\u043E\u0440\u0442\u0443 LAN)",
    "zh-cn": "\u53EF\u9009\uFF0C\u4EC5\u5728\u9700\u8981\u4ECE\u6DF1\u5EA6\u5F85\u673A\u5524\u9192\u8BBE\u5907\u65F6\u4F7F\u7528\u3002\u53EF\u5728\u8BBE\u5907\u7684\u7F51\u7EDC\u8BBE\u7F6E\u6216\u8DEF\u7531\u5668\u4E2D\u627E\u5230\uFF08\u6709\u7EBF\u8FDE\u63A5\u65F6\u4E3A LAN \u63A5\u53E3\u7684 MAC\uFF09"
  },
  macInvalid: {
    en: "Invalid MAC address. Format: aa:bb:cc:dd:ee:ff",
    de: "Ung\xFCltige MAC-Adresse. Format: aa:bb:cc:dd:ee:ff",
    ru: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 MAC-\u0430\u0434\u0440\u0435\u0441. \u0424\u043E\u0440\u043C\u0430\u0442: aa:bb:cc:dd:ee:ff",
    pt: "Endere\xE7o MAC inv\xE1lido. Formato: aa:bb:cc:dd:ee:ff",
    nl: "Ongeldig MAC-adres. Formaat: aa:bb:cc:dd:ee:ff",
    fr: "Adresse MAC invalide. Format : aa:bb:cc:dd:ee:ff",
    it: "Indirizzo MAC non valido. Formato: aa:bb:cc:dd:ee:ff",
    es: "Direcci\xF3n MAC no v\xE1lida. Formato: aa:bb:cc:dd:ee:ff",
    pl: "Nieprawid\u0142owy adres MAC. Format: aa:bb:cc:dd:ee:ff",
    uk: "\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0430 MAC-\u0430\u0434\u0440\u0435\u0441\u0430. \u0424\u043E\u0440\u043C\u0430\u0442: aa:bb:cc:dd:ee:ff",
    "zh-cn": "MAC \u5730\u5740\u65E0\u6548\u3002\u683C\u5F0F\uFF1Aaa:bb:cc:dd:ee:ff"
  },
  broadcast: {
    en: "Wake-on-LAN broadcast address",
    de: "Wake-on-LAN-Broadcast-Adresse",
    ru: "\u0428\u0438\u0440\u043E\u043A\u043E\u0432\u0435\u0449\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0430\u0434\u0440\u0435\u0441 Wake-on-LAN",
    pt: "Endere\xE7o de broadcast Wake-on-LAN",
    nl: "Wake-on-LAN-broadcastadres",
    fr: "Adresse de diffusion Wake-on-LAN",
    it: "Indirizzo broadcast Wake-on-LAN",
    es: "Direcci\xF3n de difusi\xF3n Wake-on-LAN",
    pl: "Adres rozg\u0142oszeniowy Wake-on-LAN",
    uk: "\u0428\u0438\u0440\u043E\u043A\u043E\u043C\u043E\u0432\u043D\u0430 \u0430\u0434\u0440\u0435\u0441\u0430 Wake-on-LAN",
    "zh-cn": "\u7F51\u7EDC\u5524\u9192\u5E7F\u64AD\u5730\u5740"
  },
  pinLabel: {
    en: "Code shown on the TV",
    de: "Code vom Fernseher",
    ru: "\u041A\u043E\u0434 \u0441 \u044D\u043A\u0440\u0430\u043D\u0430 \u0422\u0412",
    pt: "C\xF3digo mostrado na TV",
    nl: "Code op de tv",
    fr: "Code affich\xE9 sur la TV",
    it: "Codice mostrato sulla TV",
    es: "C\xF3digo mostrado en la TV",
    pl: "Kod z telewizora",
    uk: "\u041A\u043E\u0434 \u0437 \u0435\u043A\u0440\u0430\u043D\u0430 \u0422\u0412",
    "zh-cn": "\u7535\u89C6\u4E0A\u663E\u793A\u7684\u4EE3\u7801"
  },
  status: {
    en: "Status",
    de: "Status",
    ru: "\u0421\u0442\u0430\u0442\u0443\u0441",
    pt: "Estado",
    nl: "Status",
    fr: "\xC9tat",
    it: "Stato",
    es: "Estado",
    pl: "Status",
    uk: "\u0421\u0442\u0430\u0442\u0443\u0441",
    "zh-cn": "\u72B6\u6001"
  },
  addDevice: {
    en: "Add device",
    de: "Ger\xE4t hinzuf\xFCgen",
    ru: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E",
    pt: "Adicionar dispositivo",
    nl: "Apparaat toevoegen",
    fr: "Ajouter un appareil",
    it: "Aggiungi dispositivo",
    es: "A\xF1adir dispositivo",
    pl: "Dodaj urz\u0105dzenie",
    uk: "\u0414\u043E\u0434\u0430\u0442\u0438 \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439",
    "zh-cn": "\u6DFB\u52A0\u8BBE\u5907"
  },
  pair: {
    en: "Pair",
    de: "Koppeln",
    ru: "\u0421\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435",
    pt: "Emparelhar",
    nl: "Koppelen",
    fr: "Appairer",
    it: "Associa",
    es: "Emparejar",
    pl: "Sparuj",
    uk: "\u0421\u043F\u043E\u043B\u0443\u0447\u0438\u0442\u0438",
    "zh-cn": "\u914D\u5BF9"
  },
  reconnect: {
    en: "Reconnect",
    de: "Neu verbinden",
    ru: "\u041F\u0435\u0440\u0435\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C",
    pt: "Reconectar",
    nl: "Opnieuw verbinden",
    fr: "Reconnecter",
    it: "Riconnetti",
    es: "Reconectar",
    pl: "Po\u0142\u0105cz ponownie",
    uk: "\u041F\u0435\u0440\u0435\u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0438",
    "zh-cn": "\u91CD\u65B0\u8FDE\u63A5"
  },
  settings: {
    en: "Settings",
    de: "Einstellungen",
    ru: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",
    pt: "Configura\xE7\xF5es",
    nl: "Instellingen",
    fr: "Param\xE8tres",
    it: "Impostazioni",
    es: "Ajustes",
    pl: "Ustawienia",
    uk: "\u041D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F",
    "zh-cn": "\u8BBE\u7F6E"
  },
  remove: {
    en: "Remove device",
    de: "Ger\xE4t entfernen",
    ru: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E",
    pt: "Remover dispositivo",
    nl: "Apparaat verwijderen",
    fr: "Supprimer l'appareil",
    it: "Rimuovi dispositivo",
    es: "Eliminar dispositivo",
    pl: "Usu\u0144 urz\u0105dzenie",
    uk: "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439",
    "zh-cn": "\u79FB\u9664\u8BBE\u5907"
  },
  confirmRemove: {
    en: "Remove this device? Its objects are deleted and the instance restarts.",
    de: "Dieses Ger\xE4t entfernen? Seine Objekte werden gel\xF6scht und die Instanz startet neu.",
    ru: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u044D\u0442\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E? \u0415\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u044B \u0431\u0443\u0434\u0443\u0442 \u0443\u0434\u0430\u043B\u0435\u043D\u044B, \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0441\u044F.",
    pt: "Remover este dispositivo? Os seus objetos ser\xE3o eliminados e a inst\xE2ncia reinicia.",
    nl: "Dit apparaat verwijderen? De objecten worden verwijderd en de instantie start opnieuw.",
    fr: "Supprimer cet appareil ? Ses objets seront supprim\xE9s et l'instance red\xE9marrera.",
    it: "Rimuovere questo dispositivo? I suoi oggetti verranno eliminati e l'istanza si riavvier\xE0.",
    es: "\xBFEliminar este dispositivo? Sus objetos se borrar\xE1n y la instancia se reiniciar\xE1.",
    pl: "Usun\u0105\u0107 to urz\u0105dzenie? Jego obiekty zostan\u0105 usuni\u0119te, a instancja uruchomi si\u0119 ponownie.",
    uk: "\u0412\u0438\u0434\u0430\u043B\u0438\u0442\u0438 \u0446\u0435\u0439 \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439? \u0419\u043E\u0433\u043E \u043E\u0431'\u0454\u043A\u0442\u0438 \u0431\u0443\u0434\u0435 \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u043E, \u0435\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C\u0441\u044F.",
    "zh-cn": "\u5220\u9664\u6B64\u8BBE\u5907\uFF1F\u5176\u5BF9\u8C61\u5C06\u88AB\u5220\u9664\uFF0C\u5B9E\u4F8B\u5C06\u91CD\u65B0\u542F\u52A8\u3002"
  },
  saved: {
    en: "Saved. The instance restarts, the list updates in a few seconds.",
    de: "Gespeichert. Die Instanz startet neu, die Liste aktualisiert sich in wenigen Sekunden.",
    ru: "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E. \u042D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F, \u0441\u043F\u0438\u0441\u043E\u043A \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0435\u043A\u0443\u043D\u0434.",
    pt: "Guardado. A inst\xE2ncia reinicia, a lista atualiza-se em poucos segundos.",
    nl: "Opgeslagen. De instantie start opnieuw, de lijst wordt over enkele seconden bijgewerkt.",
    fr: "Enregistr\xE9. L'instance red\xE9marre, la liste se met \xE0 jour dans quelques secondes.",
    it: "Salvato. L'istanza si riavvia, l'elenco si aggiorna tra pochi secondi.",
    es: "Guardado. La instancia se reinicia, la lista se actualiza en unos segundos.",
    pl: "Zapisano. Instancja uruchamia si\u0119 ponownie, lista zaktualizuje si\u0119 za kilka sekund.",
    uk: "\u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E. \u0415\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440 \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0454\u0442\u044C\u0441\u044F, \u0441\u043F\u0438\u0441\u043E\u043A \u043E\u043D\u043E\u0432\u0438\u0442\u044C\u0441\u044F \u0437\u0430 \u043A\u0456\u043B\u044C\u043A\u0430 \u0441\u0435\u043A\u0443\u043D\u0434.",
    "zh-cn": "\u5DF2\u4FDD\u5B58\u3002\u5B9E\u4F8B\u6B63\u5728\u91CD\u542F\uFF0C\u5217\u8868\u5C06\u5728\u51E0\u79D2\u949F\u540E\u66F4\u65B0\u3002"
  },
  pairStarting: {
    en: "Starting pairing \u2013 the TV shows a code in a moment \u2026",
    de: "Kopplung wird gestartet \u2013 der Fernseher zeigt gleich einen Code \u2026",
    ru: "\u0417\u0430\u043F\u0443\u0441\u043A \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u044F \u2013 \u043D\u0430 \u0442\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440\u0435 \u0441\u0435\u0439\u0447\u0430\u0441 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u043A\u043E\u0434 \u2026",
    pt: "A iniciar o emparelhamento \u2013 a TV mostra um c\xF3digo dentro de momentos \u2026",
    nl: "Koppelen wordt gestart \u2013 de tv toont zo een code \u2026",
    fr: "D\xE9marrage de l'appairage \u2013 le t\xE9l\xE9viseur affiche un code dans un instant \u2026",
    it: "Avvio dell'associazione \u2013 il televisore mostrer\xE0 a breve un codice \u2026",
    es: "Iniciando el emparejamiento \u2013 el televisor mostrar\xE1 un c\xF3digo en un momento \u2026",
    pl: "Rozpoczynanie parowania \u2013 telewizor za chwil\u0119 wy\u015Bwietli kod \u2026",
    uk: "\u0417\u0430\u043F\u0443\u0441\u043A \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F \u2013 \u0442\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440 \u0437\u0430\u0440\u0430\u0437 \u043F\u043E\u043A\u0430\u0436\u0435 \u043A\u043E\u0434 \u2026",
    "zh-cn": "\u6B63\u5728\u5F00\u59CB\u914D\u5BF9\u2014\u2014\u7535\u89C6\u7A0D\u540E\u5C06\u663E\u793A\u4E00\u4E2A\u4EE3\u7801\u2026"
  },
  notRunning: {
    en: "The device is disabled or the instance was just restarted.",
    de: "Das Ger\xE4t ist deaktiviert oder die Instanz wurde gerade neu gestartet.",
    ru: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0438\u043B\u0438 \u044D\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440 \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0449\u0435\u043D.",
    pt: "O dispositivo est\xE1 desativado ou a inst\xE2ncia acabou de reiniciar.",
    nl: "Het apparaat is uitgeschakeld of de instantie is net opnieuw gestart.",
    fr: "L'appareil est d\xE9sactiv\xE9 ou l'instance vient de red\xE9marrer.",
    it: "Il dispositivo \xE8 disattivato oppure l'istanza \xE8 appena stata riavviata.",
    es: "El dispositivo est\xE1 desactivado o la instancia se acaba de reiniciar.",
    pl: "Urz\u0105dzenie jest wy\u0142\u0105czone lub instancja zosta\u0142a w\u0142a\u015Bnie uruchomiona ponownie.",
    uk: "\u041F\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u0432\u0438\u043C\u043A\u043D\u0435\u043D\u043E \u0430\u0431\u043E \u0435\u043A\u0437\u0435\u043C\u043F\u043B\u044F\u0440 \u0449\u043E\u0439\u043D\u043E \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E.",
    "zh-cn": "\u8BBE\u5907\u5DF2\u505C\u7528\uFF0C\u6216\u5B9E\u4F8B\u521A\u521A\u91CD\u65B0\u542F\u52A8\u3002"
  },
  reconnecting: {
    en: "Connecting again \u2026",
    de: "Verbindung wird neu aufgebaut \u2026",
    ru: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u2026",
    pt: "A ligar novamente \u2026",
    nl: "Opnieuw verbinden \u2026",
    fr: "Reconnexion en cours \u2026",
    it: "Riconnessione in corso \u2026",
    es: "Reconectando \u2026",
    pl: "Ponowne \u0142\u0105czenie \u2026",
    uk: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u0435 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F \u2026",
    "zh-cn": "\u6B63\u5728\u91CD\u65B0\u8FDE\u63A5\u2026"
  },
  duplicateHost: {
    en: "This IP address is already used by another device.",
    de: "Diese IP-Adresse ist bereits bei einem anderen Ger\xE4t eingetragen.",
    ru: "\u042D\u0442\u043E\u0442 IP-\u0430\u0434\u0440\u0435\u0441 \u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0434\u0440\u0443\u0433\u0438\u043C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E\u043C.",
    pt: "Este endere\xE7o IP j\xE1 \xE9 usado por outro dispositivo.",
    nl: "Dit IP-adres wordt al door een ander apparaat gebruikt.",
    fr: "Cette adresse IP est d\xE9j\xE0 utilis\xE9e par un autre appareil.",
    it: "Questo indirizzo IP \xE8 gi\xE0 usato da un altro dispositivo.",
    es: "Esta direcci\xF3n IP ya la usa otro dispositivo.",
    pl: "Ten adres IP jest ju\u017C u\u017Cywany przez inne urz\u0105dzenie.",
    uk: "\u0426\u044F IP-\u0430\u0434\u0440\u0435\u0441\u0430 \u0432\u0436\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F \u0456\u043D\u0448\u0438\u043C \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u0454\u043C.",
    "zh-cn": "\u6B64 IP \u5730\u5740\u5DF2\u88AB\u53E6\u4E00\u53F0\u8BBE\u5907\u4F7F\u7528\u3002"
  },
  missingFields: {
    en: "Please enter a name and the IP address.",
    de: "Bitte Namen und IP-Adresse eintragen.",
    ru: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043C\u044F \u0438 IP-\u0430\u0434\u0440\u0435\u0441.",
    pt: "Introduza um nome e o endere\xE7o IP.",
    nl: "Vul een naam en het IP-adres in.",
    fr: "Veuillez saisir un nom et l\u2019adresse IP.",
    it: "Inserisci un nome e l\u2019indirizzo IP.",
    es: "Introduce un nombre y la direcci\xF3n IP.",
    pl: "Wpisz nazw\u0119 i adres IP.",
    uk: "\u0412\u0432\u0435\u0434\u0456\u0442\u044C \u043D\u0430\u0437\u0432\u0443 \u0442\u0430 IP-\u0430\u0434\u0440\u0435\u0441\u0443.",
    "zh-cn": "\u8BF7\u8F93\u5165\u540D\u79F0\u548C IP \u5730\u5740\u3002"
  },
  power: {
    en: "Power",
    de: "Ein/Aus",
    ru: "\u041F\u0438\u0442\u0430\u043D\u0438\u0435",
    pt: "Ligar/Desligar",
    nl: "Aan/Uit",
    fr: "Marche/Arr\xEAt",
    it: "Accensione",
    es: "Encendido",
    pl: "Zasilanie",
    uk: "\u0416\u0438\u0432\u043B\u0435\u043D\u043D\u044F",
    "zh-cn": "\u7535\u6E90"
  },
  mute: {
    en: "Mute",
    de: "Stumm",
    ru: "\u0411\u0435\u0437 \u0437\u0432\u0443\u043A\u0430",
    pt: "Silenciar",
    nl: "Dempen",
    fr: "Muet",
    it: "Muto",
    es: "Silencio",
    pl: "Wycisz",
    uk: "\u0411\u0435\u0437 \u0437\u0432\u0443\u043A\u0443",
    "zh-cn": "\u9759\u97F3"
  },
  volumeUp: {
    en: "Volume +",
    de: "Lauter",
    ru: "\u0413\u0440\u043E\u043C\u0447\u0435",
    pt: "Volume +",
    nl: "Volume +",
    fr: "Volume +",
    it: "Volume +",
    es: "Volumen +",
    pl: "G\u0142o\u015Bniej",
    uk: "\u0413\u0443\u0447\u043D\u0456\u0448\u0435",
    "zh-cn": "\u97F3\u91CF +"
  },
  volumeDown: {
    en: "Volume \u2212",
    de: "Leiser",
    ru: "\u0422\u0438\u0448\u0435",
    pt: "Volume \u2212",
    nl: "Volume \u2212",
    fr: "Volume \u2212",
    it: "Volume \u2212",
    es: "Volumen \u2212",
    pl: "Ciszej",
    uk: "\u0422\u0438\u0445\u0456\u0448\u0435",
    "zh-cn": "\u97F3\u91CF \u2212"
  },
  playPause: {
    en: "Play/Pause",
    de: "Wiedergabe/Pause",
    ru: "\u0412\u043E\u0441\u043F\u0440./\u041F\u0430\u0443\u0437\u0430",
    pt: "Reproduzir/Pausa",
    nl: "Afspelen/Pauze",
    fr: "Lecture/Pause",
    it: "Riproduci/Pausa",
    es: "Reproducir/Pausa",
    pl: "Odtw\xF3rz/Pauza",
    uk: "\u0412\u0456\u0434\u0442\u0432./\u041F\u0430\u0443\u0437\u0430",
    "zh-cn": "\u64AD\u653E/\u6682\u505C"
  },
  home: {
    en: "Home",
    de: "Startseite",
    ru: "\u0414\u043E\u043C\u043E\u0439",
    pt: "In\xEDcio",
    nl: "Start",
    fr: "Accueil",
    it: "Home",
    es: "Inicio",
    pl: "Ekran g\u0142\xF3wny",
    uk: "\u0414\u043E\u0434\u043E\u043C\u0443",
    "zh-cn": "\u4E3B\u9875"
  },
  title: {
    en: "Title",
    de: "Titel",
    ru: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
    pt: "T\xEDtulo",
    nl: "Titel",
    fr: "Titre",
    it: "Titolo",
    es: "T\xEDtulo",
    pl: "Tytu\u0142",
    uk: "\u041D\u0430\u0437\u0432\u0430",
    "zh-cn": "\u6807\u9898"
  },
  currentApp: {
    en: "Current app",
    de: "Aktuelle App",
    ru: "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
    pt: "Aplica\xE7\xE3o atual",
    nl: "Huidige app",
    fr: "Application en cours",
    it: "App attuale",
    es: "App actual",
    pl: "Bie\u017C\u0105ca aplikacja",
    uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A",
    "zh-cn": "\u5F53\u524D\u5E94\u7528"
  },
  volume: {
    en: "Volume",
    de: "Lautst\xE4rke",
    ru: "\u0413\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C",
    pt: "Volume",
    nl: "Volume",
    fr: "Volume",
    it: "Volume",
    es: "Volumen",
    pl: "G\u0142o\u015Bno\u015B\u0107",
    uk: "\u0413\u0443\u0447\u043D\u0456\u0441\u0442\u044C",
    "zh-cn": "\u97F3\u91CF"
  },
  pairingRequired: {
    en: "Pairing required",
    de: "Kopplung n\xF6tig",
    ru: "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435",
    pt: "Emparelhamento necess\xE1rio",
    nl: "Koppelen vereist",
    fr: "Appairage requis",
    it: "Associazione richiesta",
    es: "Emparejamiento necesario",
    pl: "Wymagane parowanie",
    uk: "\u041F\u043E\u0442\u0440\u0456\u0431\u043D\u0435 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F",
    "zh-cn": "\u9700\u8981\u914D\u5BF9"
  },
  model: {
    en: "Model",
    de: "Modell",
    ru: "\u041C\u043E\u0434\u0435\u043B\u044C",
    pt: "Modelo",
    nl: "Model",
    fr: "Mod\xE8le",
    it: "Modello",
    es: "Modelo",
    pl: "Model",
    uk: "\u041C\u043E\u0434\u0435\u043B\u044C",
    "zh-cn": "\u578B\u53F7"
  },
  firmware: {
    en: "Software version",
    de: "Softwareversion",
    ru: "\u0412\u0435\u0440\u0441\u0438\u044F \u041F\u041E",
    pt: "Vers\xE3o do software",
    nl: "Softwareversie",
    fr: "Version du logiciel",
    it: "Versione software",
    es: "Versi\xF3n de software",
    pl: "Wersja oprogramowania",
    uk: "\u0412\u0435\u0440\u0441\u0456\u044F \u041F\u0417",
    "zh-cn": "\u8F6F\u4EF6\u7248\u672C"
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DM_TEXTS
});
//# sourceMappingURL=dm-texts.js.map
