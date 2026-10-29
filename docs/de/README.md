# ioBroker.androidtv – Anleitung

Steuert Android-TV- und Google-TV-Geräte (z. B. **NVIDIA SHIELD TV**, Chromecast mit Google TV, Google TV Streamer, Android-Fernseher von Sony, Philips, TCL …) über das **Android TV Remote Protokoll v2** – dasselbe Protokoll wie die Google-TV-App auf dem Handy.

## Voraussetzungen

- Node.js ≥ 22, js-controller ≥ 6.0.11, Admin ≥ 7.6.17
- Auf dem TV die System-App **Android TV Remote Service** (fast immer vorinstalliert, auch auf der SHIELD)
- **Keine** Entwickleroptionen, **kein** ADB, kein Cloud-Konto
- ioBroker muss den TV auf TCP **6466** und **6467** erreichen (bei getrenntem IoT-VLAN Firewall-Regel für IPv4 und ggf. IPv6 anlegen)
- Feste IP-Adresse (DHCP-Reservierung) für den TV empfohlen

## Einrichtung

1. Adapter installieren, Instanz anlegen.
2. Reiter **Geräte**: TV mit Namen und IP-Adresse eintragen, speichern.
3. Reiter **Kopplung** (Instanz muss laufen):
    1. TV einschalten, IP-Adresse eintragen, **Kopplung starten** klicken.
    2. Der TV zeigt einen 6-stelligen Code. Code eingeben und innerhalb etwa einer Minute **Kopplung abschließen** klicken.
4. Nach wenigen Sekunden steht `<Gerät>.info.connected` auf `true`.

Die Kopplung ist pro TV nur einmal nötig – erneut nach Werksreset oder nach „Daten löschen“ beim *Android TV Remote Service*. Lehnt der TV die Verbindung ab, wird `<Gerät>.info.pairingRequired` auf `true` gesetzt und eine Warnung geloggt.

Beim ersten Start erzeugt der Adapter ein eigenes Client-Zertifikat (verschlüsselt in der Instanzkonfiguration) und startet danach einmal neu – das ist normal.

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
| `launchApp` | schreiben | Deep Link (`https://www.netflix.com/title`) oder Paketname (`org.xbmc.kodi`) |
| `sendKey` | schreiben | Tastenname (`HOME`, `DPAD_UP`, `MEDIA_PLAY_PAUSE` …) oder Android-Keycode |
| `sendText` | schreiben | Text ins aktive Eingabefeld |
| `keys.*` | Button | Home, Zurück, Menü, Einstellungen, Steuerkreuz, OK, Medientasten, Lautstärke, Kanal, Suche, Info |
| `apps.*` | Button | Ein Button je App-Favorit |

## App-Favoriten

Paketnamen werden als `market://launch?id=<paket>` gestartet; manche Apps reagieren besser auf ihren Deep Link. Paketnamen herausfinden: App am TV starten und `currentApp` ablesen.

## Fehlerbehebung

- **TV zeigt ständig „Tastatur auf Mobilgerät verwenden“**: Option „Aktuelle App & Texteingabe“ für das Gerät abschalten.
- **Tasten/Apps gehen nicht, Warnung „TV does not offer key/app-link control“**: am TV *Einstellungen › Apps › System-Apps › Android TV Remote Service › Daten löschen*, dann neu koppeln.
- **Einschalten aus dem Standby klappt nicht**: Gerät schaltet im Standby das Netzwerk ab; bei der SHIELD Energie-Einstellungen auf Standard lassen.

## Noch nicht unterstützt

- Titel/Interpret/Position (liefert das Protokoll nicht; geplant als optionale ADB-Erweiterung)
- Lautstärke absolut setzen (stattdessen `keys.volumeUp`/`keys.volumeDown`)
- Google Cast (dafür den chromecast-Adapter nutzen)
