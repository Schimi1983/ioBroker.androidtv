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
var states_exports = {};
__export(states_exports, {
  ADB_STATES: () => ADB_STATES,
  DEVICE_STATES: () => DEVICE_STATES,
  KEY_BUTTONS: () => KEY_BUTTONS
});
module.exports = __toCommonJS(states_exports);
const KEY_BUTTONS = [
  {
    id: "home",
    key: "HOME",
    role: "button",
    name: {
      en: "Home",
      de: "Home",
      ru: "\u0414\u043E\u043C\u043E\u0439",
      pt: "In\xEDcio",
      nl: "Home",
      fr: "Accueil",
      it: "Home",
      es: "Inicio",
      pl: "Ekran g\u0142\xF3wny",
      uk: "\u0414\u043E\u0434\u043E\u043C\u0443",
      "zh-cn": "\u4E3B\u9875"
    }
  },
  {
    id: "back",
    key: "BACK",
    role: "button",
    name: {
      en: "Back",
      de: "Zur\xFCck",
      ru: "\u041D\u0430\u0437\u0430\u0434",
      pt: "Voltar",
      nl: "Terug",
      fr: "Retour",
      it: "Indietro",
      es: "Atr\xE1s",
      pl: "Wstecz",
      uk: "\u041D\u0430\u0437\u0430\u0434",
      "zh-cn": "\u8FD4\u56DE"
    }
  },
  {
    id: "menu",
    key: "MENU",
    role: "button",
    name: {
      en: "Menu",
      de: "Men\xFC",
      ru: "\u041C\u0435\u043D\u044E",
      pt: "Menu",
      nl: "Menu",
      fr: "Menu",
      it: "Menu",
      es: "Men\xFA",
      pl: "Menu",
      uk: "\u041C\u0435\u043D\u044E",
      "zh-cn": "\u83DC\u5355"
    }
  },
  {
    id: "settings",
    key: "SETTINGS",
    role: "button",
    name: {
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
    }
  },
  {
    id: "up",
    key: "DPAD_UP",
    role: "button",
    name: {
      en: "Up",
      de: "Hoch",
      ru: "\u0412\u0432\u0435\u0440\u0445",
      pt: "Cima",
      nl: "Omhoog",
      fr: "Haut",
      it: "Su",
      es: "Arriba",
      pl: "W g\xF3r\u0119",
      uk: "\u0423\u0433\u043E\u0440\u0443",
      "zh-cn": "\u4E0A"
    }
  },
  {
    id: "down",
    key: "DPAD_DOWN",
    role: "button",
    name: {
      en: "Down",
      de: "Runter",
      ru: "\u0412\u043D\u0438\u0437",
      pt: "Baixo",
      nl: "Omlaag",
      fr: "Bas",
      it: "Gi\xF9",
      es: "Abajo",
      pl: "W d\xF3\u0142",
      uk: "\u0423\u043D\u0438\u0437",
      "zh-cn": "\u4E0B"
    }
  },
  {
    id: "left",
    key: "DPAD_LEFT",
    role: "button",
    name: {
      en: "Left",
      de: "Links",
      ru: "\u0412\u043B\u0435\u0432\u043E",
      pt: "Esquerda",
      nl: "Links",
      fr: "Gauche",
      it: "Sinistra",
      es: "Izquierda",
      pl: "W lewo",
      uk: "\u041B\u0456\u0432\u043E\u0440\u0443\u0447",
      "zh-cn": "\u5DE6"
    }
  },
  {
    id: "right",
    key: "DPAD_RIGHT",
    role: "button",
    name: {
      en: "Right",
      de: "Rechts",
      ru: "\u0412\u043F\u0440\u0430\u0432\u043E",
      pt: "Direita",
      nl: "Rechts",
      fr: "Droite",
      it: "Destra",
      es: "Derecha",
      pl: "W prawo",
      uk: "\u041F\u0440\u0430\u0432\u043E\u0440\u0443\u0447",
      "zh-cn": "\u53F3"
    }
  },
  {
    id: "ok",
    key: "DPAD_CENTER",
    role: "button",
    name: {
      en: "OK",
      de: "OK",
      ru: "OK",
      pt: "OK",
      nl: "OK",
      fr: "OK",
      it: "OK",
      es: "OK",
      pl: "OK",
      uk: "OK",
      "zh-cn": "\u786E\u5B9A"
    }
  },
  {
    id: "playPause",
    key: "MEDIA_PLAY_PAUSE",
    role: "button",
    name: {
      en: "Play/Pause",
      de: "Play/Pause",
      ru: "\u0412\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435/\u043F\u0430\u0443\u0437\u0430",
      pt: "Reproduzir/pausa",
      nl: "Afspelen/pauze",
      fr: "Lecture/pause",
      it: "Riproduci/pausa",
      es: "Reproducir/pausa",
      pl: "Odtw\xF3rz/pauza",
      uk: "\u0412\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F/\u043F\u0430\u0443\u0437\u0430",
      "zh-cn": "\u64AD\u653E/\u6682\u505C"
    }
  },
  {
    id: "play",
    key: "MEDIA_PLAY",
    role: "button.play",
    name: {
      en: "Play",
      de: "Wiedergabe",
      ru: "\u0412\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435",
      pt: "Reproduzir",
      nl: "Afspelen",
      fr: "Lecture",
      it: "Riproduci",
      es: "Reproducir",
      pl: "Odtw\xF3rz",
      uk: "\u0412\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F",
      "zh-cn": "\u64AD\u653E"
    }
  },
  {
    id: "pause",
    key: "MEDIA_PAUSE",
    role: "button.pause",
    name: {
      en: "Pause",
      de: "Pause",
      ru: "\u041F\u0430\u0443\u0437\u0430",
      pt: "Pausa",
      nl: "Pauze",
      fr: "Pause",
      it: "Pausa",
      es: "Pausa",
      pl: "Pauza",
      uk: "\u041F\u0430\u0443\u0437\u0430",
      "zh-cn": "\u6682\u505C"
    }
  },
  {
    id: "stop",
    key: "MEDIA_STOP",
    role: "button.stop",
    name: {
      en: "Stop",
      de: "Stopp",
      ru: "\u0421\u0442\u043E\u043F",
      pt: "Parar",
      nl: "Stop",
      fr: "Arr\xEAt",
      it: "Stop",
      es: "Detener",
      pl: "Stop",
      uk: "\u0421\u0442\u043E\u043F",
      "zh-cn": "\u505C\u6B62"
    }
  },
  {
    id: "next",
    key: "MEDIA_NEXT",
    role: "button.next",
    name: {
      en: "Next",
      de: "Weiter",
      ru: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439",
      pt: "Seguinte",
      nl: "Volgende",
      fr: "Suivant",
      it: "Successivo",
      es: "Siguiente",
      pl: "Nast\u0119pny",
      uk: "\u041D\u0430\u0441\u0442\u0443\u043F\u043D\u0438\u0439",
      "zh-cn": "\u4E0B\u4E00\u4E2A"
    }
  },
  {
    id: "previous",
    key: "MEDIA_PREVIOUS",
    role: "button.prev",
    name: {
      en: "Previous",
      de: "Zur\xFCck (Titel)",
      ru: "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439",
      pt: "Anterior",
      nl: "Vorige",
      fr: "Pr\xE9c\xE9dent",
      it: "Precedente",
      es: "Anterior",
      pl: "Poprzedni",
      uk: "\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0439",
      "zh-cn": "\u4E0A\u4E00\u4E2A"
    }
  },
  {
    id: "fastForward",
    key: "MEDIA_FAST_FORWARD",
    role: "button.fastforward",
    name: {
      en: "Fast forward",
      de: "Vorspulen",
      ru: "\u041F\u0435\u0440\u0435\u043C\u043E\u0442\u043A\u0430 \u0432\u043F\u0435\u0440\u0451\u0434",
      pt: "Avan\xE7ar r\xE1pido",
      nl: "Vooruitspoelen",
      fr: "Avance rapide",
      it: "Avanti veloce",
      es: "Avance r\xE1pido",
      pl: "Przewi\u0144 do przodu",
      uk: "\u041F\u0435\u0440\u0435\u043C\u043E\u0442\u043A\u0430 \u0432\u043F\u0435\u0440\u0435\u0434",
      "zh-cn": "\u5FEB\u8FDB"
    }
  },
  {
    id: "rewind",
    key: "MEDIA_REWIND",
    role: "button.fastreverse",
    name: {
      en: "Rewind",
      de: "Zur\xFCckspulen",
      ru: "\u041F\u0435\u0440\u0435\u043C\u043E\u0442\u043A\u0430 \u043D\u0430\u0437\u0430\u0434",
      pt: "Retroceder",
      nl: "Terugspoelen",
      fr: "Retour rapide",
      it: "Riavvolgi",
      es: "Rebobinar",
      pl: "Przewi\u0144 do ty\u0142u",
      uk: "\u041F\u0435\u0440\u0435\u043C\u043E\u0442\u043A\u0430 \u043D\u0430\u0437\u0430\u0434",
      "zh-cn": "\u5FEB\u9000"
    }
  },
  {
    id: "volumeUp",
    key: "VOLUME_UP",
    role: "button.volume.up",
    name: {
      en: "Volume up",
      de: "Lauter",
      ru: "\u0413\u0440\u043E\u043C\u0447\u0435",
      pt: "Aumentar volume",
      nl: "Volume omhoog",
      fr: "Augmenter le volume",
      it: "Volume su",
      es: "Subir volumen",
      pl: "G\u0142o\u015Bniej",
      uk: "\u0413\u0443\u0447\u043D\u0456\u0448\u0435",
      "zh-cn": "\u97F3\u91CF\u52A0"
    }
  },
  {
    id: "volumeDown",
    key: "VOLUME_DOWN",
    role: "button.volume.down",
    name: {
      en: "Volume down",
      de: "Leiser",
      ru: "\u0422\u0438\u0448\u0435",
      pt: "Diminuir volume",
      nl: "Volume omlaag",
      fr: "Baisser le volume",
      it: "Volume gi\xF9",
      es: "Bajar volumen",
      pl: "Ciszej",
      uk: "\u0422\u0438\u0445\u0456\u0448\u0435",
      "zh-cn": "\u97F3\u91CF\u51CF"
    }
  },
  {
    id: "channelUp",
    key: "CHANNEL_UP",
    role: "button",
    name: {
      en: "Channel up",
      de: "Kanal hoch",
      ru: "\u041A\u0430\u043D\u0430\u043B \u0432\u0432\u0435\u0440\u0445",
      pt: "Canal acima",
      nl: "Kanaal omhoog",
      fr: "Cha\xEEne suivante",
      it: "Canale su",
      es: "Canal arriba",
      pl: "Kana\u0142 w g\xF3r\u0119",
      uk: "\u041A\u0430\u043D\u0430\u043B \u0443\u0433\u043E\u0440\u0443",
      "zh-cn": "\u9891\u9053\u52A0"
    }
  },
  {
    id: "channelDown",
    key: "CHANNEL_DOWN",
    role: "button",
    name: {
      en: "Channel down",
      de: "Kanal runter",
      ru: "\u041A\u0430\u043D\u0430\u043B \u0432\u043D\u0438\u0437",
      pt: "Canal abaixo",
      nl: "Kanaal omlaag",
      fr: "Cha\xEEne pr\xE9c\xE9dente",
      it: "Canale gi\xF9",
      es: "Canal abajo",
      pl: "Kana\u0142 w d\xF3\u0142",
      uk: "\u041A\u0430\u043D\u0430\u043B \u0443\u043D\u0438\u0437",
      "zh-cn": "\u9891\u9053\u51CF"
    }
  },
  {
    id: "search",
    key: "SEARCH",
    role: "button",
    name: {
      en: "Search",
      de: "Suche",
      ru: "\u041F\u043E\u0438\u0441\u043A",
      pt: "Pesquisar",
      nl: "Zoeken",
      fr: "Recherche",
      it: "Cerca",
      es: "Buscar",
      pl: "Szukaj",
      uk: "\u041F\u043E\u0448\u0443\u043A",
      "zh-cn": "\u641C\u7D22"
    }
  },
  {
    id: "info",
    key: "INFO",
    role: "button",
    name: {
      en: "Info",
      de: "Info",
      ru: "\u0418\u043D\u0444\u043E",
      pt: "Info",
      nl: "Info",
      fr: "Info",
      it: "Info",
      es: "Info",
      pl: "Info",
      uk: "\u0406\u043D\u0444\u043E",
      "zh-cn": "\u4FE1\u606F"
    }
  }
];
const DEVICE_STATES = [
  {
    id: "info.status",
    common: {
      name: {
        en: "Connection status (text)",
        de: "Verbindungsstatus (Text)",
        ru: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F (\u0442\u0435\u043A\u0441\u0442)",
        pt: "Estado da liga\xE7\xE3o (texto)",
        nl: "Verbindingsstatus (tekst)",
        fr: "\xC9tat de la connexion (texte)",
        it: "Stato della connessione (testo)",
        es: "Estado de la conexi\xF3n (texto)",
        pl: "Stan po\u0142\u0105czenia (tekst)",
        uk: "\u0421\u0442\u0430\u043D \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F (\u0442\u0435\u043A\u0441\u0442)",
        "zh-cn": "\u8FDE\u63A5\u72B6\u6001\uFF08\u6587\u672C\uFF09"
      },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "info.connected",
    common: {
      name: {
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
      type: "boolean",
      role: "indicator.connected",
      read: true,
      write: false,
      def: false
    }
  },
  {
    id: "info.pairingRequired",
    remoteOnly: true,
    common: {
      name: {
        en: "Pairing required",
        de: "Kopplung erforderlich",
        ru: "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0441\u043E\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435",
        pt: "Emparelhamento necess\xE1rio",
        nl: "Koppelen vereist",
        fr: "Appairage requis",
        it: "Associazione necessaria",
        es: "Emparejamiento necesario",
        pl: "Wymagane parowanie",
        uk: "\u041F\u043E\u0442\u0440\u0456\u0431\u043D\u0435 \u0441\u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044F",
        "zh-cn": "\u9700\u8981\u914D\u5BF9"
      },
      type: "boolean",
      role: "indicator.maintenance",
      read: true,
      write: false,
      def: false
    }
  },
  {
    id: "info.model",
    common: {
      name: {
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
      type: "string",
      role: "info.model",
      read: true,
      write: false
    }
  },
  {
    id: "info.manufacturer",
    common: {
      name: {
        en: "Manufacturer",
        de: "Hersteller",
        ru: "\u041F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C",
        pt: "Fabricante",
        nl: "Fabrikant",
        fr: "Fabricant",
        it: "Produttore",
        es: "Fabricante",
        pl: "Producent",
        uk: "\u0412\u0438\u0440\u043E\u0431\u043D\u0438\u043A",
        "zh-cn": "\u5236\u9020\u5546"
      },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "info.remoteServiceVersion",
    remoteOnly: true,
    common: {
      name: {
        en: "Remote service version",
        de: "Version Remote-Dienst",
        ru: "\u0412\u0435\u0440\u0441\u0438\u044F \u0441\u043B\u0443\u0436\u0431\u044B \u043F\u0443\u043B\u044C\u0442\u0430",
        pt: "Vers\xE3o do servi\xE7o remoto",
        nl: "Versie afstandsbedieningsdienst",
        fr: "Version du service de t\xE9l\xE9commande",
        it: "Versione del servizio telecomando",
        es: "Versi\xF3n del servicio remoto",
        pl: "Wersja us\u0142ugi pilota",
        uk: "\u0412\u0435\u0440\u0441\u0456\u044F \u0441\u043B\u0443\u0436\u0431\u0438 \u043F\u0443\u043B\u044C\u0442\u0430",
        "zh-cn": "\u9065\u63A7\u670D\u52A1\u7248\u672C"
      },
      type: "string",
      role: "info.firmware",
      read: true,
      write: false
    }
  },
  {
    id: "info.mac",
    remoteOnly: true,
    common: {
      name: {
        en: "MAC address",
        de: "MAC-Adresse",
        ru: "MAC-\u0430\u0434\u0440\u0435\u0441",
        pt: "Endere\xE7o MAC",
        nl: "MAC-adres",
        fr: "Adresse MAC",
        it: "Indirizzo MAC",
        es: "Direcci\xF3n MAC",
        pl: "Adres MAC",
        uk: "MAC-\u0430\u0434\u0440\u0435\u0441\u0430",
        "zh-cn": "MAC \u5730\u5740"
      },
      type: "string",
      role: "info.mac",
      read: true,
      write: false
    }
  },
  {
    id: "power",
    common: {
      name: {
        en: "Power (screen on)",
        de: "Eingeschaltet (Bildschirm an)",
        ru: "\u041F\u0438\u0442\u0430\u043D\u0438\u0435 (\u044D\u043A\u0440\u0430\u043D \u0432\u043A\u043B\u044E\u0447\u0451\u043D)",
        pt: "Ligado (ecr\xE3 ligado)",
        nl: "Aan (scherm aan)",
        fr: "Alimentation (\xE9cran allum\xE9)",
        it: "Acceso (schermo acceso)",
        es: "Encendido (pantalla encendida)",
        pl: "Zasilanie (ekran w\u0142\u0105czony)",
        uk: "\u0416\u0438\u0432\u043B\u0435\u043D\u043D\u044F (\u0435\u043A\u0440\u0430\u043D \u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E)",
        "zh-cn": "\u7535\u6E90\uFF08\u5C4F\u5E55\u5F00\u542F\uFF09"
      },
      type: "boolean",
      role: "switch.power",
      read: true,
      write: true
    }
  },
  {
    id: "currentApp",
    common: {
      name: {
        en: "Current app (package)",
        de: "Aktuelle App (Paket)",
        ru: "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 (\u043F\u0430\u043A\u0435\u0442)",
        pt: "App atual (pacote)",
        nl: "Huidige app (pakket)",
        fr: "Application actuelle (paquet)",
        it: "App attuale (pacchetto)",
        es: "Aplicaci\xF3n actual (paquete)",
        pl: "Bie\u017C\u0105ca aplikacja (pakiet)",
        uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A (\u043F\u0430\u043A\u0435\u0442)",
        "zh-cn": "\u5F53\u524D\u5E94\u7528\uFF08\u5305\u540D\uFF09"
      },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "currentAppName",
    common: {
      name: {
        en: "Current app",
        de: "Aktuelle App",
        ru: "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
        pt: "App atual",
        nl: "Huidige app",
        fr: "Application actuelle",
        it: "App attuale",
        es: "Aplicaci\xF3n actual",
        pl: "Bie\u017C\u0105ca aplikacja",
        uk: "\u041F\u043E\u0442\u043E\u0447\u043D\u0438\u0439 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A",
        "zh-cn": "\u5F53\u524D\u5E94\u7528"
      },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "volume",
    remoteOnly: true,
    common: {
      name: {
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
      type: "number",
      role: "value.volume",
      read: true,
      write: false,
      min: 0
    }
  },
  {
    id: "volumeMax",
    remoteOnly: true,
    common: {
      name: {
        en: "Maximum volume",
        de: "Maximale Lautst\xE4rke",
        ru: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0433\u0440\u043E\u043C\u043A\u043E\u0441\u0442\u044C",
        pt: "Volume m\xE1ximo",
        nl: "Maximaal volume",
        fr: "Volume maximal",
        it: "Volume massimo",
        es: "Volumen m\xE1ximo",
        pl: "Maksymalna g\u0142o\u015Bno\u015B\u0107",
        uk: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u0430 \u0433\u0443\u0447\u043D\u0456\u0441\u0442\u044C",
        "zh-cn": "\u6700\u5927\u97F3\u91CF"
      },
      type: "number",
      role: "value",
      read: true,
      write: false
    }
  },
  {
    id: "muted",
    remoteOnly: true,
    common: {
      name: {
        en: "Muted",
        de: "Stumm",
        ru: "\u0411\u0435\u0437 \u0437\u0432\u0443\u043A\u0430",
        pt: "Sem som",
        nl: "Gedempt",
        fr: "Muet",
        it: "Muto",
        es: "Silenciado",
        pl: "Wyciszony",
        uk: "\u0411\u0435\u0437 \u0437\u0432\u0443\u043A\u0443",
        "zh-cn": "\u9759\u97F3"
      },
      type: "boolean",
      role: "media.mute",
      read: true,
      write: true
    }
  },
  {
    id: "launchApp",
    common: {
      name: {
        en: "Launch app (deep link or package)",
        de: "App starten (Deep Link oder Paket)",
        ru: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 (\u0441\u0441\u044B\u043B\u043A\u0430 \u0438\u043B\u0438 \u043F\u0430\u043A\u0435\u0442)",
        pt: "Abrir app (link direto ou pacote)",
        nl: "App starten (deeplink of pakket)",
        fr: "Lancer une application (lien profond ou paquet)",
        it: "Avvia app (deep link o pacchetto)",
        es: "Abrir aplicaci\xF3n (enlace profundo o paquete)",
        pl: "Uruchom aplikacj\u0119 (link lub pakiet)",
        uk: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u0437\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A (\u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u0430\u0431\u043E \u043F\u0430\u043A\u0435\u0442)",
        "zh-cn": "\u542F\u52A8\u5E94\u7528\uFF08\u6DF1\u5C42\u94FE\u63A5\u6216\u5305\u540D\uFF09"
      },
      type: "string",
      role: "text",
      read: true,
      write: true,
      def: ""
    }
  },
  {
    id: "sendKey",
    common: {
      name: {
        en: "Send key (e.g. HOME, DPAD_UP or code)",
        de: "Taste senden (z. B. HOME, DPAD_UP oder Code)",
        ru: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043A\u043B\u0430\u0432\u0438\u0448\u0443 (\u043D\u0430\u043F\u0440. HOME, DPAD_UP \u0438\u043B\u0438 \u043A\u043E\u0434)",
        pt: "Enviar tecla (ex. HOME, DPAD_UP ou c\xF3digo)",
        nl: "Toets verzenden (bijv. HOME, DPAD_UP of code)",
        fr: "Envoyer une touche (ex. HOME, DPAD_UP ou code)",
        it: "Invia tasto (es. HOME, DPAD_UP o codice)",
        es: "Enviar tecla (p. ej. HOME, DPAD_UP o c\xF3digo)",
        pl: "Wy\u015Blij klawisz (np. HOME, DPAD_UP lub kod)",
        uk: "\u041D\u0430\u0434\u0456\u0441\u043B\u0430\u0442\u0438 \u043A\u043B\u0430\u0432\u0456\u0448\u0443 (\u043D\u0430\u043F\u0440. HOME, DPAD_UP \u0430\u0431\u043E \u043A\u043E\u0434)",
        "zh-cn": "\u53D1\u9001\u6309\u952E\uFF08\u5982 HOME\u3001DPAD_UP \u6216\u952E\u7801\uFF09"
      },
      type: "string",
      role: "text",
      read: true,
      write: true,
      def: ""
    }
  },
  {
    id: "sendText",
    common: {
      name: {
        en: "Send text to input field",
        de: "Text in Eingabefeld senden",
        ru: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0442\u0435\u043A\u0441\u0442 \u0432 \u043F\u043E\u043B\u0435 \u0432\u0432\u043E\u0434\u0430",
        pt: "Enviar texto para o campo de entrada",
        nl: "Tekst naar invoerveld sturen",
        fr: "Envoyer du texte dans le champ de saisie",
        it: "Invia testo al campo di input",
        es: "Enviar texto al campo de entrada",
        pl: "Wy\u015Blij tekst do pola wprowadzania",
        uk: "\u041D\u0430\u0434\u0456\u0441\u043B\u0430\u0442\u0438 \u0442\u0435\u043A\u0441\u0442 \u0443 \u043F\u043E\u043B\u0435 \u0432\u0432\u0435\u0434\u0435\u043D\u043D\u044F",
        "zh-cn": "\u5411\u8F93\u5165\u6846\u53D1\u9001\u6587\u672C"
      },
      type: "string",
      role: "text",
      read: true,
      write: true,
      def: ""
    }
  }
];
const ADB_STATES = [
  {
    id: "info.adbConnected",
    common: {
      name: {
        en: "ADB connected",
        de: "ADB verbunden",
        ru: "ADB \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D",
        pt: "ADB conectado",
        nl: "ADB verbonden",
        fr: "ADB connect\xE9",
        it: "ADB connesso",
        es: "ADB conectado",
        pl: "ADB po\u0142\u0105czone",
        uk: "ADB \u043F\u0456\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
        "zh-cn": "ADB \u5DF2\u8FDE\u63A5"
      },
      type: "boolean",
      role: "indicator.connected",
      read: true,
      write: false,
      def: false
    }
  },
  {
    id: "info.adbAuthorizationPending",
    common: {
      name: {
        en: 'ADB: confirm "Allow debugging" on the TV',
        de: "ADB: \u201EDebugging zulassen\u201C am TV best\xE4tigen",
        ru: "ADB: \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \xAB\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044C \u043E\u0442\u043B\u0430\u0434\u043A\u0443\xBB \u043D\u0430 \u0442\u0435\u043B\u0435\u0432\u0438\u0437\u043E\u0440\u0435",
        pt: 'ADB: confirme "Permitir depura\xE7\xE3o" na TV',
        nl: 'ADB: bevestig "Foutopsporing toestaan" op de tv',
        fr: "ADB : confirmez \xAB Autoriser le d\xE9bogage \xBB sur le t\xE9l\xE9viseur",
        it: 'ADB: conferma "Consenti debug" sulla TV',
        es: 'ADB: confirme "Permitir depuraci\xF3n" en la TV',
        pl: "ADB: potwierd\u017A \u201EZezw\xF3l na debugowanie\u201D na telewizorze",
        uk: "ADB: \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u044C\u0442\u0435 \xAB\u0414\u043E\u0437\u0432\u043E\u043B\u0438\u0442\u0438 \u043D\u0430\u043B\u0430\u0433\u043E\u0434\u0436\u0435\u043D\u043D\u044F\xBB \u043D\u0430 \u0442\u0435\u043B\u0435\u0432\u0456\u0437\u043E\u0440\u0456",
        "zh-cn": "ADB\uFF1A\u8BF7\u5728\u7535\u89C6\u4E0A\u786E\u8BA4\u201C\u5141\u8BB8\u8C03\u8BD5\u201D"
      },
      type: "boolean",
      role: "indicator.maintenance",
      read: true,
      write: false,
      def: false
    }
  },
  {
    id: "media.state",
    common: {
      name: {
        en: "Playback state",
        de: "Wiedergabestatus",
        ru: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F",
        pt: "Estado da reprodu\xE7\xE3o",
        nl: "Afspeelstatus",
        fr: "\xC9tat de lecture",
        it: "Stato di riproduzione",
        es: "Estado de reproducci\xF3n",
        pl: "Stan odtwarzania",
        uk: "\u0421\u0442\u0430\u043D \u0432\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F",
        "zh-cn": "\u64AD\u653E\u72B6\u6001"
      },
      type: "string",
      role: "media.state",
      read: true,
      write: false,
      states: { play: "play", pause: "pause", stop: "stop", buffering: "buffering", idle: "idle" }
    }
  },
  {
    id: "media.title",
    common: {
      name: {
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
      type: "string",
      role: "media.title",
      read: true,
      write: false
    }
  },
  {
    id: "media.subtitle",
    common: {
      name: {
        en: "Subtitle (artist, episode \u2026)",
        de: "Untertitel (Interpret, Folge \u2026)",
        ru: "\u041F\u043E\u0434\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A (\u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C, \u044D\u043F\u0438\u0437\u043E\u0434 \u2026)",
        pt: "Subt\xEDtulo (artista, epis\xF3dio \u2026)",
        nl: "Ondertitel (artiest, aflevering \u2026)",
        fr: "Sous-titre (artiste, \xE9pisode \u2026)",
        it: "Sottotitolo (artista, episodio \u2026)",
        es: "Subt\xEDtulo (artista, episodio \u2026)",
        pl: "Podtytu\u0142 (wykonawca, odcinek \u2026)",
        uk: "\u041F\u0456\u0434\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A (\u0432\u0438\u043A\u043E\u043D\u0430\u0432\u0435\u0446\u044C, \u0435\u043F\u0456\u0437\u043E\u0434 \u2026)",
        "zh-cn": "\u526F\u6807\u9898\uFF08\u827A\u672F\u5BB6\u3001\u5267\u96C6\u2026\uFF09"
      },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "media.app",
    common: {
      name: {
        en: "App playing the media",
        de: "App der Wiedergabe",
        ru: "\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F",
        pt: "App em reprodu\xE7\xE3o",
        nl: "App die afspeelt",
        fr: "Application en lecture",
        it: "App in riproduzione",
        es: "Aplicaci\xF3n en reproducci\xF3n",
        pl: "Aplikacja odtwarzaj\u0105ca",
        uk: "\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u043D\u043E\u043A \u0432\u0456\u0434\u0442\u0432\u043E\u0440\u0435\u043D\u043D\u044F",
        "zh-cn": "\u6B63\u5728\u64AD\u653E\u7684\u5E94\u7528"
      },
      type: "string",
      role: "text",
      read: true,
      write: false
    }
  },
  {
    id: "media.position",
    common: {
      name: {
        en: "Position",
        de: "Position",
        ru: "\u041F\u043E\u0437\u0438\u0446\u0438\u044F",
        pt: "Posi\xE7\xE3o",
        nl: "Positie",
        fr: "Position",
        it: "Posizione",
        es: "Posici\xF3n",
        pl: "Pozycja",
        uk: "\u041F\u043E\u0437\u0438\u0446\u0456\u044F",
        "zh-cn": "\u64AD\u653E\u4F4D\u7F6E"
      },
      type: "number",
      role: "media.elapsed",
      unit: "s",
      read: true,
      write: false
    }
  }
];
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ADB_STATES,
  DEVICE_STATES,
  KEY_BUTTONS
});
//# sourceMappingURL=states.js.map
