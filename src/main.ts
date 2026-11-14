/*
 * ioBroker.androidtv - control Android TV / Google TV devices (e.g. NVIDIA SHIELD) via the Android TV Remote
 * protocol v2 and optionally ADB (media information, app start by package, Fire TV).
 */
import * as utils from '@iobroker/adapter-core';
import { generateAdbKey, type AdbKey } from './lib/adb/auth';
import { DEFAULT_ADB_PORT } from './lib/adb/client';
import { appDisplayName } from './lib/app-names';
import { AndroidTvDeviceManagement, type DmBridge, type DmDeviceEntry } from './lib/device-management';
import { AdbDevice } from './lib/adb/device';
import type { MediaInfo, PollResult } from './lib/adb/parsers';
import {
    generateClientCertificate,
    isUsableCertificate,
    parseTvIdentity,
    type ClientCertificate,
} from './lib/certificate';
import { PairingError, PairingSession } from './lib/pairing';
import { RemoteConnection, resolveKeyCode } from './lib/remote';
import { ADB_STATES, DEVICE_STATES, KEY_BUTTONS, type StateDefinition } from './lib/states';
import type { Timers } from './lib/timers';
import { sendWakeOnLan, wolTargets } from './lib/wol';

type DeviceConfig = ioBroker.AdapterConfig['devices'][number];
type AppConfig = ioBroker.AdapterConfig['apps'][number];
type ConnectionMode = 'remote' | 'remote_adb' | 'adb';

/** Runtime data of one configured TV. */
interface DeviceRuntime {
    id: string;
    config: DeviceConfig;
    mode: ConnectionMode;
    label: string;
    remote?: RemoteConnection;
    adb?: AdbDevice;
    remoteConnected: boolean;
    adbConnected: boolean;
    adbAuthPending: boolean;
    pairingRequired: boolean;
    muted: boolean | undefined;
    /** Pending ADB power command: contradicting poll results are ignored until it is reached or expires */
    powerTarget?: { value: boolean; until: number };
    /** Started when the primary connection is lost; resets power/media if the device stays away */
    offlineTimer?: ioBroker.Timeout;
    /** Wake-on-LAN was sent: switch on as soon as ADB is back (until this time) */
    wakePendingUntil?: number;
}

/** Answer for the admin `textSendTo` status line. */
interface StatusText {
    text: string;
    icon: string;
    style: { color: string };
}

/** Open pairing attempt (between "start" and "finish"). */
interface PendingPairing {
    session: PairingSession;
    timer: ioBroker.Timeout | undefined;
}

/** Pairing sessions are dropped after this time; the TV itself cancels after about a minute. */
const PAIRING_SESSION_TTL_MS = 120_000;
const DEFAULT_RECONNECT_MAX_S = 60;
const DEFAULT_ADB_POLL_S = 5;
const CERT_FILE = 'client-certificate.json';
const ADB_KEY_FILE = 'adb-key.json';
/** A device that stays unreachable this long is considered off (power=false, media idle). */
const OFFLINE_GRACE_MS = 30_000;

/**
 * Texts returned to the admin UI (sendTo) and written to `<device>.info.status`, in all admin languages.
 * The system language picks the text; English is the fallback.
 */
