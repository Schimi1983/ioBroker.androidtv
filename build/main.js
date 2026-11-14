"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_auth = require("./lib/adb/auth");
var import_client = require("./lib/adb/client");
var import_app_names = require("./lib/app-names");
var import_device_management = require("./lib/device-management");
var import_device = require("./lib/adb/device");
var import_certificate = require("./lib/certificate");
var import_pairing = require("./lib/pairing");
var import_remote = require("./lib/remote");
var import_states = require("./lib/states");
var import_wol = require("./lib/wol");
const PAIRING_SESSION_TTL_MS = 12e4;
const DEFAULT_RECONNECT_MAX_S = 60;
const DEFAULT_ADB_POLL_S = 5;
const CERT_FILE = "client-certificate.json";
const ADB_KEY_FILE = "adb-key.json";
const OFFLINE_GRACE_MS = 3e4;
const MESSAGES = {
  pairingStarted: {
    en: 'The TV now shows a 6-character code. Enter it and click "Confirm code".',
    de: "Der TV zeigt jetzt einen 6-stelligen Code. Code eingeben und \u201ECode best\xE4tigen\u201C klicken.",
    ru: "\u0422\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 6-\u0437\u043D\u0430\u0447\u043D\u044B\u0439 \u043A\u043E\u0434. \u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0435\u0433\u043E \u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u043A\u043E\u0434\xBB.",
    pt: 'A TV mostra agora um c\xF3digo de 6 caracteres. Introduza-o e clique em "Confirmar c\xF3digo".',
    nl: 'De tv toont nu een code van 6 tekens. Voer deze in en klik op "Code bevestigen".',
    fr: "Le t\xE9l\xE9viseur affiche maintenant un code \xE0 6 caract\xE8res. Saisissez-le et cliquez sur \xAB Confirmer le code \xBB.",
    it: 'La TV mostra ora un codice di 6 caratteri. Inseriscilo e fai clic su "Conferma codice".',
    es: 'La TV muestra ahora un c\xF3digo de 6 caracteres. Introd\xFAzcalo y haga clic en "Confirmar c\xF3digo".',
    pl: "Telewizor wy\u015Bwietla teraz 6-znakowy kod. Wpisz go i kliknij \u201EPotwierd\u017A kod\u201D.",
    uk: "\u0422\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440 \u043F\u043E\u043A\u0430\u0437\u0443\u0454 6-\u0437\u043D\u0430\u0447\u043D\u0438\u0439 \u043A\u043E\u0434. \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u0439\u043E\u0433\u043E \u0442\u0430 \u043D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \xAB\u041F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u043A\u043E\u0434\xBB.",
    "zh-cn": "\u7535\u89C6\u73B0\u5728\u663E\u793A\u4E00\u4E2A 6 \u4F4D\u4EE3\u7801\u3002\u8BF7\u8F93\u5165\u4EE3\u7801\u5E76\u70B9\u51FB\u201C\u786E\u8BA4\u4EE3\u7801\u201D\u3002"
  },
  pairingDone: {
    en: "Pairing successful. The connection is being established.",
    de: "Kopplung erfolgreich. Die Verbindung wird aufgebaut.",
    ru: "\u0421\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E. \u0423\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435.",
    pt: "Emparelhamento conclu\xEDdo. A liga\xE7\xE3o est\xE1 a ser estabelecida.",
    nl: "Koppelen gelukt. De verbinding wordt opgebouwd.",
    fr: "Appairage r\xE9ussi. La connexion est en cours d\u2019\xE9tablissement.",
    it: "Associazione riuscita. La connessione \xE8 in corso.",
    es: "Emparejamiento correcto. Se est\xE1 estableciendo la conexi\xF3n.",
    pl: "Parowanie zako\u0144czone. Trwa nawi\u0105zywanie po\u0142\u0105czenia.",
    uk: "\u0421\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E. \u0412\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u044E\u0454\u0442\u044C\u0441\u044F \u0437\u2019\u0454\u0434\u043D\u0430\u043D\u043D\u044F.",
    "zh-cn": "\u914D\u5BF9\u6210\u529F\uFF0C\u6B63\u5728\u5EFA\u7ACB\u8FDE\u63A5\u3002"
  },
  pairingDoneSave: {
    en: "Pairing successful. Save the settings to connect to this TV.",
    de: "Kopplung erfolgreich. Einstellungen speichern, damit die Verbindung aufgebaut wird.",
    ru: "\u0421\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E. \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F \u043A \u0442\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440\u0443.",
    pt: "Emparelhamento conclu\xEDdo. Guarde as defini\xE7\xF5es para ligar a esta TV.",
    nl: "Koppelen gelukt. Sla de instellingen op om met deze tv te verbinden.",
    fr: "Appairage r\xE9ussi. Enregistrez les param\xE8tres pour vous connecter \xE0 ce t\xE9l\xE9viseur.",
    it: "Associazione riuscita. Salva le impostazioni per connetterti a questa TV.",
    es: "Emparejamiento correcto. Guarde los ajustes para conectarse a esta TV.",
    pl: "Parowanie zako\u0144czone. Zapisz ustawienia, aby po\u0142\u0105czy\u0107 si\u0119 z telewizorem.",
    uk: "\u0421\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F \u0432\u0438\u043A\u043E\u043D\u0430\u043D\u043E. \u0417\u0431\u0435\u0440\u0435\u0436\u0456\u0442\u044C \u043D\u0430\u043B\u0430\u0448\u0442\u0443\u0432\u0430\u043D\u043D\u044F, \u0449\u043E\u0431 \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0438\u0441\u044F \u0434\u043E \u0442\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440\u0430.",
    "zh-cn": "\u914D\u5BF9\u6210\u529F\u3002\u8BF7\u4FDD\u5B58\u8BBE\u7F6E\u4EE5\u8FDE\u63A5\u5230\u6B64\u7535\u89C6\u3002"
  },
  statusConnected: {
    en: "Connected",
    de: "Verbunden",
    ru: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
    pt: "Conectado",
    nl: "Verbonden",
    fr: "Connect\xE9",
    it: "Connesso",
    es: "Conectado",
    pl: "Po\u0142\u0105czono",
    uk: "\u041F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
    "zh-cn": "\u5DF2\u8FDE\u63A5"
  },
  statusPairing: {
    en: "Pairing required \u2013 switch the device on and follow step 1",
    de: "Kopplung erforderlich \u2013 Ger\xE4t einschalten und Schritt 1 ausf\xFChren",
    ru: "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u2013 \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0448\u0430\u0433 1",
    pt: "Emparelhamento necess\xE1rio \u2013 ligue o dispositivo e siga o passo 1",
    nl: "Koppelen vereist \u2013 zet het apparaat aan en volg stap 1",
    fr: "Appairage requis \u2013 allumez l\u2019appareil et suivez l\u2019\xE9tape 1",
    it: "Associazione necessaria \u2013 accendi il dispositivo e segui il passo 1",
    es: "Emparejamiento necesario \u2013 encienda el dispositivo y siga el paso 1",
    pl: "Wymagane parowanie \u2013 w\u0142\u0105cz urz\u0105dzenie i wykonaj krok 1",
    uk: "\u041F\u043E\u0442\u0440\u0456\u0431\u043D\u0435 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F \u2013 \u0443\u0432\u0456\u043C\u043A\u043D\u0456\u0442\u044C \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u0456 \u0432\u0438\u043A\u043E\u043D\u0430\u0439\u0442\u0435 \u043A\u0440\u043E\u043A 1",
    "zh-cn": "\u9700\u8981\u914D\u5BF9 \u2013 \u8BF7\u6253\u5F00\u8BBE\u5907\u5E76\u6309\u7167\u7B2C 1 \u6B65\u64CD\u4F5C"
  },
  statusOffline: {
    en: "Not connected \u2013 device switched off, unplugged or unreachable",
    de: "Nicht verbunden \u2013 Ger\xE4t aus, ohne Strom oder nicht erreichbar",
    ru: "\u041D\u0435\u0442 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u2013 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E, \u043E\u0431\u0435\u0441\u0442\u043E\u0447\u0435\u043D\u043E \u0438\u043B\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E",
    pt: "Sem liga\xE7\xE3o \u2013 dispositivo desligado, sem corrente ou inacess\xEDvel",
    nl: "Niet verbonden \u2013 apparaat uit, zonder stroom of onbereikbaar",
    fr: "Non connect\xE9 \u2013 appareil \xE9teint, d\xE9branch\xE9 ou injoignable",
    it: "Non connesso \u2013 dispositivo spento, scollegato o non raggiungibile",
    es: "Sin conexi\xF3n \u2013 dispositivo apagado, desenchufado o inaccesible",
    pl: "Brak po\u0142\u0105czenia \u2013 urz\u0105dzenie wy\u0142\u0105czone, bez zasilania lub nieosi\u0105galne",
    uk: "\u041D\u0435\u043C\u0430\u0454 \u0437\u2019\u0454\u0434\u043D\u0430\u043D\u043D\u044F \u2013 \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u0432\u0438\u043C\u043A\u043D\u0435\u043D\u043E, \u0437\u043D\u0435\u0441\u0442\u0440\u0443\u043C\u043B\u0435\u043D\u043E \u0430\u0431\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0438\u0439",
    "zh-cn": "\u672A\u8FDE\u63A5 \u2013 \u8BBE\u5907\u5DF2\u5173\u95ED\u3001\u65AD\u7535\u6216\u65E0\u6CD5\u8BBF\u95EE"
  },
  statusAdbPending: {
    en: 'Please confirm "Allow debugging" on the TV (tick "Always allow")',
    de: "Bitte am Fernseher \u201EDebugging zulassen\u201C best\xE4tigen (\u201EImmer zulassen\u201C anhaken)",
    ru: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \xAB\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044C \u043E\u0442\u043B\u0430\u0434\u043A\u0443\xBB \u043D\u0430 \u0442\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440\u0435 (\u043E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \xAB\u0412\u0441\u0435\u0433\u0434\u0430 \u0440\u0430\u0437\u0440\u0435\u0448\u0430\u0442\u044C\xBB)",
    pt: 'Confirme "Permitir depura\xE7\xE3o" na TV (assinale "Permitir sempre")',
    nl: 'Bevestig "Foutopsporing toestaan" op de tv (vink "Altijd toestaan" aan)',
    fr: "Confirmez \xAB Autoriser le d\xE9bogage \xBB sur le t\xE9l\xE9viseur (cochez \xAB Toujours autoriser \xBB)",
    it: 'Conferma "Consenti debug" sulla TV (spunta "Consenti sempre")',
    es: 'Confirme "Permitir depuraci\xF3n" en la TV (marque "Permitir siempre")',
    pl: "Potwierd\u017A \u201EZezw\xF3l na debugowanie\u201D na telewizorze (zaznacz \u201EZawsze zezwalaj\u201D)",
    uk: "\u041F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u044C\u0442\u0435 \xAB\u0414\u043E\u0437\u0432\u043E\u043B\u0438\u0442\u0438 \u043D\u0430\u043B\u0430\u0433\u043E\u0434\u0436\u0435\u043D\u043D\u044F\xBB \u043D\u0430 \u0442\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440\u0456 (\u043F\u043E\u0437\u043D\u0430\u0447\u0442\u0435 \xAB\u0417\u0430\u0432\u0436\u0434\u0438 \u0434\u043E\u0437\u0432\u043E\u043B\u044F\u0442\u0438\xBB)",
    "zh-cn": "\u8BF7\u5728\u7535\u89C6\u4E0A\u786E\u8BA4\u201C\u5141\u8BB8\u8C03\u8BD5\u201D\uFF08\u52FE\u9009\u201C\u59CB\u7EC8\u5141\u8BB8\u201D\uFF09"
  },
  statusAdbOffline: {
    en: "Not connected \u2013 device switched off or debugging not enabled",
    de: "Nicht verbunden \u2013 Ger\xE4t aus oder Debugging am Ger\xE4t nicht eingeschaltet",
    ru: "\u041D\u0435\u0442 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u2013 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0438\u043B\u0438 \u043E\u0442\u043B\u0430\u0434\u043A\u0430 \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430",
    pt: "Sem liga\xE7\xE3o \u2013 dispositivo desligado ou depura\xE7\xE3o n\xE3o ativada",
    nl: "Niet verbonden \u2013 apparaat uit of foutopsporing niet ingeschakeld",
    fr: "Non connect\xE9 \u2013 appareil \xE9teint ou d\xE9bogage non activ\xE9",
    it: "Non connesso \u2013 dispositivo spento o debug non attivato",
    es: "Sin conexi\xF3n \u2013 dispositivo apagado o depuraci\xF3n no activada",
    pl: "Brak po\u0142\u0105czenia \u2013 urz\u0105dzenie wy\u0142\u0105czone lub debugowanie nie jest w\u0142\u0105czone",
    uk: "\u041D\u0435\u043C\u0430\u0454 \u0437\u2019\u0454\u0434\u043D\u0430\u043D\u043D\u044F \u2013 \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u0432\u0438\u043C\u043A\u043D\u0435\u043D\u043E \u0430\u0431\u043E \u043D\u0430\u043B\u0430\u0433\u043E\u0434\u0436\u0435\u043D\u043D\u044F \u043D\u0435 \u0432\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E",
    "zh-cn": "\u672A\u8FDE\u63A5 \u2013 \u8BBE\u5907\u5DF2\u5173\u95ED\u6216\u672A\u542F\u7528\u8C03\u8BD5"
  },
  statusAdbOk: {
    en: "playback info active",
    de: "Wiedergabe-Infos aktiv",
    ru: "\u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0438 \u0430\u043A\u0442\u0438\u0432\u043D\u044B",
    pt: "informa\xE7\xF5es de reprodu\xE7\xE3o ativas",
    nl: "afspeelinfo actief",
    fr: "infos de lecture actives",
    it: "info di riproduzione attive",
    es: "informaci\xF3n de reproducci\xF3n activa",
    pl: "informacje o odtwarzaniu aktywne",
    uk: "\u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0456 \u043F\u0440\u043E \u0432\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u0456",
    "zh-cn": "\u64AD\u653E\u4FE1\u606F\u5DF2\u542F\u7528"
  },
  statusInfoOffline: {
    en: "playback info not available (debugging switched on?)",
    de: "Wiedergabe-Infos nicht verf\xFCgbar (Debugging eingeschaltet?)",
    ru: "\u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0438 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B (\u043E\u0442\u043B\u0430\u0434\u043A\u0430 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430?)",
    pt: "informa\xE7\xF5es de reprodu\xE7\xE3o indispon\xEDveis (depura\xE7\xE3o ativada?)",
    nl: "afspeelinfo niet beschikbaar (foutopsporing ingeschakeld?)",
    fr: "infos de lecture indisponibles (d\xE9bogage activ\xE9 ?)",
    it: "info di riproduzione non disponibili (debug attivato?)",
    es: "informaci\xF3n de reproducci\xF3n no disponible (\xBFdepuraci\xF3n activada?)",
    pl: "informacje o odtwarzaniu niedost\u0119pne (debugowanie w\u0142\u0105czone?)",
    uk: "\u0432\u0456\u0434\u043E\u043C\u043E\u0441\u0442\u0456 \u043F\u0440\u043E \u0432\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0456 (\u043D\u0430\u043B\u0430\u0433\u043E\u0434\u0436\u0435\u043D\u043D\u044F \u0432\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E?)",
    "zh-cn": "\u64AD\u653E\u4FE1\u606F\u4E0D\u53EF\u7528\uFF08\u662F\u5426\u5DF2\u542F\u7528\u8C03\u8BD5\uFF1F\uFF09"
  },
  statusDisabled: {
    en: "Disabled",
    de: "Deaktiviert",
    ru: "\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
    pt: "Desativado",
    nl: "Uitgeschakeld",
    fr: "D\xE9sactiv\xE9",
    it: "Disattivato",
    es: "Desactivado",
    pl: "Wy\u0142\u0105czone",
    uk: "\u0412\u0438\u043C\u043A\u043D\u0435\u043D\u043E",
    "zh-cn": "\u5DF2\u7981\u7528"
  },
  statusUnsaved: {
    en: "Not saved yet \u2013 pairing already works, the connection starts after saving",
    de: "Noch nicht gespeichert \u2013 Koppeln geht schon, die Verbindung startet nach dem Speichern",
    ru: "\u0415\u0449\u0451 \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u2013 \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0443\u0436\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442, \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F",
    pt: "Ainda n\xE3o guardado \u2013 o emparelhamento j\xE1 funciona, a liga\xE7\xE3o come\xE7a depois de guardar",
    nl: "Nog niet opgeslagen \u2013 koppelen werkt al, de verbinding start na het opslaan",
    fr: "Pas encore enregistr\xE9 \u2013 l\u2019appairage fonctionne d\xE9j\xE0, la connexion d\xE9marre apr\xE8s l\u2019enregistrement",
    it: "Non ancora salvato \u2013 l\u2019associazione funziona gi\xE0, la connessione parte dopo il salvataggio",
    es: "A\xFAn no guardado \u2013 el emparejamiento ya funciona, la conexi\xF3n empieza al guardar",
    pl: "Jeszcze nie zapisano \u2013 parowanie ju\u017C dzia\u0142a, po\u0142\u0105czenie rozpocznie si\u0119 po zapisaniu",
    uk: "\u0429\u0435 \u043D\u0435 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043E \u2013 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F \u0432\u0436\u0435 \u043F\u0440\u0430\u0446\u044E\u0454, \u0437\u2019\u0454\u0434\u043D\u0430\u043D\u043D\u044F \u043F\u043E\u0447\u043D\u0435\u0442\u044C\u0441\u044F \u043F\u0456\u0441\u043B\u044F \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F",
    "zh-cn": "\u5C1A\u672A\u4FDD\u5B58 \u2013 \u5DF2\u53EF\u914D\u5BF9\uFF0C\u4FDD\u5B58\u540E\u5F00\u59CB\u8FDE\u63A5"
  },
  statusNoHost: {
    en: "Enter the IP address first",
    de: "Zuerst die IP-Adresse eintragen",
    ru: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 IP-\u0430\u0434\u0440\u0435\u0441",
    pt: "Introduza primeiro o endere\xE7o IP",
    nl: "Voer eerst het IP-adres in",
    fr: "Saisissez d\u2019abord l\u2019adresse IP",
    it: "Inserisci prima l\u2019indirizzo IP",
    es: "Introduzca primero la direcci\xF3n IP",
    pl: "Najpierw wpisz adres IP",
    uk: "\u0421\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u0432\u0432\u0435\u0434\u0456\u0442\u044C IP-\u0430\u0434\u0440\u0435\u0441\u0443",
    "zh-cn": "\u8BF7\u5148\u8F93\u5165 IP \u5730\u5740"
  },
  noHost: {
    en: "Please enter the IP address of the TV.",
    de: "Bitte die IP-Adresse des TV eingeben.",
    ru: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 IP-\u0430\u0434\u0440\u0435\u0441 \u0442\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440\u0430.",
    pt: "Introduza o endere\xE7o IP da TV.",
    nl: "Voer het IP-adres van de tv in.",
    fr: "Saisissez l\u2019adresse IP du t\xE9l\xE9viseur.",
    it: "Inserisci l\u2019indirizzo IP della TV.",
    es: "Introduzca la direcci\xF3n IP de la TV.",
    pl: "Wpisz adres IP telewizora.",
    uk: "\u0412\u0432\u0435\u0434\u0456\u0442\u044C IP-\u0430\u0434\u0440\u0435\u0441\u0443 \u0442\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440\u0430.",
    "zh-cn": "\u8BF7\u8F93\u5165\u7535\u89C6\u7684 IP \u5730\u5740\u3002"
  },
  noSession: {
    en: 'No pairing in progress for this IP - click "Start pairing" first.',
    de: "F\xFCr diese IP l\xE4uft keine Kopplung - zuerst \u201EKopplung starten\u201C klicken.",
    ru: "\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E IP \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E \u2013 \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041D\u0430\u0447\u0430\u0442\u044C \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435\xBB.",
    pt: 'N\xE3o h\xE1 emparelhamento em curso para este IP - clique primeiro em "Iniciar emparelhamento".',
    nl: 'Geen koppeling bezig voor dit IP - klik eerst op "Koppelen starten".',
    fr: "Aucun appairage en cours pour cette IP - cliquez d\u2019abord sur \xAB D\xE9marrer l\u2019appairage \xBB.",
    it: 'Nessuna associazione in corso per questo IP - fai prima clic su "Avvia associazione".',
    es: 'No hay emparejamiento en curso para esta IP - haga clic primero en "Iniciar emparejamiento".',
    pl: "Dla tego IP nie trwa parowanie \u2013 najpierw kliknij \u201ERozpocznij parowanie\u201D.",
    uk: "\u0414\u043B\u044F \u0446\u0456\u0454\u0457 IP \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F \u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E \u2013 \u0441\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u043D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \xAB\u041F\u043E\u0447\u0430\u0442\u0438 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F\xBB.",
    "zh-cn": "\u6B64 IP \u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u914D\u5BF9 - \u8BF7\u5148\u70B9\u51FB\u201C\u5F00\u59CB\u914D\u5BF9\u201D\u3002"
  },
  noCertificate: {
    en: "Client certificate not ready yet - wait a few seconds and try again.",
    de: "Client-Zertifikat noch nicht bereit - ein paar Sekunden warten und erneut versuchen.",
    ru: "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442 \u043A\u043B\u0438\u0435\u043D\u0442\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0433\u043E\u0442\u043E\u0432 \u2013 \u043F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0435\u043A\u0443\u043D\u0434 \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435.",
    pt: "O certificado do cliente ainda n\xE3o est\xE1 pronto - aguarde alguns segundos e tente novamente.",
    nl: "Clientcertificaat nog niet klaar - wacht enkele seconden en probeer het opnieuw.",
    fr: "Le certificat client n\u2019est pas encore pr\xEAt - attendez quelques secondes et r\xE9essayez.",
    it: "Il certificato client non \xE8 ancora pronto - attendi qualche secondo e riprova.",
    es: "El certificado de cliente a\xFAn no est\xE1 listo - espere unos segundos y vuelva a intentarlo.",
    pl: "Certyfikat klienta nie jest jeszcze gotowy \u2013 odczekaj kilka sekund i spr\xF3buj ponownie.",
    uk: "\u0421\u0435\u0440\u0442\u0438\u0444\u0456\u043A\u0430\u0442 \u043A\u043B\u0456\u0454\u043D\u0442\u0430 \u0449\u0435 \u043D\u0435 \u0433\u043E\u0442\u043E\u0432\u0438\u0439 \u2013 \u0437\u0430\u0447\u0435\u043A\u0430\u0439\u0442\u0435 \u043A\u0456\u043B\u044C\u043A\u0430 \u0441\u0435\u043A\u0443\u043D\u0434 \u0456 \u043F\u043E\u0432\u0442\u043E\u0440\u0456\u0442\u044C.",
    "zh-cn": "\u5BA2\u6237\u7AEF\u8BC1\u4E66\u5C1A\u672A\u5C31\u7EEA - \u8BF7\u7B49\u5F85\u51E0\u79D2\u540E\u91CD\u8BD5\u3002"
  },
  connect: {
    en: 'The device cannot be reached for pairing. Check the IP address and that the device is switched on. For a Fire TV choose the device type "Amazon Fire TV" \u2013 it needs no pairing.',
    de: "Das Ger\xE4t ist zum Koppeln nicht erreichbar. IP-Adresse pr\xFCfen und ob das Ger\xE4t eingeschaltet ist. F\xFCr einen Fire TV den Ger\xE4tetyp \u201EAmazon Fire TV\u201C w\xE4hlen \u2013 dort ist keine Kopplung n\xF6tig.",
    ru: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0434\u043B\u044F \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u044F. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 IP-\u0430\u0434\u0440\u0435\u0441 \u0438 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u043B\u0438 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E. \u0414\u043B\u044F Fire TV \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043F \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \xABAmazon Fire TV\xBB \u2013 \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F.",
    pt: 'O dispositivo n\xE3o est\xE1 acess\xEDvel para emparelhamento. Verifique o endere\xE7o IP e se o dispositivo est\xE1 ligado. Para um Fire TV escolha o tipo de dispositivo "Amazon Fire TV" \u2013 n\xE3o precisa de emparelhamento.',
    nl: 'Het apparaat is niet bereikbaar om te koppelen. Controleer het IP-adres en of het apparaat aan staat. Kies voor een Fire TV het apparaattype "Amazon Fire TV" \u2013 koppelen is dan niet nodig.',
    fr: "L\u2019appareil est injoignable pour l\u2019appairage. V\xE9rifiez l\u2019adresse IP et que l\u2019appareil est allum\xE9. Pour un Fire TV, choisissez le type d\u2019appareil \xAB Amazon Fire TV \xBB \u2013 aucun appairage n\u2019est n\xE9cessaire.",
    it: 'Il dispositivo non \xE8 raggiungibile per l\u2019associazione. Controlla l\u2019indirizzo IP e che il dispositivo sia acceso. Per una Fire TV scegli il tipo di dispositivo "Amazon Fire TV" \u2013 non serve l\u2019associazione.',
    es: 'No se puede acceder al dispositivo para emparejarlo. Compruebe la direcci\xF3n IP y que el dispositivo est\xE9 encendido. Para un Fire TV elija el tipo de dispositivo "Amazon Fire TV" \u2013 no necesita emparejamiento.',
    pl: "Urz\u0105dzenie jest nieosi\u0105galne do parowania. Sprawd\u017A adres IP i czy urz\u0105dzenie jest w\u0142\u0105czone. Dla Fire TV wybierz typ urz\u0105dzenia \u201EAmazon Fire TV\u201D \u2013 parowanie nie jest potrzebne.",
    uk: "\u041F\u0440\u0438\u0441\u0442\u0440\u0456\u0439 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0438\u0439 \u0434\u043B\u044F \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F. \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 IP-\u0430\u0434\u0440\u0435\u0441\u0443 \u0442\u0430 \u0447\u0438 \u0432\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E \u043F\u0440\u0438\u0441\u0442\u0440\u0456\u0439. \u0414\u043B\u044F Fire TV \u0432\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u0442\u0438\u043F \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u044E \xABAmazon Fire TV\xBB \u2013 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F \u043D\u0435 \u043F\u043E\u0442\u0440\u0456\u0431\u043D\u0435.",
    "zh-cn": "\u65E0\u6CD5\u8FDE\u63A5\u8BBE\u5907\u8FDB\u884C\u914D\u5BF9\u3002\u8BF7\u68C0\u67E5 IP \u5730\u5740\u4EE5\u53CA\u8BBE\u5907\u662F\u5426\u5DF2\u5F00\u542F\u3002Fire TV \u8BF7\u9009\u62E9\u8BBE\u5907\u7C7B\u578B\u201CAmazon Fire TV\u201D\u2013 \u65E0\u9700\u914D\u5BF9\u3002"
  },
  timeout: {
    en: "The TV did not answer in time.",
    de: "Der TV hat nicht rechtzeitig geantwortet.",
    ru: "\u0422\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440 \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u0432\u043E\u0432\u0440\u0435\u043C\u044F.",
    pt: "A TV n\xE3o respondeu a tempo.",
    nl: "De tv heeft niet op tijd geantwoord.",
    fr: "Le t\xE9l\xE9viseur n\u2019a pas r\xE9pondu \xE0 temps.",
    it: "La TV non ha risposto in tempo.",
    es: "La TV no respondi\xF3 a tiempo.",
    pl: "Telewizor nie odpowiedzia\u0142 na czas.",
    uk: "\u0422\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440 \u043D\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0432 \u0432\u0447\u0430\u0441\u043D\u043E.",
    "zh-cn": "\u7535\u89C6\u672A\u53CA\u65F6\u54CD\u5E94\u3002"
  },
  closed: {
    en: "The TV closed the pairing (cancelled or timed out). Start again.",
    de: "Der TV hat die Kopplung beendet (abgebrochen oder Zeit abgelaufen). Erneut starten.",
    ru: "\u0422\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 (\u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E \u0438\u043B\u0438 \u0438\u0441\u0442\u0435\u043A\u043B\u043E \u0432\u0440\u0435\u043C\u044F). \u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0437\u0430\u043D\u043E\u0432\u043E.",
    pt: "A TV terminou o emparelhamento (cancelado ou tempo esgotado). Comece novamente.",
    nl: "De tv heeft het koppelen be\xEBindigd (geannuleerd of verlopen). Begin opnieuw.",
    fr: "Le t\xE9l\xE9viseur a mis fin \xE0 l\u2019appairage (annul\xE9 ou d\xE9lai d\xE9pass\xE9). Recommencez.",
    it: "La TV ha terminato l\u2019associazione (annullata o scaduta). Ricomincia.",
    es: "La TV termin\xF3 el emparejamiento (cancelado o tiempo agotado). Vuelva a empezar.",
    pl: "Telewizor zako\u0144czy\u0142 parowanie (anulowano lub up\u0142yn\u0105\u0142 czas). Zacznij od nowa.",
    uk: "\u0422\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0432 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F (\u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u043E \u0430\u0431\u043E \u043C\u0438\u043D\u0443\u0432 \u0447\u0430\u0441). \u041F\u043E\u0447\u043D\u0456\u0442\u044C \u0437\u043D\u043E\u0432\u0443.",
    "zh-cn": "\u7535\u89C6\u5DF2\u7ED3\u675F\u914D\u5BF9\uFF08\u5DF2\u53D6\u6D88\u6216\u8D85\u65F6\uFF09\u3002\u8BF7\u91CD\u65B0\u5F00\u59CB\u3002"
  },
  rejected: {
    en: "The TV rejected the pairing.",
    de: "Der TV hat die Kopplung abgelehnt.",
    ru: "\u0422\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440 \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435.",
    pt: "A TV recusou o emparelhamento.",
    nl: "De tv heeft het koppelen geweigerd.",
    fr: "Le t\xE9l\xE9viseur a refus\xE9 l\u2019appairage.",
    it: "La TV ha rifiutato l\u2019associazione.",
    es: "La TV rechaz\xF3 el emparejamiento.",
    pl: "Telewizor odrzuci\u0142 parowanie.",
    uk: "\u0422\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440 \u0432\u0456\u0434\u0445\u0438\u043B\u0438\u0432 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F.",
    "zh-cn": "\u7535\u89C6\u62D2\u7EDD\u4E86\u914D\u5BF9\u3002"
  },
  invalidPin: {
    en: "The code must have 6 characters (0-9, A-F).",
    de: "Der Code muss 6 Zeichen haben (0-9, A-F).",
    ru: "\u041A\u043E\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C 6 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 (0-9, A-F).",
    pt: "O c\xF3digo deve ter 6 caracteres (0-9, A-F).",
    nl: "De code moet 6 tekens hebben (0-9, A-F).",
    fr: "Le code doit comporter 6 caract\xE8res (0-9, A-F).",
    it: "Il codice deve avere 6 caratteri (0-9, A-F).",
    es: "El c\xF3digo debe tener 6 caracteres (0-9, A-F).",
    pl: "Kod musi mie\u0107 6 znak\xF3w (0-9, A-F).",
    uk: "\u041A\u043E\u0434 \u043C\u0430\u0454 \u043C\u0456\u0441\u0442\u0438\u0442\u0438 6 \u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432 (0-9, A-F).",
    "zh-cn": "\u4EE3\u7801\u5FC5\u987B\u4E3A 6 \u4E2A\u5B57\u7B26\uFF080-9\u3001A-F\uFF09\u3002"
  },
  wrongPin: {
    en: "The code does not match. Please check it and try again.",
    de: "Der Code passt nicht. Bitte pr\xFCfen und erneut eingeben.",
    ru: "\u041A\u043E\u0434 \u043D\u0435 \u043F\u043E\u0434\u0445\u043E\u0434\u0438\u0442. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0435\u0433\u043E \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435.",
    pt: "O c\xF3digo n\xE3o corresponde. Verifique-o e tente novamente.",
    nl: "De code klopt niet. Controleer hem en probeer het opnieuw.",
    fr: "Le code ne correspond pas. V\xE9rifiez-le et r\xE9essayez.",
    it: "Il codice non corrisponde. Controllalo e riprova.",
    es: "El c\xF3digo no coincide. Compru\xE9belo y vuelva a intentarlo.",
    pl: "Kod si\u0119 nie zgadza. Sprawd\u017A go i spr\xF3buj ponownie.",
    uk: "\u041A\u043E\u0434 \u043D\u0435 \u0437\u0431\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F. \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0442\u0435 \u0439\u043E\u0433\u043E \u0442\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u0456\u0442\u044C.",
    "zh-cn": "\u4EE3\u7801\u4E0D\u5339\u914D\u3002\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5\u3002"
  }
};
function toId(text, forbidden) {
  const umlauts = { \u00E4: "ae", \u00F6: "oe", \u00FC: "ue", \u00C4: "Ae", \u00D6: "Oe", \u00DC: "Ue", \u00DF: "ss" };
  return text.trim().replace(/[äöüÄÖÜß]/g, (c) => {
    var _a;
    return (_a = umlauts[c]) != null ? _a : c;
  }).replace(forbidden, "_").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}
