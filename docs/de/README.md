# ioBroker.androidtv – Anleitung

Steuert Android-TV- und Google-TV-Geräte (z. B. **NVIDIA SHIELD TV**, Chromecast mit Google TV, Google TV Streamer, Android-Fernseher von Sony, Philips, TCL …) über das **Android TV Remote Protokoll v2** – dasselbe Protokoll wie die Google-TV-App auf dem Handy.

Optional verbindet sich der Adapter zusätzlich per **ADB (Netzwerk-Debugging)**, um Wiedergabestatus, Titel und Position zu lesen und Apps per Paketname zu starten. Nur mit ADB werden auch **Amazon Fire TV**-Geräte unterstützt.

## Verbindungsarten (je Gerät)

| Verbindung | Voraussetzung | Liefert |
| --- | --- | --- |
| **Android TV Remote** (Standard) | einmalige Kopplung mit Code | Ein/Aus, aktuelle App, Lautstärke/Stumm, Tasten, App-Start per https-Link, Text |
| **Android TV Remote + ADB** | Kopplung + Netzwerk-Debugging | zusätzlich `media.*` (Status, Titel, Untertitel, Position) und App-Start per Paketname |
| **Nur ADB** | Netzwerk-Debugging | Ein/Aus, aktuelle App, `media.*`, Tasten, Apps, Text – für **Fire TV** und Geräte ohne Android TV Remote Service |

**Netzwerk-Debugging aktivieren** (vorher Entwickleroptionen freischalten: unter *Info* 7× auf die Build-Nummer klicken):

- NVIDIA SHIELD: *Einstellungen › Geräteeinstellungen › Entwickleroptionen › Netzwerk-Debugging*
- Fire TV: *Einstellungen › Mein Fire TV › Entwickleroptionen › ADB-Debugging*

Beim ersten ADB-Verbindungsaufbau fragt der TV *Debugging zulassen?* für den Schlüssel `ioBroker@<Host>`: **Immer zulassen** anhaken und bestätigen. Bis dahin steht `<Gerät>.info.adbAuthorizationPending` auf `true`.

> **Sicherheit:** Mit aktivem Netzwerk-Debugging kann jedes Gerät im Netz den TV steuern und Apps installieren. Nur in einem vertrauenswürdigen Netz aktivieren (z. B. eigenes IoT-VLAN mit Firewall-Regeln; ADB nutzt TCP 5555, IPv4 und IPv6).

## Voraussetzungen

- Node.js ≥ 22, js-controller ≥ 6.0.11, Admin ≥ 7.6.17
- Auf dem TV die System-App **Android TV Remote Service** (fast immer vorinstalliert, auch auf der SHIELD)
- Für die Standard-Verbindung: **keine** Entwickleroptionen, **kein** ADB, kein Cloud-Konto
- ioBroker muss den TV auf TCP **6466** und **6467** erreichen (bei getrenntem IoT-VLAN Firewall-Regel für IPv4 und ggf. IPv6 anlegen)
- Feste IP-Adresse (DHCP-Reservierung) für den TV empfohlen

## Einrichtung

1. Adapter installieren, Instanz anlegen.
2. Reiter **Geräte**: TV mit **+** hinzufügen, Namen und IP-Adresse eintragen, speichern.
3. Einmalig koppeln (im selben Eintrag, Instanz muss laufen): TV einschalten, **Kopplung starten** klicken, den 6-stelligen Code vom TV eingeben und innerhalb etwa einer Minute **Code bestätigen** klicken.
4. Die Statuszeile im Eintrag zeigt nach wenigen Sekunden *Verbunden*; `<Gerät>.info.connected` steht auf `true`.

Die Kopplung ist pro TV nur einmal nötig – erneut nach Werksreset oder nach „Daten löschen“ beim *Android TV Remote Service*. Lehnt der TV die Verbindung ab, wird `<Gerät>.info.pairingRequired` auf `true` gesetzt und eine Warnung geloggt.

Beim ersten Start erzeugt der Adapter ein eigenes Client-Zertifikat und legt es im Dateispeicher der Instanz ab (`androidtv.<Instanz>/client-certificate.json`, privater Schlüssel verschlüsselt).