const MESSAGES = {
    pairingStarted: {
        en: 'The TV now shows a 6-character code. Enter it and click "Confirm code".',
        de: 'Der TV zeigt jetzt einen 6-stelligen Code. Code eingeben und „Code bestätigen“ klicken.',
        ru: 'Телевизор показывает 6-значный код. Введите его и нажмите «Подтвердить код».',
        pt: 'A TV mostra agora um código de 6 caracteres. Introduza-o e clique em "Confirmar código".',
        nl: 'De tv toont nu een code van 6 tekens. Voer deze in en klik op "Code bevestigen".',
        fr: 'Le téléviseur affiche maintenant un code à 6 caractères. Saisissez-le et cliquez sur « Confirmer le code ».',
        it: 'La TV mostra ora un codice di 6 caratteri. Inseriscilo e fai clic su "Conferma codice".',
        es: 'La TV muestra ahora un código de 6 caracteres. Introdúzcalo y haga clic en "Confirmar código".',
        pl: 'Telewizor wyświetla teraz 6-znakowy kod. Wpisz go i kliknij „Potwierdź kod”.',
        uk: 'Телевізор показує 6-значний код. Введіть його та натисніть «Підтвердити код».',
        'zh-cn': '电视现在显示一个 6 位代码。请输入代码并点击“确认代码”。',
    },
    pairingDone: {
        en: 'Pairing successful. The connection is being established.',
        de: 'Kopplung erfolgreich. Die Verbindung wird aufgebaut.',
        ru: 'Сопряжение выполнено. Устанавливается соединение.',
        pt: 'Emparelhamento concluído. A ligação está a ser estabelecida.',
        nl: 'Koppelen gelukt. De verbinding wordt opgebouwd.',
        fr: 'Appairage réussi. La connexion est en cours d’établissement.',
        it: 'Associazione riuscita. La connessione è in corso.',
        es: 'Emparejamiento correcto. Se está estableciendo la conexión.',
        pl: 'Parowanie zakończone. Trwa nawiązywanie połączenia.',
        uk: 'Сполучення виконано. Встановлюється з’єднання.',
        'zh-cn': '配对成功，正在建立连接。',
    },
    pairingDoneSave: {
        en: 'Pairing successful. Save the settings to connect to this TV.',
        de: 'Kopplung erfolgreich. Einstellungen speichern, damit die Verbindung aufgebaut wird.',
        ru: 'Сопряжение выполнено. Сохраните настройки, чтобы подключиться к телевизору.',
        pt: 'Emparelhamento concluído. Guarde as definições para ligar a esta TV.',
        nl: 'Koppelen gelukt. Sla de instellingen op om met deze tv te verbinden.',
        fr: 'Appairage réussi. Enregistrez les paramètres pour vous connecter à ce téléviseur.',
        it: 'Associazione riuscita. Salva le impostazioni per connetterti a questa TV.',
        es: 'Emparejamiento correcto. Guarde los ajustes para conectarse a esta TV.',
        pl: 'Parowanie zakończone. Zapisz ustawienia, aby połączyć się z telewizorem.',
        uk: 'Сполучення виконано. Збережіть налаштування, щоб підключитися до телевізора.',
        'zh-cn': '配对成功。请保存设置以连接到此电视。',
    },
    statusConnected: {
        en: 'Connected',
        de: 'Verbunden',
        ru: 'Подключено',
        pt: 'Conectado',
        nl: 'Verbonden',
        fr: 'Connecté',
        it: 'Connesso',
        es: 'Conectado',
        pl: 'Połączono',
        uk: 'Підключено',
        'zh-cn': '已连接',
    },
    statusPairing: {
        en: 'Pairing required – switch the device on and follow step 1',
        de: 'Kopplung erforderlich – Gerät einschalten und Schritt 1 ausführen',
        ru: 'Требуется сопряжение – включите устройство и выполните шаг 1',
        pt: 'Emparelhamento necessário – ligue o dispositivo e siga o passo 1',
        nl: 'Koppelen vereist – zet het apparaat aan en volg stap 1',
        fr: 'Appairage requis – allumez l’appareil et suivez l’étape 1',
        it: 'Associazione necessaria – accendi il dispositivo e segui il passo 1',
        es: 'Emparejamiento necesario – encienda el dispositivo y siga el paso 1',
        pl: 'Wymagane parowanie – włącz urządzenie i wykonaj krok 1',
        uk: 'Потрібне сполучення – увімкніть пристрій і виконайте крок 1',
        'zh-cn': '需要配对 – 请打开设备并按照第 1 步操作',
    },
    statusOffline: {
        en: 'Not connected – device switched off, unplugged or unreachable',
        de: 'Nicht verbunden – Gerät aus, ohne Strom oder nicht erreichbar',
        ru: 'Нет соединения – устройство выключено, обесточено или недоступно',
        pt: 'Sem ligação – dispositivo desligado, sem corrente ou inacessível',
        nl: 'Niet verbonden – apparaat uit, zonder stroom of onbereikbaar',
        fr: 'Non connecté – appareil éteint, débranché ou injoignable',
        it: 'Non connesso – dispositivo spento, scollegato o non raggiungibile',
        es: 'Sin conexión – dispositivo apagado, desenchufado o inaccesible',
        pl: 'Brak połączenia – urządzenie wyłączone, bez zasilania lub nieosiągalne',
        uk: 'Немає з’єднання – пристрій вимкнено, знеструмлено або недоступний',
        'zh-cn': '未连接 – 设备已关闭、断电或无法访问',
    },
    statusAdbPending: {
        en: 'Please confirm "Allow debugging" on the TV (tick "Always allow")',
        de: 'Bitte am Fernseher „Debugging zulassen“ bestätigen („Immer zulassen“ anhaken)',
        ru: 'Подтвердите «Разрешить отладку» на телевизоре (отметьте «Всегда разрешать»)',
        pt: 'Confirme "Permitir depuração" na TV (assinale "Permitir sempre")',
        nl: 'Bevestig "Foutopsporing toestaan" op de tv (vink "Altijd toestaan" aan)',
        fr: 'Confirmez « Autoriser le débogage » sur le téléviseur (cochez « Toujours autoriser »)',
        it: 'Conferma "Consenti debug" sulla TV (spunta "Consenti sempre")',
        es: 'Confirme "Permitir depuración" en la TV (marque "Permitir siempre")',
        pl: 'Potwierdź „Zezwól na debugowanie” na telewizorze (zaznacz „Zawsze zezwalaj”)',
        uk: 'Підтвердьте «Дозволити налагодження» на телевізорі (позначте «Завжди дозволяти»)',
        'zh-cn': '请在电视上确认“允许调试”（勾选“始终允许”）',
    },
    statusAdbOffline: {
        en: 'Not connected – device switched off or debugging not enabled',
        de: 'Nicht verbunden – Gerät aus oder Debugging am Gerät nicht eingeschaltet',
        ru: 'Нет соединения – устройство выключено или отладка не включена',
        pt: 'Sem ligação – dispositivo desligado ou depuração não ativada',
        nl: 'Niet verbonden – apparaat uit of foutopsporing niet ingeschakeld',
        fr: 'Non connecté – appareil éteint ou débogage non activé',
        it: 'Non connesso – dispositivo spento o debug non attivato',
        es: 'Sin conexión – dispositivo apagado o depuración no activada',
        pl: 'Brak połączenia – urządzenie wyłączone lub debugowanie nie jest włączone',
        uk: 'Немає з’єднання – пристрій вимкнено або налагодження не ввімкнено',
        'zh-cn': '未连接 – 设备已关闭或未启用调试',
    },
    statusAdbOk: {
        en: 'playback info active',
        de: 'Wiedergabe-Infos aktiv',
        ru: 'сведения о воспроизведении активны',
        pt: 'informações de reprodução ativas',
        nl: 'afspeelinfo actief',
        fr: 'infos de lecture actives',
        it: 'info di riproduzione attive',
        es: 'información de reproducción activa',
        pl: 'informacje o odtwarzaniu aktywne',
        uk: 'відомості про відтворення активні',
        'zh-cn': '播放信息已启用',
    },
    statusInfoOffline: {
        en: 'playback info not available (debugging switched on?)',
        de: 'Wiedergabe-Infos nicht verfügbar (Debugging eingeschaltet?)',
        ru: 'сведения о воспроизведении недоступны (отладка включена?)',
        pt: 'informações de reprodução indisponíveis (depuração ativada?)',
        nl: 'afspeelinfo niet beschikbaar (foutopsporing ingeschakeld?)',
        fr: 'infos de lecture indisponibles (débogage activé ?)',
        it: 'info di riproduzione non disponibili (debug attivato?)',
        es: 'información de reproducción no disponible (¿depuración activada?)',
        pl: 'informacje o odtwarzaniu niedostępne (debugowanie włączone?)',
        uk: 'відомості про відтворення недоступні (налагодження ввімкнено?)',
        'zh-cn': '播放信息不可用（是否已启用调试？）',
    },
    statusDisabled: {
        en: 'Disabled',
        de: 'Deaktiviert',
        ru: 'Отключено',
        pt: 'Desativado',
        nl: 'Uitgeschakeld',
        fr: 'Désactivé',
        it: 'Disattivato',
        es: 'Desactivado',
        pl: 'Wyłączone',
        uk: 'Вимкнено',
        'zh-cn': '已禁用',
    },
    statusUnsaved: {
        en: 'Not saved yet – pairing already works, the connection starts after saving',
        de: 'Noch nicht gespeichert – Koppeln geht schon, die Verbindung startet nach dem Speichern',
        ru: 'Ещё не сохранено – сопряжение уже работает, соединение начнётся после сохранения',
        pt: 'Ainda não guardado – o emparelhamento já funciona, a ligação começa depois de guardar',
        nl: 'Nog niet opgeslagen – koppelen werkt al, de verbinding start na het opslaan',
        fr: 'Pas encore enregistré – l’appairage fonctionne déjà, la connexion démarre après l’enregistrement',
        it: 'Non ancora salvato – l’associazione funziona già, la connessione parte dopo il salvataggio',
        es: 'Aún no guardado – el emparejamiento ya funciona, la conexión empieza al guardar',
        pl: 'Jeszcze nie zapisano – parowanie już działa, połączenie rozpocznie się po zapisaniu',
        uk: 'Ще не збережено – сполучення вже працює, з’єднання почнеться після збереження',
        'zh-cn': '尚未保存 – 已可配对，保存后开始连接',
    },
    statusNoHost: {
        en: 'Enter the IP address first',
        de: 'Zuerst die IP-Adresse eintragen',
        ru: 'Сначала введите IP-адрес',
        pt: 'Introduza primeiro o endereço IP',
        nl: 'Voer eerst het IP-adres in',
        fr: 'Saisissez d’abord l’adresse IP',
        it: 'Inserisci prima l’indirizzo IP',
        es: 'Introduzca primero la dirección IP',
        pl: 'Najpierw wpisz adres IP',
        uk: 'Спочатку введіть IP-адресу',
        'zh-cn': '请先输入 IP 地址',
    },
    noHost: {
        en: 'Please enter the IP address of the TV.',
        de: 'Bitte die IP-Adresse des TV eingeben.',
        ru: 'Введите IP-адрес телевизора.',
        pt: 'Introduza o endereço IP da TV.',
        nl: 'Voer het IP-adres van de tv in.',
        fr: 'Saisissez l’adresse IP du téléviseur.',
        it: 'Inserisci l’indirizzo IP della TV.',
        es: 'Introduzca la dirección IP de la TV.',
        pl: 'Wpisz adres IP telewizora.',
        uk: 'Введіть IP-адресу телевізора.',
        'zh-cn': '请输入电视的 IP 地址。',
    },
    noSession: {
        en: 'No pairing in progress for this IP - click "Start pairing" first.',
        de: 'Für diese IP läuft keine Kopplung - zuerst „Kopplung starten“ klicken.',
        ru: 'Для этого IP сопряжение не запущено – сначала нажмите «Начать сопряжение».',
        pt: 'Não há emparelhamento em curso para este IP - clique primeiro em "Iniciar emparelhamento".',
        nl: 'Geen koppeling bezig voor dit IP - klik eerst op "Koppelen starten".',
        fr: 'Aucun appairage en cours pour cette IP - cliquez d’abord sur « Démarrer l’appairage ».',
        it: 'Nessuna associazione in corso per questo IP - fai prima clic su "Avvia associazione".',
        es: 'No hay emparejamiento en curso para esta IP - haga clic primero en "Iniciar emparejamiento".',
        pl: 'Dla tego IP nie trwa parowanie – najpierw kliknij „Rozpocznij parowanie”.',
        uk: 'Для цієї IP сполучення не запущено – спочатку натисніть «Почати сполучення».',
        'zh-cn': '此 IP 没有正在进行的配对 - 请先点击“开始配对”。',
    },
    noCertificate: {
        en: 'Client certificate not ready yet - wait a few seconds and try again.',
        de: 'Client-Zertifikat noch nicht bereit - ein paar Sekunden warten und erneut versuchen.',
        ru: 'Сертификат клиента ещё не готов – подождите несколько секунд и повторите.',
        pt: 'O certificado do cliente ainda não está pronto - aguarde alguns segundos e tente novamente.',
        nl: 'Clientcertificaat nog niet klaar - wacht enkele seconden en probeer het opnieuw.',
        fr: 'Le certificat client n’est pas encore prêt - attendez quelques secondes et réessayez.',
        it: 'Il certificato client non è ancora pronto - attendi qualche secondo e riprova.',
        es: 'El certificado de cliente aún no está listo - espere unos segundos y vuelva a intentarlo.',
        pl: 'Certyfikat klienta nie jest jeszcze gotowy – odczekaj kilka sekund i spróbuj ponownie.',
        uk: 'Сертифікат клієнта ще не готовий – зачекайте кілька секунд і повторіть.',
        'zh-cn': '客户端证书尚未就绪 - 请等待几秒后重试。',
    },
    connect: {
        en: 'The device cannot be reached for pairing. Check the IP address and that the device is switched on. For a Fire TV choose the device type "Amazon Fire TV" – it needs no pairing.',
        de: 'Das Gerät ist zum Koppeln nicht erreichbar. IP-Adresse prüfen und ob das Gerät eingeschaltet ist. Für einen Fire TV den Gerätetyp „Amazon Fire TV“ wählen – dort ist keine Kopplung nötig.',
        ru: 'Устройство недоступно для сопряжения. Проверьте IP-адрес и включено ли устройство. Для Fire TV выберите тип устройства «Amazon Fire TV» – сопряжение не требуется.',
        pt: 'O dispositivo não está acessível para emparelhamento. Verifique o endereço IP e se o dispositivo está ligado. Para um Fire TV escolha o tipo de dispositivo "Amazon Fire TV" – não precisa de emparelhamento.',
        nl: 'Het apparaat is niet bereikbaar om te koppelen. Controleer het IP-adres en of het apparaat aan staat. Kies voor een Fire TV het apparaattype "Amazon Fire TV" – koppelen is dan niet nodig.',
        fr: 'L’appareil est injoignable pour l’appairage. Vérifiez l’adresse IP et que l’appareil est allumé. Pour un Fire TV, choisissez le type d’appareil « Amazon Fire TV » – aucun appairage n’est nécessaire.',
        it: 'Il dispositivo non è raggiungibile per l’associazione. Controlla l’indirizzo IP e che il dispositivo sia acceso. Per una Fire TV scegli il tipo di dispositivo "Amazon Fire TV" – non serve l’associazione.',
        es: 'No se puede acceder al dispositivo para emparejarlo. Compruebe la dirección IP y que el dispositivo esté encendido. Para un Fire TV elija el tipo de dispositivo "Amazon Fire TV" – no necesita emparejamiento.',
        pl: 'Urządzenie jest nieosiągalne do parowania. Sprawdź adres IP i czy urządzenie jest włączone. Dla Fire TV wybierz typ urządzenia „Amazon Fire TV” – parowanie nie jest potrzebne.',
        uk: 'Пристрій недоступний для сполучення. Перевірте IP-адресу та чи ввімкнено пристрій. Для Fire TV виберіть тип пристрою «Amazon Fire TV» – сполучення не потрібне.',
        'zh-cn':
            '无法连接设备进行配对。请检查 IP 地址以及设备是否已开启。Fire TV 请选择设备类型“Amazon Fire TV”– 无需配对。',
    },
    timeout: {
        en: 'The TV did not answer in time.',
        de: 'Der TV hat nicht rechtzeitig geantwortet.',
        ru: 'Телевизор не ответил вовремя.',
        pt: 'A TV não respondeu a tempo.',
        nl: 'De tv heeft niet op tijd geantwoord.',
        fr: 'Le téléviseur n’a pas répondu à temps.',
        it: 'La TV non ha risposto in tempo.',
        es: 'La TV no respondió a tiempo.',
        pl: 'Telewizor nie odpowiedział na czas.',
        uk: 'Телевізор не відповів вчасно.',
        'zh-cn': '电视未及时响应。',
    },
    closed: {
        en: 'The TV closed the pairing (cancelled or timed out). Start again.',
        de: 'Der TV hat die Kopplung beendet (abgebrochen oder Zeit abgelaufen). Erneut starten.',
        ru: 'Телевизор завершил сопряжение (отменено или истекло время). Начните заново.',
        pt: 'A TV terminou o emparelhamento (cancelado ou tempo esgotado). Comece novamente.',
        nl: 'De tv heeft het koppelen beëindigd (geannuleerd of verlopen). Begin opnieuw.',
        fr: 'Le téléviseur a mis fin à l’appairage (annulé ou délai dépassé). Recommencez.',
        it: 'La TV ha terminato l’associazione (annullata o scaduta). Ricomincia.',
        es: 'La TV terminó el emparejamiento (cancelado o tiempo agotado). Vuelva a empezar.',
        pl: 'Telewizor zakończył parowanie (anulowano lub upłynął czas). Zacznij od nowa.',
        uk: 'Телевізор завершив сполучення (скасовано або минув час). Почніть знову.',
        'zh-cn': '电视已结束配对（已取消或超时）。请重新开始。',
    },
    rejected: {
        en: 'The TV rejected the pairing.',
        de: 'Der TV hat die Kopplung abgelehnt.',
        ru: 'Телевизор отклонил сопряжение.',
        pt: 'A TV recusou o emparelhamento.',
        nl: 'De tv heeft het koppelen geweigerd.',
        fr: 'Le téléviseur a refusé l’appairage.',
        it: 'La TV ha rifiutato l’associazione.',
        es: 'La TV rechazó el emparejamiento.',
        pl: 'Telewizor odrzucił parowanie.',
        uk: 'Телевізор відхилив сполучення.',
        'zh-cn': '电视拒绝了配对。',
    },
    invalidPin: {
        en: 'The code must have 6 characters (0-9, A-F).',
        de: 'Der Code muss 6 Zeichen haben (0-9, A-F).',
        ru: 'Код должен содержать 6 символов (0-9, A-F).',
        pt: 'O código deve ter 6 caracteres (0-9, A-F).',
        nl: 'De code moet 6 tekens hebben (0-9, A-F).',
        fr: 'Le code doit comporter 6 caractères (0-9, A-F).',
        it: 'Il codice deve avere 6 caratteri (0-9, A-F).',
        es: 'El código debe tener 6 caracteres (0-9, A-F).',
        pl: 'Kod musi mieć 6 znaków (0-9, A-F).',
        uk: 'Код має містити 6 символів (0-9, A-F).',
        'zh-cn': '代码必须为 6 个字符（0-9、A-F）。',
    },
    wrongPin: {
        en: 'The code does not match. Please check it and try again.',
        de: 'Der Code passt nicht. Bitte prüfen und erneut eingeben.',
        ru: 'Код не подходит. Проверьте его и повторите.',
        pt: 'O código não corresponde. Verifique-o e tente novamente.',
        nl: 'De code klopt niet. Controleer hem en probeer het opnieuw.',
        fr: 'Le code ne correspond pas. Vérifiez-le et réessayez.',
        it: 'Il codice non corrisponde. Controllalo e riprova.',
        es: 'El código no coincide. Compruébelo y vuelva a intentarlo.',
        pl: 'Kod się nie zgadza. Sprawdź go i spróbuj ponownie.',
        uk: 'Код не збігається. Перевірте його та повторіть.',
        'zh-cn': '代码不匹配。请检查后重试。',
    },
} as const satisfies Record<string, Record<ioBroker.Languages, string>>;