function numberInRange(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
}
function modeOf(config) {
  return config.connection === "adb" || config.connection === "remote_adb" ? config.connection : "remote";
}
function isLink(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target.trim());
}
class Androidtv extends utils.Adapter {
  /** Adapter timers for the protocol classes; cleared automatically on unload. */
  adapterTimers = {
    setTimeout: (callback, ms) => this.setTimeout(callback, ms),
    clearTimeout: (handle) => this.clearTimeout(handle)
  };
  devices = /* @__PURE__ */ new Map();
  appsById = /* @__PURE__ */ new Map();
  pairings = /* @__PURE__ */ new Map();
  certificate;
  adbKey;
  uiLanguage = "en";
  /** All configured devices (also disabled ones) for the Device Manager */
  configured = [];
  /** Resolves the `ready` promise of the Device Manager bridge at the end of onReady */
  resolveReady = () => void 0;
  /** Device Manager (admin "Devices" view); registers its own message handler for `dm:*` commands */
  deviceManagement;
  constructor(options = {}) {
    super({
      ...options,
      name: "androidtv"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
    this.deviceManagement = new import_device_management.AndroidTvDeviceManagement(this, this.dmBridge());
  }
  async onReady() {
    var _a, _b, _c;
    await this.setState("info.connection", false, true);
    const sysConfig = await this.getForeignObjectAsync("system.config");
    const language = (_a = sysConfig == null ? void 0 : sysConfig.common) == null ? void 0 : _a.language;
    this.uiLanguage = language && language in MESSAGES.statusConnected ? language : "en";
    await this.ensureCertificate();
    const rawDevices = Array.isArray(this.config.devices) ? this.config.devices : [];
    const devices = rawDevices.filter((d) => d && typeof d.host === "string" && d.host.trim() !== "");
    const apps = (Array.isArray(this.config.apps) ? this.config.apps : []).filter(
      (a) => a && typeof a.name === "string" && a.name.trim() !== "" && typeof a.link === "string" && a.link.trim() !== ""
    );
    const appIdsLower = /* @__PURE__ */ new Set();
    for (const app of apps) {
      const id = toId(app.name, this.FORBIDDEN_CHARS);
      if (id && !appIdsLower.has(id.toLowerCase())) {
        appIdsLower.add(id.toLowerCase());
        this.appsById.set(id, app);
      }
    }
    if (devices.some((d) => d.enabled !== false && modeOf(d) !== "remote")) {
      await this.ensureAdbKey();
    }
    const usedIds = /* @__PURE__ */ new Set();
    const usedIdsLower = /* @__PURE__ */ new Set();
    for (const config of devices) {
      const base = toId(config.name || config.host, this.FORBIDDEN_CHARS) || toId(config.host, this.FORBIDDEN_CHARS);
      let id = base;
      for (let n = 2; usedIdsLower.has(id.toLowerCase()); n++) {
        id = `${base}_${n}`;
      }
      usedIds.add(id);
      usedIdsLower.add(id.toLowerCase());
      await this.createDeviceObjects(id, config);
      const entry = {
        id,
        index: rawDevices.indexOf(config),
        config,
        mode: modeOf(config),
        running: false
      };
      this.configured.push(entry);
      if (config.enabled === false) {
        continue;
      }
      const runtime = this.createRuntime(id, config);
      this.devices.set(id, runtime);
      entry.running = true;
      await this.refreshStatus(runtime);
    }
    await this.removeStaleObjects(usedIds, devices);
    if (!devices.length) {
      this.log.warn("No devices configured - add your TV in the instance settings.");
    }
    this.subscribeStates("*");
    for (const device of this.devices.values()) {
      (_b = device.remote) == null ? void 0 : _b.start();
      (_c = device.adb) == null ? void 0 : _c.start();
      this.scheduleOffline(device);
    }
    this.resolveReady();
  }
  // ------------------------------------------------------------------------------------------------------------
  // Keys and certificates (adapter file storage, private keys encrypted with the instance secret)
  // ------------------------------------------------------------------------------------------------------------
  /**
   * Loads the client certificate or creates and stores a new one.
   *
   * Storage: adapter file storage `<namespace>/client-certificate.json`, private key encrypted with the
   * instance secret. Older versions kept it in `native` – it is migrated once.
   */
  async ensureCertificate() {
    var _a;
    const stored = await this.readSecretFile(CERT_FILE);
    if (typeof (stored == null ? void 0 : stored.cert) === "string" && typeof stored.key === "string") {
      const candidate = { cert: stored.cert, key: this.decrypt(stored.key) };
      if ((0, import_certificate.isUsableCertificate)(candidate)) {
        this.certificate = candidate;
        return;
      }
      this.log.warn("Stored client certificate is invalid or expired - creating a new one (pairing required)");
    }
    const fromNative = { cert: this.config.clientCert, key: this.config.clientKey };
    if ((0, import_certificate.isUsableCertificate)(fromNative)) {
      this.log.info("Moving client certificate from instance configuration to file storage");
      this.certificate = fromNative;
    } else {
      this.log.info("Creating client certificate for pairing (one-time)");
      this.certificate = (0, import_certificate.generateClientCertificate)(((_a = this.config.clientName) == null ? void 0 : _a.trim()) || "ioBroker");
    }
    await this.writeSecretFile(CERT_FILE, { cert: this.certificate.cert, key: this.encrypt(this.certificate.key) });
  }
  /** Loads or creates the RSA key used for ADB authentication. */
  async ensureAdbKey() {
    const stored = await this.readSecretFile(ADB_KEY_FILE);
    if (typeof (stored == null ? void 0 : stored.key) === "string") {
      try {
        const privateKey = this.decrypt(stored.key);
        if (privateKey.includes("PRIVATE KEY")) {
          this.adbKey = { privateKey };
          return;
        }
      } catch (e) {
        this.log.warn(`Cannot read stored ADB key: ${e.message}`);
      }
    }
    this.log.info('Creating ADB key (one-time) - confirm "Allow debugging" on the TV at the first connection');
    this.adbKey = (0, import_auth.generateAdbKey)();
    await this.writeSecretFile(ADB_KEY_FILE, { key: this.encrypt(this.adbKey.privateKey) });
  }
  async readSecretFile(name) {
    try {
      if (!await this.fileExistsAsync(this.namespace, name)) {
        return void 0;
      }
      const file = await this.readFileAsync(this.namespace, name);
      const raw = typeof file.file === "string" ? file.file : file.file.toString("utf8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : void 0;
    } catch (e) {
      this.log.warn(`Cannot read ${name}: ${e.message}`);
      return void 0;
    }
  }
  async writeSecretFile(name, content) {
    await this.writeFileAsync(this.namespace, name, JSON.stringify(content));
  }
  // ------------------------------------------------------------------------------------------------------------
  // Device runtime
  // ------------------------------------------------------------------------------------------------------------
  createRuntime(id, config) {
    var _a;
    const mode = modeOf(config);
    const reconnectMax = numberInRange(this.config.reconnectMax, 5, 3600, DEFAULT_RECONNECT_MAX_S);
    const runtime = {
      id,
      config,
      mode,
      label: `${config.name || id} (${config.host})`,
      remoteConnected: false,
      adbConnected: false,
      adbAuthPending: false,
      pairingRequired: false,
      muted: void 0
    };
    if (mode !== "adb") {
      if (!this.certificate) {
        throw new Error("Certificate missing");
      }
      runtime.remote = new import_remote.RemoteConnection({
        timers: this.adapterTimers,
        host: config.host.trim(),
        certificate: this.certificate,
        enableIme: config.enableIme !== false,
        reconnectMaxMs: reconnectMax * 1e3
      });
      this.attachRemote(runtime, runtime.remote);
    }
    if (mode !== "remote") {
      if (!this.adbKey) {
        throw new Error("ADB key missing");
      }
      const pollS = numberInRange(this.config.adbPollInterval, 2, 300, DEFAULT_ADB_POLL_S);
      const port = numberInRange(config.adbPort, 1, 65535, import_client.DEFAULT_ADB_PORT);
      runtime.adb = new import_device.AdbDevice({
        timers: this.adapterTimers,
        host: config.host.trim(),
        port,
        key: this.adbKey,
        keyName: `ioBroker@${(_a = this.host) != null ? _a : "iobroker"}`,
        pollIntervalMs: pollS * 1e3,
        reconnectMaxMs: reconnectMax * 1e3,
        externalPower: () => {
          var _a2;
          return runtime.remoteConnected ? (_a2 = runtime.remote) == null ? void 0 : _a2.isOn : void 0;
        }
      });
      this.attachAdb(runtime, runtime.adb);
    }
    return runtime;
  }
  attachRemote(runtime, remote) {
    const { id, label } = runtime;
    remote.on("ready", (info, peerCert) => {
      var _a, _b, _c;
      runtime.remoteConnected = true;
      this.cancelOffline(runtime);
      runtime.pairingRequired = false;
      this.log.info(`${label}: connected`);
      void this.setDeviceStates(id, {
        "info.connected": true,
        "info.pairingRequired": false,
        "info.model": (_a = info.model) != null ? _a : null,
        "info.manufacturer": (_b = info.vendor) != null ? _b : null,
        "info.remoteServiceVersion": (_c = info.appVersion) != null ? _c : null
      });
      if (peerCert) {
        try {
          const { mac } = (0, import_certificate.parseTvIdentity)(peerCert);
          if (mac) {
            void this.setStateChangedAsync(`${id}.info.mac`, mac, true);
          }
        } catch (e) {
          this.log.debug(`${label}: cannot parse TV certificate: ${e.message}`);
        }
      }
      void this.updateConnectionState();
      void this.refreshStatus(runtime);
    });
    remote.on("disconnected", (reason) => {
      runtime.remoteConnected = false;
      this.scheduleOffline(runtime);
      this.log.debug(`${label}: disconnected (${reason}), reconnecting`);
      void this.setStateChangedAsync(`${id}.info.connected`, false, true);
      void this.updateConnectionState();
      void this.refreshStatus(runtime);
    });
    remote.on("unpaired", () => {
      runtime.remoteConnected = false;
      runtime.pairingRequired = true;
      this.log.warn(
        `${label}: the TV does not accept this ioBroker instance. Please pair it in the instance settings (tab "Devices").`
      );
      void this.setDeviceStates(id, { "info.connected": false, "info.pairingRequired": true });
      void this.updateConnectionState();
      void this.refreshStatus(runtime);
    });
    remote.on("power", (on) => {
      var _a;
      void this.setStateChangedAsync(`${id}.power`, on, true);
      if (on) {
        (_a = runtime.adb) == null ? void 0 : _a.pollSoon();
      } else if (runtime.adb) {
        void this.setMediaStates(id, null);
      }
    });
    remote.on("currentApp", (app) => {
      var _a;
      void this.setCurrentApp(id, app);
      (_a = runtime.adb) == null ? void 0 : _a.pollSoon();
    });
    remote.on("volume", (volume) => {
      runtime.muted = volume.muted;
      const known = volume.max > 0;
      void this.setDeviceStates(id, {
        volume: known ? volume.level : null,
        volumeMax: known ? volume.max : null,
        muted: volume.muted
      });
    });
    remote.on("log", (level, message) => this.log[level](message));
  }
  attachAdb(runtime, adb) {
    const { id, label } = runtime;
    const adbOnly = runtime.mode === "adb";
    adb.on("ready", (info) => {
      var _a;
      runtime.adbConnected = true;
      if (adbOnly) {
        this.cancelOffline(runtime);
      }
      runtime.adbAuthPending = false;
      this.log.info(`${label}: ADB connected${info.model ? ` (${info.model})` : ""}`);
      const values = {
        "info.adbConnected": true,
        "info.adbAuthorizationPending": false
      };
      if (adbOnly) {
        values["info.connected"] = true;
        values["info.model"] = (_a = info.model) != null ? _a : null;
        adb.getProp("ro.product.manufacturer").then((m) => this.setStateChangedAsync(`${id}.info.manufacturer`, m != null ? m : null, true)).catch((e) => this.log.debug(`${label}: cannot read manufacturer: ${e.message}`));
      }
      void this.setDeviceStates(id, values);
      void this.updateConnectionState();
      void this.refreshStatus(runtime);
      adb.findWakeSettings().then(
        (found) => this.log.debug(`${label}: wake settings: ${found.length ? found.join(" | ") : "none found"}`)
      ).catch(() => void 0);
      if (runtime.wakePendingUntil && Date.now() < runtime.wakePendingUntil) {
        runtime.wakePendingUntil = void 0;
        runtime.powerTarget = { value: true, until: Date.now() + 5e3 };
        adb.setPower(true).catch(
          (e) => this.log.debug(`${label}: switching on after Wake-on-LAN failed: ${e.message}`)
        );
      }
    });
    adb.on("authPending", () => {
      var _a;
      runtime.adbAuthPending = true;
      this.log.warn(
        `${label}: confirm "Allow debugging" on the TV and tick "Always allow from this computer" (key ioBroker@${(_a = this.host) != null ? _a : "iobroker"})`
      );
      void this.setStateChangedAsync(`${id}.info.adbAuthorizationPending`, true, true);
      void this.refreshStatus(runtime);
    });
    adb.on("disconnected", () => {
      runtime.adbConnected = false;
      if (adbOnly) {
        this.scheduleOffline(runtime);
      }
      this.log.debug(`${label}: ADB disconnected, reconnecting`);
      const values = { "info.adbConnected": false };
      if (adbOnly) {
        values["info.connected"] = false;
      }
      void this.setDeviceStates(id, values);
      void this.updateConnectionState();
      void this.refreshStatus(runtime);
    });
    adb.on("poll", (result) => void this.applyPoll(runtime, result));
    adb.on("log", (level, message) => this.log[level](message));
  }
  /**
   * Writes the result of an ADB poll to the states.
   *
   * @param runtime - Device
   * @param result - Parsed poll output
   */
  async applyPoll(runtime, result) {
    const { id } = runtime;
    if (runtime.mode === "adb") {
      const target = runtime.powerTarget;
      const contradicts = target !== void 0 && Date.now() < target.until && result.awake !== target.value;
      if (target && (!contradicts || Date.now() >= target.until)) {
        runtime.powerTarget = void 0;
      }
      if (result.awake !== void 0 && !contradicts) {
        await this.setStateChangedAsync(`${id}.power`, result.awake, true);
      }
      if (result.currentApp) {
        await this.setCurrentApp(id, result.currentApp);
      }
    }
    if (result.awake === false) {
      await this.setMediaStates(id, null);
    } else if (result.media !== void 0) {
      await this.setMediaStates(id, result.media);
    }
  }
  /**
   * Starts the grace timer after the primary connection was lost. Short interruptions (e.g. the TV closes the
   * connection after a rejected command and is back after 2 s) do not touch power/media.
   *
   * @param runtime - Device
   */
  scheduleOffline(runtime) {
    if (runtime.offlineTimer) {
      return;
    }
    runtime.offlineTimer = this.setTimeout(() => {
      runtime.offlineTimer = void 0;
      this.log.debug(`${runtime.label}: unreachable for ${OFFLINE_GRACE_MS / 1e3} s - treating as off`);
      void this.setStateChangedAsync(`${runtime.id}.power`, false, true);
      if (runtime.adb) {
        void this.setMediaStates(runtime.id, null);
      }
    }, OFFLINE_GRACE_MS);
  }
  cancelOffline(runtime) {
    if (runtime.offlineTimer) {
      this.clearTimeout(runtime.offlineTimer);
      runtime.offlineTimer = void 0;
    }
  }
  async setMediaStates(id, media) {
    var _a, _b, _c, _d, _e;
    await this.setDeviceStates(id, {
      "media.state": (_a = media == null ? void 0 : media.state) != null ? _a : "idle",
      "media.title": (_b = media == null ? void 0 : media.title) != null ? _b : null,
      "media.subtitle": (_c = media == null ? void 0 : media.subtitle) != null ? _c : null,
      "media.app": (_d = media == null ? void 0 : media.app) != null ? _d : null,
      "media.position": (_e = media == null ? void 0 : media.position) != null ? _e : null
    });
  }
  async setDeviceStates(id, values) {
    for (const [key, val] of Object.entries(values)) {
      await this.setStateChangedAsync(`${id}.${key}`, val, true);
    }
  }
  async updateConnectionState() {
    const anyConnected = [...this.devices.values()].some(
      (d) => d.mode === "adb" ? d.adbConnected : d.remoteConnected
    );
    await this.setStateChangedAsync("info.connection", anyConnected, true);
  }
  // ------------------------------------------------------------------------------------------------------------
  // Objects
  // ------------------------------------------------------------------------------------------------------------
  /**
   * State definitions that apply to a device in its connection mode.
   *
   * @param config - Device configuration
   */
  stateDefinitionsFor(config) {
    const mode = modeOf(config);
    const base = import_states.DEVICE_STATES.filter((d) => mode !== "adb" || !d.remoteOnly);
    return mode === "remote" ? base : [...base, ...import_states.ADB_STATES];
  }
  async createDeviceObjects(id, config) {
    const mode = modeOf(config);
    await this.extendObjectAsync(id, {
      type: "device",
      common: {
        name: config.name || config.host,
        statusStates: { onlineId: `${this.namespace}.${id}.info.connected` }
      },
      native: { host: config.host, connection: mode }
    });
    const channels = [
      [
        "info",
        {
          en: "Information",
          de: "Informationen",
          ru: "\u0418\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F",
          pt: "Informa\xE7\xE3o",
          nl: "Informatie",
          fr: "Informations",
          it: "Informazioni",
          es: "Informaci\xF3n",
          pl: "Informacje",
          uk: "\u0406\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u044F",
          "zh-cn": "\u4FE1\u606F"
        }
      ],
      [
        "keys",
        {
          en: "Remote keys",
          de: "Fernbedienungstasten",
          ru: "\u041A\u043D\u043E\u043F\u043A\u0438 \u043F\u0443\u043B\u044C\u0442\u0430",
          pt: "Teclas do comando",
          nl: "Afstandsbedieningstoetsen",
          fr: "Touches de la t\xE9l\xE9commande",
          it: "Tasti del telecomando",
          es: "Teclas del mando",
          pl: "Przyciski pilota",
          uk: "\u041A\u043D\u043E\u043F\u043A\u0438 \u043F\u0443\u043B\u044C\u0442\u0430",
          "zh-cn": "\u9065\u63A7\u6309\u952E"
        }
      ],
      [
        "apps",
        {
          en: "App favorites",
          de: "App-Favoriten",
          ru: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F",
          pt: "Aplicativos favoritos",
          nl: "App-favorieten",
          fr: "Applications favorites",
          it: "App preferite",
          es: "Aplicaciones favoritas",
          pl: "Ulubione aplikacje",
          uk: "\u0423\u043B\u044E\u0431\u043B\u0435\u043D\u0456 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043A\u0438",
          "zh-cn": "\u6536\u85CF\u7684\u5E94\u7528"
        }
      ]
    ];
    if (mode !== "remote") {
      channels.push([
        "media",
        {
          en: "Media (via ADB)",
          de: "Medien (\xFCber ADB)",
          ru: "\u041C\u0435\u0434\u0438\u0430 (\u0447\u0435\u0440\u0435\u0437 ADB)",
          pt: "Multim\xE9dia (via ADB)",
          nl: "Media (via ADB)",
          fr: "M\xE9dias (via ADB)",
          it: "Media (tramite ADB)",
          es: "Multimedia (v\xEDa ADB)",
          pl: "Multimedia (przez ADB)",
          uk: "\u041C\u0435\u0434\u0456\u0430 (\u0447\u0435\u0440\u0435\u0437 ADB)",
          "zh-cn": "\u5A92\u4F53\uFF08\u901A\u8FC7 ADB\uFF09"
        }
      ]);
    }
    for (const [channel, name] of channels) {
      await this.extendObjectAsync(`${id}.${channel}`, { type: "channel", common: { name }, native: {} });
    }
    for (const def of this.stateDefinitionsFor(config)) {
      await this.extendObjectAsync(`${id}.${def.id}`, { type: "state", common: def.common, native: {} });
    }
    for (const btn of import_states.KEY_BUTTONS) {
      await this.extendObjectAsync(`${id}.keys.${btn.id}`, {
        type: "state",
        common: { name: btn.name, type: "boolean", role: btn.role, read: false, write: true },
        native: { key: btn.key }
      });
    }
    for (const [appId, app] of this.appsById) {
      await this.extendObjectAsync(`${id}.apps.${appId}`, {
        type: "state",
        common: { name: app.name, type: "boolean", role: "button", read: false, write: true },
        native: { link: app.link }
      });
    }
  }
  /**
   * Deletes devices, states and channels that no longer apply (device removed, app removed, mode changed).
   *
   * @param deviceIds - Ids of all configured devices
   * @param configs - Device configurations (same order as ids were assigned)
   */
  async removeStaleObjects(deviceIds, configs) {
    const prefix = `${this.namespace}.`;
    const range = (start) => ({
      startkey: start,
      endkey: `${start}\u9999`
    });
    const devices = await this.getObjectViewAsync("system", "device", range(prefix));
    for (const row of devices.rows) {
      const id = row.id.slice(prefix.length);
      if (!deviceIds.has(id)) {
        this.log.info(`Removing objects of device "${id}" (no longer configured)`);
        await this.delObjectAsync(id, { recursive: true });
      }
    }
    const ids = [...deviceIds];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const config = configs[i];
      const expected = /* @__PURE__ */ new Set([
        ...this.stateDefinitionsFor(config).map((d) => d.id),
        ...import_states.KEY_BUTTONS.map((b) => `keys.${b.id}`),
        ...[...this.appsById.keys()].map((a) => `apps.${a}`)
      ]);
      const devPrefix = `${prefix}${id}.`;
      const states = await this.getObjectViewAsync("system", "state", range(devPrefix));
      for (const row of states.rows) {
        const rel = row.id.slice(devPrefix.length);
        if (!expected.has(rel)) {
          await this.delObjectAsync(row.id.slice(prefix.length));
        }
      }
      if (modeOf(config) === "remote") {
        const media = await this.getObjectAsync(`${id}.media`);
        if (media) {
          await this.delObjectAsync(`${id}.media`);
        }
      }
    }
  }
  // ------------------------------------------------------------------------------------------------------------
  // Commands
  // ------------------------------------------------------------------------------------------------------------
  onStateChange(fullId, state) {
    if (!state || state.ack) {
      return;
    }
    const parts = fullId.slice(this.namespace.length + 1).split(".");
    const device = this.devices.get(parts[0]);
    if (!device) {
      return;
    }
    const command = parts.slice(1).join(".");
    this.handleCommand(device, command, state).catch(
      (e) => this.log.warn(`${device.config.name || device.id}: command "${command}" failed: ${e.message}`)
    );
  }
  /**
   * Executes a user command (ack=false) on a device, using Remote v2 where possible and ADB otherwise.
   *
   * @param device - Target device
   * @param command - State id relative to the device
   * @param state - New state
   */
  async handleCommand(device, command, state) {
    var _a, _b, _c;
    const ack = () => void this.setState(`${device.id}.${command}`, { val: state.val, ack: true });
    if (command.startsWith("keys.")) {
      const btn = import_states.KEY_BUTTONS.find((b) => b.id === command.slice(5));
      if (btn) {
        await this.sendKey(device, btn.key);
        ack();
      }
      return;
    }
    if (command.startsWith("apps.")) {
      const app = this.appsById.get(command.slice(5));
      if (app) {
        await this.launch(device, app.link);
        ack();
      }
      return;
    }
    switch (command) {
      case "power":
        await this.setPower(device, !!state.val, ack);
        return;
      case "muted":
        if (device.muted === !!state.val) {
          ack();
        } else {
          await this.sendKey(device, "VOLUME_MUTE");
          if (!((_a = device.remote) == null ? void 0 : _a.isReady)) {
            ack();
          }
        }
        return;
      case "launchApp":
        if (typeof state.val === "string" && state.val.trim()) {
          await this.launch(device, state.val);
          ack();
        }
        return;
      case "sendKey": {
        const key = state.val === null || state.val === void 0 ? "" : String(state.val);
        if ((0, import_remote.resolveKeyCode)(key) === void 0) {
          throw new Error(`unknown key "${key}"`);
        }
        await this.sendKey(device, key);
        ack();
        return;
      }
      case "sendText":
        if (typeof state.val === "string" && state.val !== "") {
          if (((_b = device.remote) == null ? void 0 : _b.isReady) && device.config.enableIme !== false) {
            device.remote.sendText(state.val);
          } else if ((_c = device.adb) == null ? void 0 : _c.isReady) {
            await device.adb.sendText(state.val);
          } else {
            throw new Error("not connected");
          }
          ack();
        }
        return;
      default:
        this.log.debug(`Ignoring write to read-only or unknown state ${device.id}.${command}`);
    }
  }
  async sendKey(device, key) {
    var _a, _b, _c;
    if ((_a = device.remote) == null ? void 0 : _a.isReady) {
      device.remote.sendKey(key);
      (_b = device.adb) == null ? void 0 : _b.pollSoon();
    } else if ((_c = device.adb) == null ? void 0 : _c.isReady) {
      await device.adb.sendKey(key);
    } else {
      throw new Error("not connected");
    }
  }
  /**
   * Starts an app: https deep links preferably via Remote v2, package names preferably via ADB.
   *
   * @param device - Target device
   * @param target - Deep link or package name
   */
  async launch(device, target) {
    var _a, _b, _c, _d;
    const preferAdb = !isLink(target);
    if (preferAdb && ((_a = device.adb) == null ? void 0 : _a.isReady)) {
      await device.adb.launch(target);
    } else if ((_b = device.remote) == null ? void 0 : _b.isReady) {
      device.remote.launchApp(target);
      (_c = device.adb) == null ? void 0 : _c.pollSoon();
    } else if ((_d = device.adb) == null ? void 0 : _d.isReady) {
      await device.adb.launch(target);
    } else {
      throw new Error("not connected");
    }
  }
  /**
   * Switches the device on/off. Remote v2 only knows the POWER toggle, ADB has idempotent WAKEUP/SLEEP.
   * The ack is set by the state feedback of the device (remote_start or ADB poll).
   *
   * @param device - Target device
   * @param wanted - Desired state
   * @param ack - Acknowledges the command immediately
   */
  async setPower(device, wanted, ack) {
    var _a, _b;
    if ((_a = device.remote) == null ? void 0 : _a.isReady) {
      if (device.remote.isOn === wanted) {
        ack();
      } else {
        device.remote.sendKey("POWER");
      }
    } else if ((_b = device.adb) == null ? void 0 : _b.isReady) {
      device.powerTarget = { value: wanted, until: Date.now() + 5e3 };
      await device.adb.setPower(wanted);
    } else if (wanted) {
      await this.wakeOnLan(device);
    } else {
      throw new Error("not connected");
    }
  }
  /**
   * Wakes an unreachable device (deep standby without network) with a magic packet and reconnects right away.
   *
   * @param device - Device
   */
  async wakeOnLan(device) {
    var _a, _b, _c;
    const mac = (_a = device.config.wolMac) == null ? void 0 : _a.trim();
    if (!mac) {
      throw new Error(
        "not connected. To switch it on from deep standby, enter its MAC address in the instance settings (Wake-on-LAN)"
      );
    }
    const targets = (0, import_wol.wolTargets)(device.config.host.trim(), device.config.wolBroadcast);
    const sent = await (0, import_wol.sendWakeOnLan)(mac, targets);
    if (!sent) {
      throw new Error(`Wake-on-LAN could not be sent (${targets.join(", ")})`);
    }
    this.log.info(`${device.label}: not reachable, sent Wake-on-LAN to ${mac}`);
    device.wakePendingUntil = Date.now() + 9e4;
    (_b = device.remote) == null ? void 0 : _b.reconnectNow();
    (_c = device.adb) == null ? void 0 : _c.reconnectNow();
  }
  // ------------------------------------------------------------------------------------------------------------
  // Admin messages (pairing, status)
  // ------------------------------------------------------------------------------------------------------------
  /**
   * Writes the app in the foreground: package name and readable name.
   *
   * @param id - Device id
   * @param app - Android package name
   */
  async setCurrentApp(id, app) {
    await this.setStateChangedAsync(`${id}.currentApp`, app, true);
    await this.setStateChangedAsync(
      `${id}.currentAppName`,
      (0, import_app_names.appDisplayName)(app, this.appsById.values(), this.uiLanguage),
      true
    );
  }
  text(key) {
    return MESSAGES[key][this.uiLanguage];
  }
  reply(obj, payload) {
    if (obj.callback) {
      this.sendTo(obj.from, obj.command, payload, obj.callback);
    }
  }
  async onMessage(obj) {
    var _a;
    if (!obj || typeof obj !== "object") {
      return;
    }
    if (typeof obj.command === "string" && obj.command.startsWith("dm:")) {
      return;
    }
    const msg = (_a = obj.message) != null ? _a : {};
    const host = typeof msg.host === "string" ? msg.host.trim() : "";
    try {
      switch (obj.command) {
        case "startPairing":
          await this.startPairing(host);
          this.reply(obj, { result: this.text("pairingStarted") });
          break;
        case "finishPairing": {
          const configured = await this.finishPairing(host, typeof msg.pin === "string" ? msg.pin : "");
          this.reply(obj, { result: this.text(configured ? "pairingDone" : "pairingDoneSave") });
          break;
        }
        case "deviceStatus":
          this.reply(obj, this.deviceStatus(host, msg.enabled !== false));
          return;
        default:
          this.log.debug(`Unknown message command "${obj.command}"`);
      }
    } catch (e) {
      this.log.warn(`Pairing with ${host || "?"} failed: ${e.message}`);
      this.reply(obj, { error: this.errorText(e) });
    }
  }
  /**
   * Text (system language) for a pairing/command error.
   *
   * @param e - Thrown error
   */
  errorText(e) {
    const key = e instanceof import_pairing.PairingError ? e.code : e instanceof Error && e.message in MESSAGES ? e.message : "closed";
    return this.text(key);
  }
  /**
   * Access of the Device Manager to the device logic.
   */
  dmBridge() {
    return {
      ready: new Promise((resolve) => this.resolveReady = resolve),
      devices: () => this.configured,
      statusText: (id) => {
        const device = this.devices.get(id);
        return device ? this.statusOf(device).text : void 0;
      },
      startPairing: (host) => this.startPairing(host),
      finishPairing: async (host, pin) => {
        const configured = await this.finishPairing(host, pin);
        return this.text(configured ? "pairingDone" : "pairingDoneSave");
      },
      cancelPairing: (host) => this.dropPairing(host),
      isRetryablePairingError: (e) => e instanceof import_pairing.PairingError && (e.code === "wrongPin" || e.code === "invalidPin"),
      errorText: (e) => {
        var _a;
        this.log.warn(`Device manager: ${(_a = e == null ? void 0 : e.message) != null ? _a : String(e)}`);
        return this.errorText(e);
      },
      reconnect: (id) => {
        var _a, _b;
        const device = this.devices.get(id);
        if (!device) {
          return false;
        }
        (_a = device.remote) == null ? void 0 : _a.restart();
        (_b = device.adb) == null ? void 0 : _b.reconnectNow();
        return true;
      },
      rawDevices: () => Array.isArray(this.config.devices) ? this.config.devices.map((d) => ({ ...d })) : [],
      saveDevices: (devices) => {
        this.log.info("Device list changed in the device manager - restarting instance");
        this.setTimeout(() => {
          this.updateConfig({ devices }).catch(
            (e) => this.log.error(`Cannot save device list: ${e.message}`)
          );
        }, 500);
      }
    };
  }
  /**
   * Status line for one device in the admin UI (`textSendTo`).
   *
   * @param host - Host as currently entered in the form (may be unsaved)
   * @param enabled - Checkbox value in the form
   */
  deviceStatus(host, enabled) {
    const grey = { color: "#888888" };
    if (!host) {
      return { text: this.text("statusNoHost"), icon: "connection", style: grey };
    }
    if (!enabled) {
      return { text: this.text("statusDisabled"), icon: "no-connection", style: grey };
    }
    const device = [...this.devices.values()].find((d) => d.config.host.trim() === host);
    if (!device) {
      return { text: this.text("statusUnsaved"), icon: "pair", style: grey };
    }
    return this.statusOf(device);
  }
  /**
   * Current status of a running device (admin status line and state `info.status`).
   *
   * @param device - Device runtime
   */
  statusOf(device) {
    const green = { color: "#2e7d32" };
    const orange = { color: "#ed6c02" };
    const red = { color: "#d32f2f" };
    const adbPart = () => device.adbConnected ? { key: "statusAdbOk", style: green } : device.adbAuthPending ? { key: "statusAdbPending", style: orange } : { key: device.mode === "adb" ? "statusAdbOffline" : "statusInfoOffline", style: red };
    if (device.mode === "adb") {
      const a = adbPart();
      return {
        text: this.text(a.key === "statusAdbOk" ? "statusConnected" : a.key),
        icon: device.adbConnected ? "connection" : "no-connection",
        style: a.style
      };
    }
    let main;
    if (device.remoteConnected) {
      main = { text: this.text("statusConnected"), icon: "connection", style: green };
    } else if (device.pairingRequired) {
      main = { text: this.text("statusPairing"), icon: "pair", style: orange };
    } else {
      main = { text: this.text("statusOffline"), icon: "no-connection", style: red };
    }
    if (device.mode === "remote_adb") {
      const a = adbPart();
      main.text = `${main.text} \xB7 ${this.text(a.key)}`;
      if (main.style === green && a.style !== green) {
        main.style = a.style;
      }
    }
    return main;
  }
  /**
   * Writes the human readable status to `<device>.info.status` (shown live in the admin UI).
   *
   * @param device - Device runtime
   */
  async refreshStatus(device) {
    await this.setStateChangedAsync(`${device.id}.info.status`, this.statusOf(device).text, true);
  }
  async startPairing(host) {
    var _a;
    if (!host) {
      throw new Error("noHost");
    }
    if (!this.certificate) {
      throw new Error("noCertificate");
    }
    this.dropPairing(host);
    const session = new import_pairing.PairingSession({
      timers: this.adapterTimers,
      host,
      clientName: ((_a = this.config.clientName) == null ? void 0 : _a.trim()) || "ioBroker",
      certificate: this.certificate
    });
    const pending = { session, timer: void 0 };
    this.pairings.set(host, pending);
    try {
      await session.start();
    } catch (e) {
      this.dropPairing(host);
      throw e;
    }
    pending.timer = this.setTimeout(() => this.dropPairing(host), PAIRING_SESSION_TTL_MS);
  }
  /**
   * Completes pairing and reconnects matching devices.
   *
   * @param host - TV address
   * @param pin - Code shown on the TV
   * @returns true if a running device uses this host
   */
  async finishPairing(host, pin) {
    if (!host) {
      throw new Error("noHost");
    }
    const pending = this.pairings.get(host);
    if (!(pending == null ? void 0 : pending.session.isOpen)) {
      this.dropPairing(host);
      throw new Error("noSession");
    }
    try {
      await pending.session.finish(pin);
    } catch (e) {
      if (!(e instanceof import_pairing.PairingError && (e.code === "wrongPin" || e.code === "invalidPin"))) {
        this.dropPairing(host);
      }
      throw e;
    }
    this.dropPairing(host);
    this.log.info(`Pairing with ${host} successful`);
    let configured = false;
    for (const device of this.devices.values()) {
      if (device.config.host.trim() === host && device.remote) {
        configured = true;
        device.pairingRequired = false;
        await this.setStateChangedAsync(`${device.id}.info.pairingRequired`, false, true);
        device.remote.restart();
      }
    }
    return configured;
  }
  dropPairing(host) {
    const pending = this.pairings.get(host);
    if (pending) {
      this.clearTimeout(pending.timer);
      pending.session.close();
      this.pairings.delete(host);
    }
  }
  onUnload(callback) {
    var _a, _b, _c, _d;
    try {
      for (const host of [...this.pairings.keys()]) {
        this.dropPairing(host);
      }
      for (const device of this.devices.values()) {
        (_a = device.remote) == null ? void 0 : _a.stop();
        (_b = device.remote) == null ? void 0 : _b.removeAllListeners();
        (_c = device.adb) == null ? void 0 : _c.stop();
        (_d = device.adb) == null ? void 0 : _d.removeAllListeners();
      }
      this.devices.clear();
      callback();
    } catch (error) {
      this.log.error(`Error during unloading: ${error.message}`);
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Androidtv(options);
} else {
  (() => new Androidtv())();
}
//# sourceMappingURL=main.js.map