## Datenpunkte (je Gerät)

| Datenpunkt | Zugriff | Bedeutung |
| --- | --- | --- |
| `info.connected` | lesen | Verbindung zum TV steht |
| `info.pairingRequired` | lesen | TV lehnt die Instanz ab – neu koppeln |
| `info.model`, `info.manufacturer`, `info.mac`, `info.remoteServiceVersion` | lesen | Vom TV gemeldet |
| `power` | lesen/schreiben | Bildschirm an/aus; die Power-Taste wird nur gesendet, wenn der Zustand abweicht |
| `currentApp` | lesen | Paketname der App im Vordergrund (Option „Aktuelle App & Texteingabe“ nötig) |
| `volume`, `volumeMax` | lesen | Lautstärke laut TV (bei HDMI-CEC/ARC regelt ggf. TV/AVR) |
| `muted` | lesen/schreiben | Stummschaltung |
| `launchApp` | schreiben | Deep Link, z. B. `https://www.netflix.com/title` (Paketnamen nimmt nicht jedes Gerät an) |
| `sendKey` | schreiben | Tastenname (`HOME`, `DPAD_UP`, `MEDIA_PLAY_PAUSE` …) oder Android-Keycode |
| `sendText` | schreiben | Text ins aktive Eingabefeld |
| `media.state` | lesen | `play`, `pause`, `stop`, `buffering`, `idle` (nur mit ADB) |
| `media.title`, `media.subtitle`, `media.app` | lesen | Titel, Untertitel (Interpret/Folge) und App der aktiven Wiedergabe (nur mit ADB) |
| `media.position` | lesen | Position in Sekunden beim letzten Update der App (nur mit ADB) |
| `info.adbConnected`, `info.adbAuthorizationPending` | lesen | ADB verbunden / Bestätigung am TV ausstehend |
| `keys.*` | Button | Home, Zurück, Menü, Einstellungen, Steuerkreuz, OK, Medientasten, Lautstärke, Kanal, Suche, Info |
| `apps.*` | Button | Ein Button je App-Favorit |

## App-Favoriten

Apps werden per **Deep Link** gestartet. An einer NVIDIA SHIELD (Remote-Dienst 7.00) getestet: Netflix `https://www.netflix.com/title`, Prime Video `https://app.primevideo.com`, YouTube `https://www.youtube.com`, Disney+ `https://www.disneyplus.com`.

Ein Wert ohne Schema gilt als Paketname und wird als `market://launch?id=<paket>` gesendet. **Die SHIELD lehnt Paketnamen ab** (ebenso `android-app://` und `intent:`) und trennt kurz die Verbindung; der Adapter verbindet sich nach etwa 2 s neu und loggt `TV rejected app link …`. Andere Geräte akzeptieren Paketnamen eventuell. Apps ohne https-Deep-Link (z. B. Kodi) lassen sich mit ADB-Verbindung per Paketname starten. Welche App läuft, zeigt `currentApp`.

## Fehlerbehebung

- **TV zeigt ständig „Tastatur auf Mobilgerät verwenden“**: Option „Aktuelle App & Texteingabe“ für das Gerät abschalten.
- **Tasten/Apps gehen nicht, Warnung „TV does not offer key/app-link control“**: am TV *Einstellungen › Apps › System-Apps › Android TV Remote Service › Daten löschen*, dann neu koppeln.
- **Einschalten aus dem Standby klappt nicht**: Gerät schaltet im Standby das Netzwerk ab; bei der SHIELD Energie-Einstellungen auf Standard lassen.

## Noch nicht unterstützt

- Dauer und Cover der Wiedergabe (über `dumpsys` nicht verfügbar)
- ADB *Wireless Debugging* mit Kopplungscode (Android 11+ Smartphones) – nur klassisches Netzwerk-Debugging (TCP 5555)
- Lautstärke absolut setzen (stattdessen `keys.volumeUp`/`keys.volumeDown`)
- Google Cast (dafür den chromecast-Adapter nutzen)
