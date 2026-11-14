![Logo](admin/androidtv.png)

# ioBroker.androidtv

[![NPM version](https://img.shields.io/npm/v/iobroker.androidtv.svg)](https://www.npmjs.com/package/iobroker.androidtv)
[![Downloads](https://img.shields.io/npm/dm/iobroker.androidtv.svg)](https://www.npmjs.com/package/iobroker.androidtv)
![Number of Installations](https://iobroker.live/badges/androidtv-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/androidtv-stable.svg)

**Tests:** ![Test and Release](https://github.com/Schimi1983/ioBroker.androidtv/workflows/Test%20and%20Release/badge.svg)

**🇩🇪 Deutsche Anleitung: [docs/de/README.md](docs/de/README.md)**

Control your **NVIDIA SHIELD**, other **Android TV / Google TV** devices and **Amazon Fire TV** from ioBroker: switch them on and off, start apps, press remote buttons and see what is playing.

Product pages: [NVIDIA SHIELD TV](https://www.nvidia.com/en-us/shield/), [Android TV / Google TV](https://www.android.com/tv/), [Amazon Fire TV](https://www.amazon.com/firetv).

## What you can do

- Switch the device on and off and see whether it is on
- See which app is running
- Start apps with one click (Netflix, YouTube, Prime Video, Disney+, …)
- Press any button of the remote control (home, back, arrows, play/pause, volume, …)
- Type text into search fields
- See what is playing: title, play/pause and position (optional, see step 2b)

## Requirements

- ioBroker with Node.js 22 or newer, js-controller 6.0.11 or newer and Admin 7.6.20 or newer
- The device is in your home network and ioBroker can reach it (separate networks or a firewall: see [Technical details](#technical-details))
- No cloud account and no extra app needed

## Which device type do I choose?

| Your device | Device type in the settings | What you do once |
| --- | --- | --- |
| NVIDIA SHIELD, Chromecast with Google TV, Google TV Streamer, TVs with Android TV / Google TV (Sony, Philips, TCL, …) | **Android TV / Google TV** | enter a code shown on the TV |
| same, and you also want to see title and play/pause | **Android TV / Google TV + playback info** | enter a code + switch on one setting on the device |
| Amazon Fire TV (stick, cube, TVs with Fire TV) | **Amazon Fire TV** | switch on one setting on the device |

## Setup step by step

### 1. Add the device

1. Install the adapter and open the instance settings.
2. Tab **Devices**: click **+**.
3. Enter a **name** (e.g. "Living room") and the **IP address** of the device. You find it in the network settings of the device.
   Tip: give the device a fixed IP address in your router, otherwise it may get a different one later.
4. Choose the **device type** (see table above) and click **Save**.

### 2a. Android TV / Google TV / SHIELD: pair once

1. Switch the device on.
2. In the device entry click **Start pairing**. A 6-character code appears on the TV.
3. Enter the code and click **Confirm code** (within about one minute).

Done – the status in the entry shows **Connected**. You only have to do this once (again only after resetting the device).

### 2b. Optional: show title and play/pause

Choose the device type **Android TV / Google TV + playback info** and switch on *network debugging* on the device:

1. On the SHIELD open **Settings › Device Preferences › Developer options** and switch on **Network debugging**.
   If there are no developer options: open **Settings › Device Preferences › About** and click **Build** 7 times.
2. Save the adapter settings.
3. The TV asks **"Allow debugging?"** – tick **Always allow** and confirm.

The status shows **Connected · playback info active**.

### 2c. Amazon Fire TV

1. On the Fire TV open **Settings › My Fire TV › Developer options** and switch on **ADB debugging**.
   If there are no developer options: open **Settings › My Fire TV › About** and click the device name 7 times.
2. Choose the device type **Amazon Fire TV** and save.
3. The TV asks **"Allow USB debugging?"** – tick **Always allow from this computer** and confirm.

The status shows **Connected**. No code is needed for a Fire TV.

> **Note on debugging (2b and 2c):** while debugging is switched on, other devices in your home network can access the TV as well. Only use it in your own, trusted network.

### 3. Optional: switch on from deep standby (Wake-on-LAN)

Some devices (e.g. Fire TV) switch off their network in deep standby. ioBroker can still wake them:

1. On the device switch on **Wake on LAN** or **network standby** (the name depends on the device).
2. In the device entry enter the **MAC address**. Take it from your router's device list; with a cable connection it is the MAC of the LAN port.

## Using the adapter

Each device appears in the objects as `androidtv.0.<name>`. The most important data points:

| What | Data point |
| --- | --- |
| Switch on / off, is it on? | `power` (true = on) |
| Which app is running? | `currentApp` (app ID, e.g. `com.netflix.ninja`) |
| Start an app | buttons in `apps` (e.g. `apps.Netflix`) |
| Remote control buttons | buttons in `keys` (e.g. `keys.home`, `keys.playPause`, `keys.volumeUp`) |
| Type text | write the text to `sendText` |
| What is playing? (with playback info / Fire TV) | `media.title`, `media.state` (play / pause), `media.position` (seconds) |
| Connected? | `info.connected`, readable status in `info.status` |

Use these data points in scripts, Blockly, scenes or visualizations like any other data point. Example: write `false` to `power` to switch the TV off at night.

## App favorites

In the tab **App favorites** you choose which app buttons are created for every device. Enter a name and the app's **web link** or its **app ID**.

| App | Android TV / SHIELD | Fire TV |
| --- | --- | --- |
| Netflix | `https://www.netflix.com/title` | `https://www.netflix.com/title` |
| YouTube | `https://www.youtube.com` | `https://www.youtube.com` |
| Disney+ | `https://www.disneyplus.com` | `https://www.disneyplus.com` |
| Prime Video | `https://app.primevideo.com` | `com.amazon.firebat` |
| Amazon Music | – | `com.amazon.bueller.music` |
| Emby | `com.mb.android` (with *+ playback info*) | `com.mb.android` |

- A web link opens the matching app directly.
- An app ID works on a Fire TV and with the device type *+ playback info*.
- If a link would only open the web browser, the adapter does not start it and writes a hint to the log – use the app ID instead.

**Find the app ID:** start the app on the TV with the remote and read `currentApp`.

Tip: a link can also open a specific video, e.g. `https://www.youtube.com/watch?v=…`. YouTube may ask for the profile first.

## Problems & solutions

- **Status "Pairing required"**: switch the device on and pair again (step 2a). This is needed after resetting the device.
- **"The device cannot be reached for pairing"**: check the IP address and that the device is on. A Fire TV cannot be paired – choose the device type *Amazon Fire TV*.
- **Status "Please confirm Allow debugging on the TV"**: confirm the question on the TV screen and tick *Always allow*.
- **Status "Not connected"**: the device is off, unplugged or not reachable. The adapter reconnects automatically as soon as it is back.
- **The device cannot be switched on from ioBroker after a while**: it is in deep standby without network – set up Wake-on-LAN (step 3). Take the MAC address from your router, not from `info.mac`: the device may report the MAC of its Wi-Fi even when it is connected by cable. If ioBroker and the TV are in different networks, enter the broadcast address of the TV network in the expert settings (e.g. `192.168.20.255`).
- **"Shut down" in the device menu**: this switches the device off completely, not to standby. It can then only be switched on with its own remote or power button.
- **The SHIELD switches itself on again right after switching it off**: the TV wakes it via HDMI-CEC while it still shows the SHIELD's HDMI input. Switch the TV to another input or app first, or switch off the TV – the SHIELD then goes to standby by itself.
- **The TV keeps showing "Use keyboard on mobile device"**: switch on the expert mode in the instance settings and untick *Current app & text input* for this device.
- **An app button does nothing**: some apps cannot be started by app ID on a SHIELD without playback info. Use the web link or choose *+ playback info*.
- **Volume shows nothing**: if the volume is controlled by your TV or AV receiver (HDMI-CEC), the device cannot report it. The volume buttons still work.
- **Prime Video shows only "PrimeVideo" as title**: the app does not pass the title of the film to the system. Play/pause and position work.

## Technical details

<details>
<summary>For advanced users</summary>

### Connections

- **Android TV / Google TV**: Android TV Remote protocol v2 (the protocol of the Google TV app), TCP 6466/6467, TLS with a client certificate created by the adapter. Requires the system app *Android TV Remote Service* (pre-installed on almost all Android TV devices; missing on Fire TV). Power, current app and volume are pushed by the device – no polling.
- **Playback info / Fire TV**: ADB network debugging, TCP 5555 (classic, not "wireless debugging" with pairing code). Implemented in the adapter, no adb program needed. The device is polled only while it is on (default every 5 s, option *Update playback info every*); one shell call per poll.
- Commands are routed automatically: web links and keys via the remote protocol (fast), app IDs via ADB. Keys via ADB take about 1 s on a Fire TV.
- The client certificate and the ADB key are stored encrypted in the instance file storage (`androidtv.0/client-certificate.json`, `androidtv.0/adb-key.json`).
- Firewall / VLAN: ioBroker must reach the device on TCP 6466, 6467 (remote) and/or 5555 (ADB), IPv4 and IPv6 if used. Wake-on-LAN sends UDP packets to port 9 (broadcast and device IP).
- Reconnect: after 2 s, then doubling up to the *maximum reconnect interval* (expert option, default 60 s). Connection errors are only logged at debug level. A device that stays unreachable for 30 s is set to `power = false`.

### All data points per device

| State | Type | Access | Description |
| --- | --- | --- | --- |
| `info.connected` | boolean | read | Connected |
| `info.status` | string | read | Readable connection status |
| `info.pairingRequired` | boolean | read | The device rejects this instance – pair again |
| `info.model`, `info.manufacturer`, `info.mac`, `info.remoteServiceVersion` | string | read | Reported by the device (`info.mac` may be the Wi-Fi MAC) |
| `info.adbConnected`, `info.adbAuthorizationPending` | boolean | read | ADB connected / confirmation on the TV pending |
| `power` | boolean | read/write | Screen on/off |
| `currentApp` | string | read | Package of the foreground app |
| `volume`, `volumeMax` | number | read | Volume as reported by the device (`null` if controlled via HDMI-CEC) |
| `muted` | boolean | read/write | Mute |
| `launchApp` | string | write | Web link or app ID |
| `sendKey` | string | write | Key name (`HOME`, `DPAD_UP`, `MEDIA_PLAY_PAUSE`, …, see [Android KeyEvent](https://developer.android.com/reference/android/view/KeyEvent)) or key code |
| `sendText` | string | write | Text for the focused input field |
| `media.state` | string | read | `play`, `pause`, `stop`, `buffering`, `idle` |
| `media.title`, `media.subtitle`, `media.app` | string | read | Title, subtitle (artist/channel/episode), app of the playback |
| `media.position` | number | read | Position in seconds |
| `keys.*` | button | write | home, back, menu, settings, up, down, left, right, ok, playPause, play, pause, stop, next, previous, fastForward, rewind, volumeUp, volumeDown, channelUp, channelDown, search, info |
| `apps.*` | button | write | One button per app favorite |

### Known limitations

- The SHIELD accepts only web links via the remote protocol; app IDs (`market://`, `android-app://`, `intent:`) are rejected and the connection is briefly closed. With playback info enabled they are started via ADB instead.
- Title and subtitle come from the app's media session. Apps that do not fill it show only their name (e.g. Prime Video on Fire TV and SHIELD: "PrimeVideo") or nothing.
- Media duration and cover are not available.
- Absolute volume cannot be set (use `keys.volumeUp` / `keys.volumeDown`).
- Google Cast is not supported – use the [chromecast adapter](https://github.com/iobroker-community-adapters/ioBroker.chromecast).

</details>

## Credits

The remote protocol implementation is based on the public documentation of the Android TV Remote protocol v2 and the projects [androidtvremote2](https://github.com/tronikos/androidtvremote2) (Apache-2.0) and [androidtv-remote](https://github.com/louis49/androidtv-remote) (MIT). The ADB implementation follows the protocol description of the Android Open Source Project. No code was copied.

## Disclaimer

Android TV, Google TV and Chromecast are trademarks of Google LLC. NVIDIA and SHIELD are trademarks of NVIDIA Corporation. Amazon and Fire TV are trademarks of Amazon.com, Inc. This adapter is not affiliated with, endorsed or supported by Google, NVIDIA or Amazon. All product names are used only to describe compatibility.

## Support

The adapter is free and stays free. If it is useful to you and you want to say thanks, you can support the development:

[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-Schimi1983-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/Schimi1983)
[![PayPal](https://img.shields.io/badge/PayPal-Donate-00457C?logo=paypal&logoColor=white)](https://paypal.me/Schimi1983)

Bug reports and ideas in the [issues](https://github.com/Schimi1983/ioBroker.androidtv/issues) help just as much. Questions and test reports: [ioBroker forum](https://forum.iobroker.net/topic/85827/test-adapter-androidtv-v0.2.x-latest).

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**

- (Schimi) Documentation: requirements, Wake-on-LAN as its own step, tips for HDMI-CEC and Prime Video; German guide linked in the adapter information

### 0.2.3 (2026-11-12)

- (Schimi) Device and app IDs are now unique regardless of upper/lower case
- (Schimi) Reconnect interval, playback update interval and ADB port are checked in the adapter, not only in the settings page
- (Schimi) README: links to the supported products
- (Schimi) Pairing and connection status texts in all 11 languages (was English/German only)
- (Schimi) The object for the internal files is now created from io-package.json

### 0.2.2 (2026-10-31)

- (Schimi) Object names translated into all 11 languages

### 0.2.1 (2026-10-31)

- (Schimi) Clearer error text for an invalid MAC address, translated into all languages
- (Schimi) Fast forward and rewind buttons use the official roles `button.fastforward` / `button.fastreverse`

### 0.2.0 (2026-10-29)

- (Schimi) Wake-on-LAN: `power` = on also switches on devices in deep standby without network (enter the MAC address in the device settings; optional broadcast address in the expert settings)
- (Schimi) Faster reconnect after Wake-on-LAN

### 0.1.2 (2026-10-29)

- (Schimi) Repository checker: removed news entry of the unpublished version 0.0.1, added CHANGELOG_OLD.md

Older changes: [CHANGELOG_OLD.md](CHANGELOG_OLD.md)

## License

MIT License

Copyright (c) 2026 Schimi <github@world-mg.de>

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
