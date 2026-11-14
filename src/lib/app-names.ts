/*
 * Readable names for app IDs (Android package names) – shown in `currentAppName` and in the device manager.
 *
 * @KI_HINWEIS: Nur sicher bekannte Paketnamen eintragen; unbekannte Apps bleiben beim Paketnamen
 * (lieber technisch als falsch). Eigene App-Favoriten mit Paketname als Link haben Vorrang.
 */

/** Well-known apps (brand names, identical in all languages). */
const KNOWN_APPS: Readonly<Record<string, string>> = {
    'com.netflix.ninja': 'Netflix',
    'com.netflix.mediaclient': 'Netflix',
    'com.google.android.youtube.tv': 'YouTube',
    'com.amazon.firetv.youtube': 'YouTube',
    'com.google.android.youtube.tvmusic': 'YouTube Music',
    'com.amazon.amazonvideo.livingroom': 'Prime Video',
    'com.amazon.avod': 'Prime Video',
    'com.amazon.firebat': 'Prime Video',
    'com.amazon.bueller.music': 'Amazon Music',
    'com.disney.disneyplus': 'Disney+',
    'org.xbmc.kodi': 'Kodi',
    'com.plexapp.android': 'Plex',
    'org.jellyfin.androidtv': 'Jellyfin',
    'com.spotify.tv.android': 'Spotify',
    'com.dazn': 'DAZN',
    'com.apple.atve.androidtv.appletv': 'Apple TV',
    'com.apple.atve.amazon.appletv': 'Apple TV',
};

/** Home screens of Android TV / Google TV / Fire TV. */
const LAUNCHERS = new Set([
    'com.google.android.tvlauncher',
    'com.google.android.apps.tv.launcherx',
    'com.google.android.leanbacklauncher',
    'com.amazon.tv.launcher',
]);

/** TV input selection (Fire TV Edition / Android TV sets: an HDMI input is shown). */
const TV_INPUTS = new Set(['com.amazon.tv.inputpreference.service']);

/** System settings apps. */
const SETTINGS = new Set(['com.android.tv.settings', 'com.amazon.tv.settings.v2']);

const HOME_SCREEN: Record<ioBroker.Languages, string> = {
    en: 'Home screen',
    de: 'Startbildschirm',
    ru: 'Главный экран',
    pt: 'Ecrã inicial',
    nl: 'Startscherm',
    fr: "Écran d'accueil",
    it: 'Schermata Home',
    es: 'Pantalla de inicio',
    pl: 'Ekran główny',
    uk: 'Головний екран',
    'zh-cn': '主屏幕',
};

const TV_INPUT_NAME: Record<ioBroker.Languages, string> = {
    en: 'TV input (HDMI)',
    de: 'TV-Eingang (HDMI)',
    ru: 'Вход ТВ (HDMI)',
    pt: 'Entrada de TV (HDMI)',
    nl: 'Tv-ingang (HDMI)',
    fr: 'Entrée TV (HDMI)',
    it: 'Ingresso TV (HDMI)',
    es: 'Entrada de TV (HDMI)',
    pl: 'Wejście TV (HDMI)',
    uk: 'Вхід ТБ (HDMI)',
    'zh-cn': '电视输入（HDMI）',
};

const SETTINGS_NAME: Record<ioBroker.Languages, string> = {
    en: 'Settings',
    de: 'Einstellungen',
    ru: 'Настройки',
    pt: 'Definições',
    nl: 'Instellingen',
    fr: 'Paramètres',
    it: 'Impostazioni',
    es: 'Ajustes',
    pl: 'Ustawienia',
    uk: 'Налаштування',
    'zh-cn': '设置',
};

/**
 * Readable name of an app.
 *
 * @param appId - Android package name, e.g. `com.netflix.ninja`
 * @param favorites - App favorites of the instance (name + link); a link equal to the package name wins
 * @param language - System language for "Home screen" / "Settings"
 * @returns readable name, or the package name if the app is unknown
 */
export function appDisplayName(
    appId: string,
    favorites: Iterable<{ name: string; link: string }>,
    language: ioBroker.Languages,
): string {
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
    return KNOWN_APPS[appId] ?? appId;
}