type MessageKey = keyof typeof MESSAGES;

/**
 * Converts a free text into a valid ioBroker object id part.
 *
 * @param text - e.g. "Shield Wohnzimmer"
 * @param forbidden - Adapter FORBIDDEN_CHARS regex
 */
function toId(text: string, forbidden: RegExp): string {
    // @KI_HINWEIS: Strenger als FORBIDDEN_CHARS: nur A-Z, a-z, 0-9, _ und -, damit IDs wie "Disney+" in Skripten,
    // MQTT-Topics und Vis ohne Escaping nutzbar sind.
    const umlauts: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
    return text
        .trim()
        .replace(/[äöüÄÖÜß]/g, c => umlauts[c] ?? c)
        .replace(forbidden, '_')
        .replace(/[^A-Za-z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Validates a numeric setting in code (the limits in the settings page alone are not enough).
 *
 * @param value - Configured value
 * @param min - Smallest allowed value
 * @param max - Largest allowed value
 * @param fallback - Used when the value is missing or outside the range
 */
function numberInRange(value: unknown, min: number, max: number, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
}

/**
 * Normalizes the configured connection mode (configs of 0.0.1 have none).
 *
 * @param config - Device configuration
 */
function modeOf(config: DeviceConfig): ConnectionMode {
    return config.connection === 'adb' || config.connection === 'remote_adb' ? config.connection : 'remote';
}

/**
 * Whether a launch target is a URL/deep link (has a scheme) rather than a package name.
 *
 * @param target - Link or package name
 */
function isLink(target: string): boolean {
    return /^[a-z][a-z0-9+.-]*:/i.test(target.trim());
}

class Androidtv extends utils.Adapter {
    /** Adapter timers for the protocol classes; cleared automatically on unload. */
    private readonly adapterTimers: Timers = {
        setTimeout: (callback, ms) => this.setTimeout(callback, ms),
        clearTimeout: handle => this.clearTimeout(handle as ioBroker.Timeout | undefined),
    };
    private readonly devices = new Map<string, DeviceRuntime>();
    private readonly appsById = new Map<string, AppConfig>();
    private readonly pairings = new Map<string, PendingPairing>();
    private certificate: ClientCertificate | undefined;
    private adbKey: AdbKey | undefined;
    private uiLanguage: ioBroker.Languages = 'en';
    /** All configured devices (also disabled ones) for the Device Manager */
    private configured: DmDeviceEntry[] = [];
    /** Last screen state used for `currentAppName` per device */
    private readonly appNamePower = new Map<string, boolean>();
    /** Resolves the `ready` promise of the Device Manager bridge at the end of onReady */
    private resolveReady: () => void = () => undefined;
    /** Device Manager (admin "Devices" view); registers its own message handler for `dm:*` commands */
    public readonly deviceManagement: AndroidTvDeviceManagement;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'androidtv',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
        this.deviceManagement = new AndroidTvDeviceManagement(this, this.dmBridge());
    }

    private async onReady(): Promise<void> {
        await this.setState('info.connection', false, true);

        const sysConfig = await this.getForeignObjectAsync('system.config');
        const language = sysConfig?.common?.language;
        this.uiLanguage = language && language in MESSAGES.statusConnected ? language : 'en';

        await this.ensureCertificate();

        const rawDevices = Array.isArray(this.config.devices) ? this.config.devices : [];
        const devices = rawDevices.filter(d => d && typeof d.host === 'string' && d.host.trim() !== '');
        const apps = (Array.isArray(this.config.apps) ? this.config.apps : []).filter(
            a =>
                a &&
                typeof a.name === 'string' &&
                a.name.trim() !== '' &&
                typeof a.link === 'string' &&
                a.link.trim() !== '',
        );
        const appIdsLower = new Set<string>();
        for (const app of apps) {
            const id = toId(app.name, this.FORBIDDEN_CHARS);
            // IDs must be unique case-insensitively ("Netflix" and "netflix" would collide)
            if (id && !appIdsLower.has(id.toLowerCase())) {
                appIdsLower.add(id.toLowerCase());
                this.appsById.set(id, app);
            }
        }
        if (devices.some(d => d.enabled !== false && modeOf(d) !== 'remote')) {
            await this.ensureAdbKey();
        }

        const usedIds = new Set<string>();
        const usedIdsLower = new Set<string>();
        for (const config of devices) {
            const base =
                toId(config.name || config.host, this.FORBIDDEN_CHARS) || toId(config.host, this.FORBIDDEN_CHARS);
            let id = base;
            // IDs must be unique case-insensitively ("TV" and "tv" would collide)
            for (let n = 2; usedIdsLower.has(id.toLowerCase()); n++) {
                id = `${base}_${n}`;
            }
            usedIds.add(id);
            usedIdsLower.add(id.toLowerCase());
            await this.createDeviceObjects(id, config);
            // @KI_HINWEIS: Leerer Text statt null – die Geräteverwaltung zeigt null sonst wörtlich an.
            if ((await this.getStateAsync(`${id}.currentAppName`))?.val == null) {
                await this.setState(`${id}.currentAppName`, '', true);
            }
            const entry: DmDeviceEntry = {
                id,
                index: rawDevices.indexOf(config),
                config,
                mode: modeOf(config),
                running: false,
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
            this.log.warn('No devices configured - add your TV in the instance settings.');
        }

        this.subscribeStates('*');
        for (const device of this.devices.values()) {
            device.remote?.start();
            device.adb?.start();
            this.scheduleOffline(device); // device unreachable at start-up → stale power/media are reset
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
    private async ensureCertificate(): Promise<void> {
        // @KI_HINWEIS: Nicht (mehr) in native: Eine vor dem ersten Start geöffnete Konfigurationsseite schreibt beim
        // Speichern leere Zertifikatsfelder zurück → neues Zertifikat → Kopplung am TV verloren (im Feldtest
        // beobachtet). Der Dateispeicher wird vom Admin-Speichern nicht berührt; außerdem entfällt der Neustart.
        const stored = await this.readSecretFile(CERT_FILE);
        if (typeof stored?.cert === 'string' && typeof stored.key === 'string') {
            const candidate = { cert: stored.cert, key: this.decrypt(stored.key) };
            if (isUsableCertificate(candidate)) {
                this.certificate = candidate;
                return;
            }
            this.log.warn('Stored client certificate is invalid or expired - creating a new one (pairing required)');
        }
        const fromNative = { cert: this.config.clientCert, key: this.config.clientKey };
        if (isUsableCertificate(fromNative)) {
            this.log.info('Moving client certificate from instance configuration to file storage');
            this.certificate = fromNative;
        } else {
            this.log.info('Creating client certificate for pairing (one-time)');
            this.certificate = generateClientCertificate(this.config.clientName?.trim() || 'ioBroker');
        }
        await this.writeSecretFile(CERT_FILE, { cert: this.certificate.cert, key: this.encrypt(this.certificate.key) });
    }

    /** Loads or creates the RSA key used for ADB authentication. */
    private async ensureAdbKey(): Promise<void> {
        const stored = await this.readSecretFile(ADB_KEY_FILE);
        if (typeof stored?.key === 'string') {
            try {
                const privateKey = this.decrypt(stored.key);
                if (privateKey.includes('PRIVATE KEY')) {
                    this.adbKey = { privateKey };
                    return;
                }
            } catch (e) {
                this.log.warn(`Cannot read stored ADB key: ${(e as Error).message}`);
            }
        }
        this.log.info('Creating ADB key (one-time) - confirm "Allow debugging" on the TV at the first connection');
        this.adbKey = generateAdbKey();
        await this.writeSecretFile(ADB_KEY_FILE, { key: this.encrypt(this.adbKey.privateKey) });
    }

    private async readSecretFile(name: string): Promise<Record<string, unknown> | undefined> {
        try {
            if (!(await this.fileExistsAsync(this.namespace, name))) {
                return undefined;
            }
            const file = await this.readFileAsync(this.namespace, name);
            const raw = typeof file.file === 'string' ? file.file : file.file.toString('utf8');
            const parsed: unknown = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
        } catch (e) {
            this.log.warn(`Cannot read ${name}: ${(e as Error).message}`);
            return undefined;
        }
    }

    private async writeSecretFile(name: string, content: Record<string, string>): Promise<void> {
        // @KI_HINWEIS: Das meta-Objekt für den Dateispeicher kommt aus instanceObjects (io-package.json).
        await this.writeFileAsync(this.namespace, name, JSON.stringify(content));
    }

    // ------------------------------------------------------------------------------------------------------------
    // Device runtime
    // ------------------------------------------------------------------------------------------------------------

    private createRuntime(id: string, config: DeviceConfig): DeviceRuntime {
        const mode = modeOf(config);
        const reconnectMax = numberInRange(this.config.reconnectMax, 5, 3600, DEFAULT_RECONNECT_MAX_S);
        const runtime: DeviceRuntime = {
            id,
            config,
            mode,
            label: `${config.name || id} (${config.host})`,
            remoteConnected: false,
            adbConnected: false,
            adbAuthPending: false,
            pairingRequired: false,
            muted: undefined,
        };
        if (mode !== 'adb') {
            if (!this.certificate) {
                throw new Error('Certificate missing');
            }
            runtime.remote = new RemoteConnection({
                timers: this.adapterTimers,
                host: config.host.trim(),
                certificate: this.certificate,
                enableIme: config.enableIme !== false,
                reconnectMaxMs: reconnectMax * 1000,
            });
            this.attachRemote(runtime, runtime.remote);
        }
        if (mode !== 'remote') {
            if (!this.adbKey) {
                throw new Error('ADB key missing');
            }
            const pollS = numberInRange(this.config.adbPollInterval, 2, 300, DEFAULT_ADB_POLL_S);
            const port = numberInRange(config.adbPort, 1, 65535, DEFAULT_ADB_PORT);
            runtime.adb = new AdbDevice({
                timers: this.adapterTimers,
                host: config.host.trim(),
                port,
                key: this.adbKey,
                keyName: `ioBroker@${this.host ?? 'iobroker'}`,
                pollIntervalMs: pollS * 1000,
                reconnectMaxMs: reconnectMax * 1000,
                externalPower: () => (runtime.remoteConnected ? runtime.remote?.isOn : undefined),
            });
            this.attachAdb(runtime, runtime.adb);
        }
        return runtime;
    }

    private attachRemote(runtime: DeviceRuntime, remote: RemoteConnection): void {
        const { id, label } = runtime;
        remote.on('ready', (info, peerCert) => {
            runtime.remoteConnected = true;
            this.cancelOffline(runtime);
            runtime.pairingRequired = false;
            this.log.info(`${label}: connected`);
            void this.setDeviceStates(id, {
                'info.connected': true,
                'info.pairingRequired': false,
                'info.model': info.model ?? null,
                'info.manufacturer': info.vendor ?? null,
                'info.remoteServiceVersion': info.appVersion ?? null,
            });
            if (peerCert) {
                try {
                    const { mac } = parseTvIdentity(peerCert);
                    // @KI_HINWEIS: Nur zur Info. Feldtest SHIELD: Die MAC im TV-Zertifikat ist die WLAN-MAC, auch
                    // wenn das Gerät per LAN hängt. Für Wake-on-LAN zählt nur die MAC aus der Konfiguration.
                    if (mac) {
                        void this.setStateChangedAsync(`${id}.info.mac`, mac, true);
                    }
                } catch (e) {
                    this.log.debug(`${label}: cannot parse TV certificate: ${(e as Error).message}`);
                }
            }
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
        });
        remote.on('disconnected', reason => {
            runtime.remoteConnected = false;
            this.scheduleOffline(runtime);
            this.log.debug(`${label}: disconnected (${reason}), reconnecting`);
            void this.setStateChangedAsync(`${id}.info.connected`, false, true);
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
        });
        remote.on('unpaired', () => {
            runtime.remoteConnected = false;
            runtime.pairingRequired = true;
            this.log.warn(
                `${label}: the TV does not accept this ioBroker instance. Please pair it in the instance settings (tab "Devices").`,
            );
            void this.setDeviceStates(id, { 'info.connected': false, 'info.pairingRequired': true });
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
        });
        remote.on('power', on => {
            void this.setStateChangedAsync(`${id}.power`, on, true);
            void this.refreshAppName(id, on);
            if (on) {
                runtime.adb?.pollSoon();
            } else if (runtime.adb) {
                void this.setMediaStates(id, null);
            }
        });
        remote.on('currentApp', app => {
            void this.setCurrentApp(id, app);
            runtime.adb?.pollSoon();
        });
        remote.on('volume', volume => {
            runtime.muted = volume.muted;
            // @KI_HINWEIS: max = 0 meldet z. B. die SHIELD, wenn die Lautstärke per HDMI-CEC am TV/AVR geregelt wird
            // (Feldtest). Dann gibt es keinen eigenen Pegel → null statt einer irreführenden 0.
            const known = volume.max > 0;
            void this.setDeviceStates(id, {
                volume: known ? volume.level : null,
                volumeMax: known ? volume.max : null,
                muted: volume.muted,
            });
        });
        remote.on('log', (level, message) => this.log[level](message));
    }

    private attachAdb(runtime: DeviceRuntime, adb: AdbDevice): void {
        const { id, label } = runtime;
        const adbOnly = runtime.mode === 'adb';
        adb.on('ready', info => {
            runtime.adbConnected = true;
            if (adbOnly) {
                this.cancelOffline(runtime);
            }
            runtime.adbAuthPending = false;
            this.log.info(`${label}: ADB connected${info.model ? ` (${info.model})` : ''}`);
            const values: Record<string, ioBroker.StateValue> = {
                'info.adbConnected': true,
                'info.adbAuthorizationPending': false,
            };
            if (adbOnly) {
                values['info.connected'] = true;
                values['info.model'] = info.model ?? null;
                adb.getProp('ro.product.manufacturer')
                    .then(m => this.setStateChangedAsync(`${id}.info.manufacturer`, m ?? null, true))
                    .catch(e => this.log.debug(`${label}: cannot read manufacturer: ${(e as Error).message}`));
            }
            void this.setDeviceStates(id, values);
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
            // @KI_HINWEIS: Diagnose: Der Schlüssel der Wake-on-LAN-Einstellung ist herstellerabhängig (Fire-TV-
            // Fernseher verschiedener Hersteller). Erst die Schlüssel im Feld sammeln, bevor der Adapter sie setzt.
            adb.findWakeSettings()
                .then(found =>
                    this.log.debug(`${label}: wake settings: ${found.length ? found.join(' | ') : 'none found'}`),
                )
                .catch(() => undefined);
            if (runtime.wakePendingUntil && Date.now() < runtime.wakePendingUntil) {
                runtime.wakePendingUntil = undefined;
                runtime.powerTarget = { value: true, until: Date.now() + 5_000 };
                adb.setPower(true).catch(e =>
                    this.log.debug(`${label}: switching on after Wake-on-LAN failed: ${(e as Error).message}`),
                );
            }
        });
        adb.on('authPending', () => {
            runtime.adbAuthPending = true;
            this.log.warn(
                `${label}: confirm "Allow debugging" on the TV and tick "Always allow from this computer" (key ioBroker@${this.host ?? 'iobroker'})`,
            );
            void this.setStateChangedAsync(`${id}.info.adbAuthorizationPending`, true, true);
            void this.refreshStatus(runtime);
        });
        adb.on('disconnected', () => {
            runtime.adbConnected = false;
            if (adbOnly) {
                this.scheduleOffline(runtime);
            }
            this.log.debug(`${label}: ADB disconnected, reconnecting`);
            const values: Record<string, ioBroker.StateValue> = { 'info.adbConnected': false };
            if (adbOnly) {
                values['info.connected'] = false;
            }
            void this.setDeviceStates(id, values);
            void this.updateConnectionState();
            void this.refreshStatus(runtime);
        });
        adb.on('poll', result => void this.applyPoll(runtime, result));
        adb.on('log', (level, message) => this.log[level](message));
    }

    /**
     * Writes the result of an ADB poll to the states.
     *
     * @param runtime - Device
     * @param result - Parsed poll output
     */
    private async applyPoll(runtime: DeviceRuntime, result: PollResult): Promise<void> {
        const { id } = runtime;
        if (runtime.mode === 'adb') {
            const target = runtime.powerTarget;
            // @KI_HINWEIS: Feldtest Fire TV: Eine kurz vor dem Befehl gestartete Abfrage meldete noch den alten
            // Zustand und bestätigte ihn (Flackern true→false). Bis zum Ziel bzw. 5 s danach widersprechende
            // Werte ignorieren.
            const contradicts = target !== undefined && Date.now() < target.until && result.awake !== target.value;
            if (target && (!contradicts || Date.now() >= target.until)) {
                runtime.powerTarget = undefined;
            }
            if (result.awake !== undefined && !contradicts) {
                await this.setStateChangedAsync(`${id}.power`, result.awake, true);
                await this.refreshAppName(id, result.awake);
            }
            if (result.currentApp) {
                await this.setCurrentApp(id, result.currentApp);
            }
        }
        if (result.awake === false) {
            await this.setMediaStates(id, null);
        } else if (result.media !== undefined) {
            await this.setMediaStates(id, result.media);
        }
    }

    /**
     * Starts the grace timer after the primary connection was lost. Short interruptions (e.g. the TV closes the
     * connection after a rejected command and is back after 2 s) do not touch power/media.
     *
     * @param runtime - Device
     */
    private scheduleOffline(runtime: DeviceRuntime): void {
        if (runtime.offlineTimer) {
            return;
        }
        runtime.offlineTimer = this.setTimeout(() => {
            runtime.offlineTimer = undefined;
            this.log.debug(`${runtime.label}: unreachable for ${OFFLINE_GRACE_MS / 1000} s - treating as off`);
            void this.setStateChangedAsync(`${runtime.id}.power`, false, true);
            // the last app is meaningless while the device is off (card in the device manager)
            void this.setStateChangedAsync(`${runtime.id}.currentAppName`, '', true);
            if (runtime.adb) {
                void this.setMediaStates(runtime.id, null);
            }
        }, OFFLINE_GRACE_MS);
    }

    private cancelOffline(runtime: DeviceRuntime): void {
        if (runtime.offlineTimer) {
            this.clearTimeout(runtime.offlineTimer);
            runtime.offlineTimer = undefined;
        }
    }

    private async setMediaStates(id: string, media: MediaInfo | null): Promise<void> {
        await this.setDeviceStates(id, {
            'media.state': media?.state ?? 'idle',
            'media.title': media?.title ?? null,
            'media.subtitle': media?.subtitle ?? null,
            'media.app': media?.app ?? null,
            'media.position': media?.position ?? null,
        });
    }

    private async setDeviceStates(id: string, values: Record<string, ioBroker.StateValue>): Promise<void> {
        for (const [key, val] of Object.entries(values)) {
            await this.setStateChangedAsync(`${id}.${key}`, val, true);
        }
    }

    private async updateConnectionState(): Promise<void> {
        const anyConnected = [...this.devices.values()].some(d =>
            d.mode === 'adb' ? d.adbConnected : d.remoteConnected,
        );
        await this.setStateChangedAsync('info.connection', anyConnected, true);
    }

    // ------------------------------------------------------------------------------------------------------------
    // Objects
    // ------------------------------------------------------------------------------------------------------------

    /**
     * State definitions that apply to a device in its connection mode.
     *
     * @param config - Device configuration
     */
    private stateDefinitionsFor(config: DeviceConfig): StateDefinition[] {
        const mode = modeOf(config);
        const base = DEVICE_STATES.filter(d => mode !== 'adb' || !d.remoteOnly);
        return mode === 'remote' ? base : [...base, ...ADB_STATES];
    }

    private async createDeviceObjects(id: string, config: DeviceConfig): Promise<void> {
        const mode = modeOf(config);
        await this.extendObjectAsync(id, {
            type: 'device',
            common: {
                name: config.name || config.host,
                statusStates: { onlineId: `${this.namespace}.${id}.info.connected` },
            },
            native: { host: config.host, connection: mode },
        });
        const channels: [string, ioBroker.StringOrTranslated][] = [
            [
                'info',
                {
                    en: 'Information',
                    de: 'Informationen',
                    ru: 'Информация',
                    pt: 'Informação',
                    nl: 'Informatie',
                    fr: 'Informations',
                    it: 'Informazioni',
                    es: 'Información',
                    pl: 'Informacje',
                    uk: 'Інформація',
                    'zh-cn': '信息',
                },
            ],
            [
                'keys',
                {
                    en: 'Remote keys',
                    de: 'Fernbedienungstasten',
                    ru: 'Кнопки пульта',
                    pt: 'Teclas do comando',
                    nl: 'Afstandsbedieningstoetsen',
                    fr: 'Touches de la télécommande',
                    it: 'Tasti del telecomando',
                    es: 'Teclas del mando',
                    pl: 'Przyciski pilota',
                    uk: 'Кнопки пульта',
                    'zh-cn': '遥控按键',
                },
            ],
            [
                'apps',
                {
                    en: 'App favorites',
                    de: 'App-Favoriten',
                    ru: 'Избранные приложения',
                    pt: 'Aplicativos favoritos',
                    nl: 'App-favorieten',
                    fr: 'Applications favorites',
                    it: 'App preferite',
                    es: 'Aplicaciones favoritas',
                    pl: 'Ulubione aplikacje',
                    uk: 'Улюблені застосунки',
                    'zh-cn': '收藏的应用',
                },
            ],
        ];
        if (mode !== 'remote') {
            channels.push([
                'media',
                {
                    en: 'Media (via ADB)',
                    de: 'Medien (über ADB)',
                    ru: 'Медиа (через ADB)',
                    pt: 'Multimédia (via ADB)',
                    nl: 'Media (via ADB)',
                    fr: 'Médias (via ADB)',
                    it: 'Media (tramite ADB)',
                    es: 'Multimedia (vía ADB)',
                    pl: 'Multimedia (przez ADB)',
                    uk: 'Медіа (через ADB)',
                    'zh-cn': '媒体（通过 ADB）',
                },
            ]);
        }
        for (const [channel, name] of channels) {
            await this.extendObjectAsync(`${id}.${channel}`, { type: 'channel', common: { name }, native: {} });
        }
        for (const def of this.stateDefinitionsFor(config)) {
            await this.extendObjectAsync(`${id}.${def.id}`, { type: 'state', common: def.common, native: {} });
        }
        for (const btn of KEY_BUTTONS) {
            await this.extendObjectAsync(`${id}.keys.${btn.id}`, {
                type: 'state',
                common: { name: btn.name, type: 'boolean', role: btn.role, read: false, write: true },
                native: { key: btn.key },
            });
        }
        for (const [appId, app] of this.appsById) {
            await this.extendObjectAsync(`${id}.apps.${appId}`, {
                type: 'state',
                common: { name: app.name, type: 'boolean', role: 'button', read: false, write: true },
                native: { link: app.link },
            });
        }
    }

    /**
     * Deletes devices, states and channels that no longer apply (device removed, app removed, mode changed).
     *
     * @param deviceIds - Ids of all configured devices
     * @param configs - Device configurations (same order as ids were assigned)
     */
    private async removeStaleObjects(deviceIds: Set<string>, configs: DeviceConfig[]): Promise<void> {
        const prefix = `${this.namespace}.`;
        const range = (start: string): { startkey: string; endkey: string } => ({
            startkey: start,
            endkey: `${start}香`,
        });
        const devices = await this.getObjectViewAsync('system', 'device', range(prefix));
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
            const expected = new Set<string>([
                ...this.stateDefinitionsFor(config).map(d => d.id),
                ...KEY_BUTTONS.map(b => `keys.${b.id}`),
                ...[...this.appsById.keys()].map(a => `apps.${a}`),
            ]);
            const devPrefix = `${prefix}${id}.`;
            const states = await this.getObjectViewAsync('system', 'state', range(devPrefix));
            for (const row of states.rows) {
                const rel = row.id.slice(devPrefix.length);
                if (!expected.has(rel)) {
                    await this.delObjectAsync(row.id.slice(prefix.length));
                }
            }
            if (modeOf(config) === 'remote') {
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

    private onStateChange(fullId: string, state: ioBroker.State | null | undefined): void {
        if (!state || state.ack) {
            return;
        }
        const parts = fullId.slice(this.namespace.length + 1).split('.');
        const device = this.devices.get(parts[0]);
        if (!device) {
            return;
        }
        const command = parts.slice(1).join('.');
        this.handleCommand(device, command, state).catch((e: Error) =>
            this.log.warn(`${device.config.name || device.id}: command "${command}" failed: ${e.message}`),
        );
    }

    /**
     * Executes a user command (ack=false) on a device, using Remote v2 where possible and ADB otherwise.
     *
     * @param device - Target device
     * @param command - State id relative to the device
     * @param state - New state
     */
    private async handleCommand(device: DeviceRuntime, command: string, state: ioBroker.State): Promise<void> {
        const ack = (): void => void this.setState(`${device.id}.${command}`, { val: state.val, ack: true });

        if (command.startsWith('keys.')) {
            const btn = KEY_BUTTONS.find(b => b.id === command.slice(5));
            if (btn) {
                await this.sendKey(device, btn.key);
                ack();
            }
            return;
        }
        if (command.startsWith('apps.')) {
            const app = this.appsById.get(command.slice(5));
            if (app) {
                await this.launch(device, app.link);
                ack();
            }
            return;
        }
        switch (command) {
            case 'power':
                await this.setPower(device, !!state.val, ack);
                return;
            case 'muted':
                if (device.muted === !!state.val) {
                    ack();
                } else {
                    await this.sendKey(device, 'VOLUME_MUTE');
                    if (!device.remote?.isReady) {
                        ack(); // ADB has no mute feedback
                    }
                }
                return;
            case 'launchApp':
                if (typeof state.val === 'string' && state.val.trim()) {
                    await this.launch(device, state.val);
                    ack();
                }
                return;
            case 'sendKey': {
                const key = state.val === null || state.val === undefined ? '' : String(state.val);
                if (resolveKeyCode(key) === undefined) {
                    throw new Error(`unknown key "${key}"`);
                }
                await this.sendKey(device, key);
                ack();
                return;
            }
            case 'sendText':
                if (typeof state.val === 'string' && state.val !== '') {
                    if (device.remote?.isReady && device.config.enableIme !== false) {
                        device.remote.sendText(state.val);
                    } else if (device.adb?.isReady) {
                        await device.adb.sendText(state.val);
                    } else {
                        throw new Error('not connected');
                    }
                    ack();
                }
                return;
            default:
                this.log.debug(`Ignoring write to read-only or unknown state ${device.id}.${command}`);
        }
    }

    private async sendKey(device: DeviceRuntime, key: string): Promise<void> {
        if (device.remote?.isReady) {
            device.remote.sendKey(key);
            device.adb?.pollSoon(); // playback info reflects play/pause about 1 s later instead of up to one interval
        } else if (device.adb?.isReady) {
            await device.adb.sendKey(key);
        } else {
            throw new Error('not connected');
        }
    }

    /**
     * Starts an app: https deep links preferably via Remote v2, package names preferably via ADB.
     *
     * @param device - Target device
     * @param target - Deep link or package name
     */
    private async launch(device: DeviceRuntime, target: string): Promise<void> {
        // @KI_HINWEIS: Feldtest SHIELD: Remote v2 akzeptiert nur http(s)-Links, Paketnamen nur per ADB (monkey).
        const preferAdb = !isLink(target);
        if (preferAdb && device.adb?.isReady) {
            await device.adb.launch(target);
        } else if (device.remote?.isReady) {
            device.remote.launchApp(target);
            device.adb?.pollSoon();
        } else if (device.adb?.isReady) {
            await device.adb.launch(target);
        } else {
            throw new Error('not connected');
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
    private async setPower(device: DeviceRuntime, wanted: boolean, ack: () => void): Promise<void> {
        if (device.remote?.isReady) {
            // @KI_HINWEIS: Nur senden, wenn der vom TV gemeldete Zustand abweicht (Toggle-Taste).
            if (device.remote.isOn === wanted) {
                ack();
            } else {
                device.remote.sendKey('POWER');
            }
        } else if (device.adb?.isReady) {
            device.powerTarget = { value: wanted, until: Date.now() + 5_000 };
            await device.adb.setPower(wanted);
        } else if (wanted) {
            await this.wakeOnLan(device);
        } else {
            throw new Error('not connected');
        }
    }

    /**
     * Wakes an unreachable device (deep standby without network) with a magic packet and reconnects right away.
     *
     * @param device - Device
     */
    private async wakeOnLan(device: DeviceRuntime): Promise<void> {
        // @KI_HINWEIS: Feldtest Fire TV: Im tiefen Energiesparmodus schaltet das Gerät das Netzwerk ab, ADB und
        // Remote sind nicht erreichbar. Viele Geräte reagieren dann noch auf Wake-on-LAN (am Gerät einschalten).
        // @KI_HINWEIS: Die MAC lässt sich über ADB nicht zuverlässig lesen (Fire TV/SHIELD: /sys gesperrt, ip link
        // leer) und das TV-Zertifikat enthält ggf. die WLAN-MAC. Deshalb nur die MAC aus der Konfiguration.
        const mac = device.config.wolMac?.trim();
        if (!mac) {
            throw new Error(
                'not connected. To switch it on from deep standby, enter its MAC address in the instance settings (Wake-on-LAN)',
            );
        }
        const targets = wolTargets(device.config.host.trim(), device.config.wolBroadcast);
        const sent = await sendWakeOnLan(mac, targets);
        if (!sent) {
            throw new Error(`Wake-on-LAN could not be sent (${targets.join(', ')})`);
        }
        this.log.info(`${device.label}: not reachable, sent Wake-on-LAN to ${mac}`);
        device.wakePendingUntil = Date.now() + 90_000;
        device.remote?.reconnectNow();
        device.adb?.reconnectNow();
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
    private async setCurrentApp(id: string, app: string): Promise<void> {
        await this.setStateChangedAsync(`${id}.currentApp`, app, true);
        await this.setStateChangedAsync(
            `${id}.currentAppName`,
            appDisplayName(app, this.appsById.values(), this.uiLanguage),
            true,
        );
    }

    /**
     * Readable app name only while the screen is on (an app shown for a device in standby confuses).
     *
     * @param id - Device id
     * @param on - Screen state
     */
    private async refreshAppName(id: string, on: boolean): Promise<void> {
        if (this.appNamePower.get(id) === on) {
            return; // only on a change, not on every ADB poll
        }
        this.appNamePower.set(id, on);
        const app = on ? (await this.getStateAsync(`${id}.currentApp`))?.val : undefined;
        await this.setStateChangedAsync(
            `${id}.currentAppName`,
            typeof app === 'string' && app ? appDisplayName(app, this.appsById.values(), this.uiLanguage) : '',
            true,
        );
    }

    private text(key: MessageKey): string {
        return MESSAGES[key][this.uiLanguage];
    }

    private reply(obj: ioBroker.Message, payload: { result: string } | { error: string } | StatusText): void {
        if (obj.callback) {
            this.sendTo(obj.from, obj.command, payload, obj.callback);
        }
    }

    private async onMessage(obj: ioBroker.Message): Promise<void> {
        if (!obj || typeof obj !== 'object') {
            return;
        }
        if (typeof obj.command === 'string' && obj.command.startsWith('dm:')) {
            return; // handled by the Device Manager (dm-utils)
        }
        const msg = (obj.message ?? {}) as { host?: unknown; pin?: unknown; enabled?: unknown };
        const host = typeof msg.host === 'string' ? msg.host.trim() : '';
        try {
            switch (obj.command) {
                case 'startPairing':
                    await this.startPairing(host);
                    this.reply(obj, { result: this.text('pairingStarted') });
                    break;
                case 'finishPairing': {
                    const configured = await this.finishPairing(host, typeof msg.pin === 'string' ? msg.pin : '');
                    this.reply(obj, { result: this.text(configured ? 'pairingDone' : 'pairingDoneSave') });
                    break;
                }
                case 'deviceStatus':
                    this.reply(obj, this.deviceStatus(host, msg.enabled !== false));
                    return;
                default:
                    this.log.debug(`Unknown message command "${obj.command}"`);
            }
        } catch (e) {
            this.log.warn(`Pairing with ${host || '?'} failed: ${(e as Error).message}`);
            this.reply(obj, { error: this.errorText(e) });
        }
    }

    /**
     * Text (system language) for a pairing/command error.
     *
     * @param e - Thrown error
     */
    private errorText(e: unknown): string {
        const key: MessageKey =
            e instanceof PairingError
                ? e.code
                : e instanceof Error && e.message in MESSAGES
                  ? (e.message as MessageKey)
                  : 'closed';
        return this.text(key);
    }

    /**
     * Access of the Device Manager to the device logic.
     */
    private dmBridge(): DmBridge {
        return {
            ready: new Promise(resolve => (this.resolveReady = resolve)),
            devices: () => this.configured,
            statusText: id => {
                const device = this.devices.get(id);
                return device ? this.statusOf(device).text : undefined;
            },
            startPairing: host => this.startPairing(host),
            finishPairing: async (host, pin) => {
                const configured = await this.finishPairing(host, pin);
                return this.text(configured ? 'pairingDone' : 'pairingDoneSave');
            },
            cancelPairing: host => this.dropPairing(host),
            isRetryablePairingError: e =>
                e instanceof PairingError && (e.code === 'wrongPin' || e.code === 'invalidPin'),
            errorText: e => {
                this.log.warn(`Device manager: ${(e as Error)?.message ?? String(e)}`);
                return this.errorText(e);
            },
            reconnect: id => {
                const device = this.devices.get(id);
                if (!device) {
                    return false;
                }
                device.remote?.restart();
                device.adb?.reconnectNow();
                return true;
            },
            rawDevices: () => (Array.isArray(this.config.devices) ? this.config.devices.map(d => ({ ...d })) : []),
            saveDevices: devices => {
                // @KI_HINWEIS: Verzögert, damit die Antwort an die Oberfläche noch vor dem Neustart rausgeht
                // (updateConfig ändert native → js-controller startet die Instanz neu).
                this.log.info('Device list changed in the device manager - restarting instance');
                this.setTimeout(() => {
                    this.updateConfig({ devices }).catch((e: Error) =>
                        this.log.error(`Cannot save device list: ${e.message}`),
                    );
                }, 500);
            },
        };
    }

    /**
     * Status line for one device in the admin UI (`textSendTo`).
     *
     * @param host - Host as currently entered in the form (may be unsaved)
     * @param enabled - Checkbox value in the form
     */
    private deviceStatus(host: string, enabled: boolean): StatusText {
        const grey = { color: '#888888' };
        if (!host) {
            return { text: this.text('statusNoHost'), icon: 'connection', style: grey };
        }
        if (!enabled) {
            return { text: this.text('statusDisabled'), icon: 'no-connection', style: grey };
        }
        const device = [...this.devices.values()].find(d => d.config.host.trim() === host);
        if (!device) {
            return { text: this.text('statusUnsaved'), icon: 'pair', style: grey };
        }
        return this.statusOf(device);
    }

    /**
     * Current status of a running device (admin status line and state `info.status`).
     *
     * @param device - Device runtime
     */
    private statusOf(device: DeviceRuntime): StatusText {
        const green = { color: '#2e7d32' };
        const orange = { color: '#ed6c02' };
        const red = { color: '#d32f2f' };
        const adbPart = (): { key: MessageKey; style: { color: string } } =>
            device.adbConnected
                ? { key: 'statusAdbOk', style: green }
                : device.adbAuthPending
                  ? { key: 'statusAdbPending', style: orange }
                  : { key: device.mode === 'adb' ? 'statusAdbOffline' : 'statusInfoOffline', style: red };
        if (device.mode === 'adb') {
            const a = adbPart();
            return {
                text: this.text(a.key === 'statusAdbOk' ? 'statusConnected' : a.key),
                icon: device.adbConnected ? 'connection' : 'no-connection',
                style: a.style,
            };
        }
        let main: StatusText;
        if (device.remoteConnected) {
            main = { text: this.text('statusConnected'), icon: 'connection', style: green };
        } else if (device.pairingRequired) {
            main = { text: this.text('statusPairing'), icon: 'pair', style: orange };
        } else {
            main = { text: this.text('statusOffline'), icon: 'no-connection', style: red };
        }
        if (device.mode === 'remote_adb') {
            const a = adbPart();
            main.text = `${main.text} · ${this.text(a.key)}`;
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
    private async refreshStatus(device: DeviceRuntime): Promise<void> {
        await this.setStateChangedAsync(`${device.id}.info.status`, this.statusOf(device).text, true);
    }

    private async startPairing(host: string): Promise<void> {
        if (!host) {
            throw new Error('noHost');
        }
        if (!this.certificate) {
            throw new Error('noCertificate');
        }
        this.dropPairing(host);
        const session = new PairingSession({
            timers: this.adapterTimers,
            host,
            clientName: this.config.clientName?.trim() || 'ioBroker',
            certificate: this.certificate,
        });
        const pending: PendingPairing = { session, timer: undefined };
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
    private async finishPairing(host: string, pin: string): Promise<boolean> {
        if (!host) {
            throw new Error('noHost');
        }
        const pending = this.pairings.get(host);
        if (!pending?.session.isOpen) {
            this.dropPairing(host);
            throw new Error('noSession');
        }
        try {
            await pending.session.finish(pin);
        } catch (e) {
            // Wrong/mistyped code: the TV keeps the session open, the user may retry.
            if (!(e instanceof PairingError && (e.code === 'wrongPin' || e.code === 'invalidPin'))) {
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

    private dropPairing(host: string): void {
        const pending = this.pairings.get(host);
        if (pending) {
            this.clearTimeout(pending.timer);
            pending.session.close();
            this.pairings.delete(host);
        }
    }

    private onUnload(callback: () => void): void {
        try {
            for (const host of [...this.pairings.keys()]) {
                this.dropPairing(host);
            }
            for (const device of this.devices.values()) {
                device.remote?.stop();
                device.remote?.removeAllListeners();
                device.adb?.stop();
                device.adb?.removeAllListeners();
            }
            this.devices.clear();
            callback();
        } catch (error) {
            this.log.error(`Error during unloading: ${(error as Error).message}`);
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Androidtv(options);
} else {
    // otherwise start the instance directly
    (() => new Androidtv())();
}
