![Logo](admin/androidtv.png)

# ioBroker.androidtv

[![NPM version](https://img.shields.io/npm/v/iobroker.androidtv.svg)](https://www.npmjs.com/package/iobroker.androidtv)
[![Downloads](https://img.shields.io/npm/dm/iobroker.androidtv.svg)](https://www.npmjs.com/package/iobroker.androidtv)
![Number of Installations](https://iobroker.live/badges/androidtv-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/androidtv-stable.svg)

**Tests:** ![Test and Release](https://github.com/Schimi1983/ioBroker.androidtv/workflows/Test%20and%20Release/badge.svg)

## Android TV adapter for ioBroker

Control Android TV and Google TV devices – e.g. **NVIDIA SHIELD TV**, Chromecast with Google TV, Google TV Streamer and Android TVs from Sony, Philips, TCL and others – via the **Android TV Remote protocol v2**. This is the same protocol the official Google TV app uses on your phone.

Optionally the adapter also connects via **ADB (network debugging)** to read the media playback state (title, play/pause, position) and to start apps by package name. ADB alone also supports **Amazon Fire TV** devices, which lack the Android TV Remote protocol.

Deutsche Anleitung: [docs/de/README.md](docs/de/README.md)

### Features

- Power on/off with real power state (pushed by the TV, no polling)
- Currently running app (package name)
- Volume level and mute state
- All remote keys (D-pad, home, back, media keys, volume, …) as buttons or by name/code
- Launch apps by deep link or package name, configurable app favorites as buttons
- Text input into the focused text field
- Several TVs per instance
- Optional ADB: media state/title/subtitle/position, app start by package name (e.g. Kodi), Fire TV support
- Lightweight: one persistent connection per protocol and TV, automatic reconnect with backoff, no external binaries (no adb program needed), ADB polling only while the device is on

### Requirements

- Node.js ≥ 22, js-controller ≥ 6.0.11, admin ≥ 7.6.17
- The TV must have the system app **Android TV Remote Service** (pre-installed on almost all Android TV / Google TV devices, including the SHIELD)
- For the default connection: **no** developer options, **no** ADB, no cloud account
- ioBroker must reach the TV on TCP ports **6466** and **6467** (keep this in mind if the TV is in a separate VLAN)
- A fixed IP address (DHCP reservation) for the TV is recommended

### Connection types

Selectable per device:

| Connection | Requirements | Provides |
| --- | --- | --- |
| **Android TV Remote** (default) | one-time pairing with a code | power, current app, volume/mute, keys, app start by https link, text |
| **Android TV Remote + ADB** | pairing + network debugging | additionally `media.*` (state, title, subtitle, position) and app start by package name |
| **ADB only** | network debugging | power, current app, `media.*`, keys, apps, text – for **Fire TV** and devices without Android TV Remote Service |

**Enable network debugging** (developer options must be unlocked first: open *About* and click the build number 7 times):

- NVIDIA SHIELD: *Settings › Device Preferences › Developer options › Network debugging*
- Fire TV: *Settings › My Fire TV › Developer options › ADB debugging*

At the first ADB connection the TV asks *Allow debugging?* for the key `ioBroker@<host>`: tick **Always allow** and confirm. Until then `<device>.info.adbAuthorizationPending` is `true`.

> **Security:** with network debugging enabled, every device in your network can control the TV and install apps. Only enable it in a trusted network (e.g. a separate IoT VLAN with firewall rules; ADB uses TCP 5555, IPv4 and IPv6).

### Setup

1. Install the adapter and create an instance.
2. Tab **Devices**: add a TV with **+**, enter a name and its IP address and save.
3. Pair it once (same entry, the instance must be running): switch the TV on, click **Start pairing**, enter the 6-character code shown on the TV and click **Confirm code** within about one minute.
4. The status line of the entry shows *Connected* after a few seconds; `<device>.info.connected` becomes `true`.

Pairing is needed only once per TV. Repeat it after a factory reset of the TV or after clearing the data of the *Android TV Remote Service* app. If the TV no longer accepts the connection, `<device>.info.pairingRequired` is set to `true` and a warning is logged.

On the first start the adapter creates its own client certificate and stores it in the instance file storage (`androidtv.<instance>/client-certificate.json`, private key encrypted).

### States

All states are created per device below `androidtv.<instance>.<device>`.

| State | Type | Access | Description |
| --- | --- | --- | --- |
| `info.connected` | boolean | read | Connected to the TV |
| `info.pairingRequired` | boolean | read | The TV rejected this instance – pair again |
| `info.model`, `info.manufacturer`, `info.mac` | string | read | Reported by the TV |
| `info.remoteServiceVersion` | string | read | Version of the Android TV Remote Service |
| `power` | boolean | read/write | Screen on/off. Writing sends the power key only if the state differs |
| `currentApp` | string | read | Package of the foreground app, e.g. `com.netflix.ninja` (requires the option *Current app & text input*) |
| `volume`, `volumeMax` | number | read | Volume as reported by the TV (with HDMI-CEC/ARC the TV/receiver may handle the volume instead) |
| `muted` | boolean | read/write | Mute state, writing toggles mute if needed |
| `launchApp` | string | write | Deep link, e.g. `https://www.netflix.com/title` (package names are not accepted by every device, see below) |
| `sendKey` | string | write | Key name (`HOME`, `DPAD_UP`, `MEDIA_PLAY_PAUSE`, …, with or without `KEYCODE_`) or numeric Android key code |
| `sendText` | string | write | Text for the focused input field |
| `media.state` | string | read | `play`, `pause`, `stop`, `buffering`, `idle` (ADB only) |
| `media.title`, `media.subtitle`, `media.app` | string | read | Title, subtitle (artist/episode) and app of the active media session (ADB only) |
| `media.position` | number | read | Playback position in seconds at the last update by the app (ADB only) |
| `info.adbConnected`, `info.adbAuthorizationPending` | boolean | read | ADB connection state / confirmation on the TV pending |
| `keys.*` | button | write | home, back, menu, settings, up, down, left, right, ok, playPause, play, pause, stop, next, previous, fastForward, rewind, volumeUp, volumeDown, channelUp, channelDown, search, info |
| `apps.*` | button | write | One button per configured app favorite |

The list of key names follows [android.view.KeyEvent](https://developer.android.com/reference/android/view/KeyEvent).

### App links

Apps are started by **deep link**. Tested on an NVIDIA SHIELD (Android TV Remote Service 7.00):

| App | Link | SHIELD |
| --- | --- | --- |
| Netflix | `https://www.netflix.com/title` | ✔ |
| Prime Video | `https://app.primevideo.com` | ✔ |
| YouTube | `https://www.youtube.com` | ✔ |
| Disney+ | `https://www.disneyplus.com` | ✔ |

A value without scheme is treated as a package name and sent as `market://launch?id=<package>`. **The SHIELD rejects package names** (as well as `android-app://` and `intent:` links) and briefly closes the connection; the adapter reconnects within about 2 seconds and logs `TV rejected app link …`. Other devices may accept package names. Apps without an https deep link (e.g. Kodi) can be started by package name with an ADB connection (`Android TV Remote + ADB` or `ADB only`).

To find out which app is running, read `currentApp` (e.g. `com.netflix.ninja`, `com.amazon.amazonvideo.livingroom`, `com.disney.disneyplus`, `com.google.android.youtube.tv`).

### Troubleshooting

- **TV keeps showing "Use keyboard on mobile device"**: disable *Current app & text input* for this device (then `currentApp` and `sendText` are not available).
- **Keys or apps do not work at all / warning "TV does not offer key/app-link control"**: on the TV open *Settings › Apps › System apps › Android TV Remote Service › Clear data*, then pair again.
- **Power on does not work from deep standby**: some devices switch off their network in standby. On the SHIELD keep the default energy settings (network stays active in standby).
- **No connection from another VLAN**: allow TCP 6466/6467 from ioBroker to the TV (IPv4 and, if used, IPv6).

### Not (yet) supported

- Media duration and cover – not available via `dumpsys`
- ADB *wireless debugging* with pairing code (Android 11+ phones/tablets) – only classic network debugging (TCP 5555) is supported
- Absolute volume setting – use `keys.volumeUp` / `keys.volumeDown`
- Google Cast – use the [chromecast adapter](https://github.com/iobroker-community-adapters/ioBroker.chromecast)

### Credits

The protocol implementation is based on the public documentation of the Android TV Remote protocol v2 and the open source projects [androidtvremote2](https://github.com/tronikos/androidtvremote2) (Apache-2.0) and [androidtv-remote](https://github.com/louis49/androidtv-remote) (MIT). No code was copied; message definitions were re-implemented.

### Disclaimer

Android TV, Google TV and Chromecast are trademarks of Google LLC. NVIDIA and SHIELD are trademarks of NVIDIA Corporation. This adapter is not affiliated with, endorsed or supported by Google or NVIDIA. All product names are used only to describe compatibility.

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**

- (Schimi) initial release: Android TV Remote protocol v2 (pairing, power, current app, volume/mute, keys, app launch, text input)
- (Schimi) optional ADB connection: media state/title/position, app start by package name, Fire TV support (ADB only)

## License

MIT License

Copyright (c) 2026 Schimi <szymon.haiduk@world-mg.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
