![Logo](admin/androidtv.png)

# ioBroker.androidtv

[![NPM version](https://img.shields.io/npm/v/iobroker.androidtv.svg)](https://www.npmjs.com/package/iobroker.androidtv)
[![Downloads](https://img.shields.io/npm/dm/iobroker.androidtv.svg)](https://www.npmjs.com/package/iobroker.androidtv)
![Number of Installations](https://iobroker.live/badges/androidtv-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/androidtv-stable.svg)

**Tests:** ![Test and Release](https://github.com/Schimi1983/ioBroker.androidtv/workflows/Test%20and%20Release/badge.svg)

## Android TV adapter for ioBroker

Control Android TV and Google TV devices – e.g. **NVIDIA SHIELD TV**, Chromecast with Google TV, Google TV Streamer and Android TVs from Sony, Philips, TCL and others – via the **Android TV Remote protocol v2**. This is the same protocol the official Google TV app uses on your phone.

Deutsche Anleitung: [docs/de/README.md](docs/de/README.md)

### Features

- Power on/off with real power state (pushed by the TV, no polling)
- Currently running app (package name)
- Volume level and mute state
- All remote keys (D-pad, home, back, media keys, volume, …) as buttons or by name/code
- Launch apps by deep link or package name, configurable app favorites as buttons
- Text input into the focused text field
- Several TVs per instance
- Lightweight: one persistent TLS connection per TV, automatic reconnect with backoff, no external binaries

### Requirements

- Node.js ≥ 22, js-controller ≥ 6.0.11, admin ≥ 7.6.17
- The TV must have the system app **Android TV Remote Service** (pre-installed on almost all Android TV / Google TV devices, including the SHIELD)
- **No** developer options, **no** ADB, no cloud account
- ioBroker must reach the TV on TCP ports **6466** and **6467** (keep this in mind if the TV is in a separate VLAN)
- A fixed IP address (DHCP reservation) for the TV is recommended

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
| `launchApp` | string | write | Deep link (`https://www.netflix.com/title`) or package name (`org.xbmc.kodi`) |
| `sendKey` | string | write | Key name (`HOME`, `DPAD_UP`, `MEDIA_PLAY_PAUSE`, …, with or without `KEYCODE_`) or numeric Android key code |
| `sendText` | string | write | Text for the focused input field |
| `keys.*` | button | write | home, back, menu, settings, up, down, left, right, ok, playPause, play, pause, stop, next, previous, fastForward, rewind, volumeUp, volumeDown, channelUp, channelDown, search, info |
| `apps.*` | button | write | One button per configured app favorite |

The list of key names follows [android.view.KeyEvent](https://developer.android.com/reference/android/view/KeyEvent).

### App links

A package name is started as `market://launch?id=<package>`. Some apps react better to their own deep link. Defaults:

| App | Link |
| --- | --- |
| Netflix | `https://www.netflix.com/title` |
| Prime Video | `https://app.primevideo.com` |
| YouTube | `https://www.youtube.com` |
| Disney+ | `https://www.disneyplus.com` |
| Kodi | `org.xbmc.kodi` |

To find the package name of an app: start the app on the TV and read `currentApp`.

### Troubleshooting

- **TV keeps showing "Use keyboard on mobile device"**: disable *Current app & text input* for this device (then `currentApp` and `sendText` are not available).
- **Keys or apps do not work at all / warning "TV does not offer key/app-link control"**: on the TV open *Settings › Apps › System apps › Android TV Remote Service › Clear data*, then pair again.
- **Power on does not work from deep standby**: some devices switch off their network in standby. On the SHIELD keep the default energy settings (network stays active in standby).
- **No connection from another VLAN**: allow TCP 6466/6467 from ioBroker to the TV (IPv4 and, if used, IPv6).

### Not (yet) supported

- Media title/artist/position – the protocol does not provide them (planned as optional ADB extension)
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
