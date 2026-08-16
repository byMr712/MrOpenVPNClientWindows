# MrOpenVPN Client for Windows

> **Language:** English · [Русский](README.md)

Desktop client **MrOpenVPN Client** for Windows 10/11 — an **Electron** port of
the same-named Android app, with the same interface and behaviour.
This folder contains the sources, build tooling and everything needed to rebuild it.

## Credits

- **Android original:** [Mr712](https://github.com/byMr712?tab=repositories) —
  a fork of **ics-openvpn** (core: Arne Schwabe).
- **Windows port:** [Mr712](https://github.com/byMr712?tab=repositories).
- The Windows version is an independent implementation of the same interface and
  logic on Electron (it contains no Android/Kotlin code). The VPN engine is the
  official **OpenVPN 2.6.13** for Windows. Nothing was "ported" from the Android
  app — only the look, the screen set and the behaviour were recreated.

## Disclaimer

This application is provided **as is**, without warranties of any kind, either
express or implied, including, but not limited to, the implied warranties of
merchantability, fitness for a particular purpose and non-infringement.

- Use at your own risk. The author is **not responsible** for data loss, system
  crashes, downtime, or any other consequences of using this application.
- Connecting the VPN requires administrator rights — the app requests them
  properly through UAC (analogous to the VPN permission dialog on Android).
- There is no guarantee that the app will work on your specific hardware or
  Windows version. Support is provided on a "best effort" basis only.

## License & attribution

- **MrOpenVPN Client for Windows** is released under the **GNU GPL v3**.
  Full license text: [`LICENSE`](LICENSE).
- The Android original (an ics-openvpn fork) is **GNU GPL v3**, by [Mr712](https://github.com/byMr712?tab=repositories).
- Attribution and the list of bundled components: [`NOTICE`](NOTICE).
- Bundled third-party components (`bin/`) — see
  [Bundled component licenses](#bundled-component-licenses) and the `licenses/` folder.

## Requirements

- **Windows 10 / 11, x64.**
- The **Wintun** driver is required for VPN (wintun.dll ships with the app and is
  installed automatically on the first connect under an administrator).
- The app uses its own bundled `openvpn.exe`; a separate OpenVPN install is **not** needed.

## Folder contents

| Path | Description |
|---|---|
| `build.bat` | Build script for the single-file portable EXE (all paths are relative to the project root; output goes to `dist\`) |
| `src/main.js` | Electron main process: window, tray, IPC, VPN engine wiring |
| `src/preload.js` | contextBridge API for the renderer |
| `src/renderer/` | The whole UI: `index.html`, `css/`, `js/`, `js/views/` |
| `src/vpn/` | Engine: `engine.js` (management protocol), `parser.js` (.ovpn), `store.js` (persistence) |
| `bin/` | Bundled VPN runtime: `openvpn.exe`, DLLs, `wintun.dll` |
| `assets/` | Icons and fonts (Roboto, woff2 subsets) |
| `tests/` | Tests: `unit.js` (parser + store), `engine.js` (integration) |
| `scripts/make-icon.ps1` | Generates `assets/icon.png` (square icon) |
| `LICENSE` | GNU GPL v3 (application) |
| `NOTICE` | Attribution and modification notices |
| `licenses/` | Licenses of all bundled third-party components |
| `README.md` | README in Russian (default) |
| `README.en.md` | README in English (user choice) |

## Build structure

`build.bat` produces a **single self-contained file**
`dist\MrOpenVPNClient-<version>-portable.exe` — copy it anywhere and run it;
nothing else is required next to it.

Inside (unpacked at launch; the draft layout is the `dist\win-unpacked\` folder):

```
MrOpenVPNClient\
├── MrOpenVPNClient.exe            # Electron runtime
└── resources\
    ├── app.asar                   # the app: src, assets, package.json, LICENSE, NOTICE
    ├── bin\                       # VPN runtime: openvpn.exe + DLLs + wintun.dll
    ├── licenses\                  # licenses of all bundled third-party components
    ├── LICENSE                    # Electron license
    └── LICENSES.chromium.html     # Chromium licenses
```

Key facts:
- When packaged, `app.isPackaged == true`, so the engine looks for `openvpn.exe`
  in `resources\bin` (`process.resourcesPath\bin`) — next to the exe, no absolute paths.
- `bin\` and `licenses\` are kept out of the asar (`extraResources`), because
  `openvpn.exe` cannot be launched from inside an archive.
- The build is **fully portable and based on local paths only**: there are no
  absolute paths in the code or scripts, and the exe works from anywhere (a USB
  stick, any folder, etc.).

## Why the exe is so large

Inside the exe there is the entire **Electron runtime = Chromium** (~100 MB on
disk). This is the price of a desktop framework: any Electron app is this size
(VS Code, Slack, Discord). It only gets compressed down to **~74 MB** as a single
file. If you want a truly lightweight client, consider **Tauri** (uses the
system WebView2, ~5–10 MB), but that means reimplementing the UI in Rust.

## Build requirements

- **Node.js 20+** (tested with Node v24, npm 11). https://nodejs.org/
- **npm** — ships with Node.
- Network is needed only on the first run: npm installs `electron-builder`, and it
  downloads the Electron archive and the NSIS builder (cached in
  `%LOCALAPPDATA%\electron-builder\Cache`). All later builds run **fully offline**.

## Bundled component licenses

All license files live in `licenses/` and are copied into the portable build:

| Component (in `bin/`) | Version | License | License file |
|---|---|---|---|
| `openvpn.exe` | 2.6.13 | GPL-2.0 + OpenSSL/Apache exceptions | `LICENSE-OPENVPN.txt`, `LICENSE-GPL-2.0.txt` |
| `libcrypto-3-x64.dll`, `libssl-3-x64.dll` | 3.4.0 | Apache-2.0 | `LICENSE-APACHE-2.0.txt` |
| `libpkcs11-helper-1.dll` | 1.0.0 | GPL-2.0-or-later | `LICENSE-PKCS11HELPER.txt`, `LICENSE-GPL-2.0.txt` |
| `vcruntime140.dll` | 14.29.30037.0 | Microsoft VC++ Redistributable | `LICENSE-VCRUNTIME.txt` |
| `wintun.dll` | 0.14.1 | GPL-2.0 | `LICENSE-WINTUN.txt`, `LICENSE-GPL-2.0.txt` |
| Electron (runtime) | 33.4.11 | MIT | `LICENSE-ELECTRON.txt` |
| Roboto (fonts, `assets/fonts/`) | — | Apache-2.0 (font), MIT (@fontsource) | `LICENSE-ROBOTO.txt` |

Notes:
- **OpenVPN** is GPL-2.0 with a special exception allowing it to be linked against
  OpenSSL and Apache-2.0 licensed libraries (see `LICENSE-OPENVPN.txt`).
- **Wintun** is distributed under GPL-2.0 (WireGuard LLC).
- **vcruntime140.dll** is a Microsoft VC++ Redistributable component and is **not**
  GPL-covered; it is distributed under the Microsoft license terms.
- **OpenVPN** is a trademark of OpenVPN Inc. This project is not affiliated with
  or sponsored by OpenVPN Inc.

## Quick portable build

```bat
build.bat
```

The script will:
1. check Node.js/npm and `bin\openvpn.exe`;
2. install npm dependencies if needed (`npm install`);
3. run the unit tests and the engine integration test;
4. build the single-file portable EXE (`npx electron-builder --win portable`).

Any test or packaging failure stops the build with a non-zero exit code.
It can be run from anywhere; paths inside the script are relative to the project root.
At the end the script **pauses** and prints the full path of the built
`MrOpenVPNClient-<version>-portable.exe` and its size.

Portable EXE only: `npm run build:win` (same as step 4); an NSIS installer can
also be built (`electron-builder --win nsis`) — both targets are configured in
`package.json`.

## How the app works

- **Phone-like window**: fixed mobile content width of 400px, centered in a
  resizable window (minimum 360×560) — like the desktop Amnezia VPN.
- **Themes**: default black/white, neon, oled, paper, redline, mint + an accent
  color picker (16 presets or a custom HEX); the accent tints the whole UI.
- **Animations**: pulsing outline of the status card and the selected profile
  (pulse/blink/rainbow/throb), with an option to sync all animations.
- **Languages**: English / Русский.
- **Connecting**: import `.ovpn` → Connect → administrator request (UAC, like the
  VPN permission dialog on Android) → authentication → connected.
- **Engine**: `openvpn.exe` runs with the management interface
  (`--management-query-passwords`); the app controls it over TCP: status levels,
  login/password request (`auth-user-pass` with no stored credentials), connect log.
- **Behaviour**: auto-connect to the last profile on start, reconnect on network
  change, pause on screen lock, tray with notifications.
- On Windows the engine appends `ifconfig 10.8.0.2 10.8.0.1` for `dev tun`
  profiles without an explicit `ifconfig` (OpenVPN refuses to start on Windows
  otherwise; the server pushes the real addresses via `pull`).

## Tests

```bat
npm test              :: unit tests for parser and store (tests/unit.js)
npm run test:engine   :: engine integration test with the real openvpn.exe
```

The integration test runs the real `openvpn.exe`, connects to the management
interface, verifies the password prompt, sends credentials, reaches the
CONNECTING state and shuts down cleanly. It runs without administrator rights
(only the management protocol is exercised; no adapter is created).

The config for the integration test is taken locally: if `testdata\TheHome.ovpn`
exists in the project root, the test uses it; otherwise it uses a synthetic
config (with `pull`, `tls-client` and `peer-fingerprint`, which OpenVPN 2.6
requires) that also brings the engine to the password prompt. No paths outside
the project.

## Verifying the result

```powershell
# 1. The single exe launches from anywhere
.\dist\MrOpenVPNClient-1.0.0-portable.exe

# 2. Licenses inside the build (unpacked form — the win-unpacked folder)
Get-ChildItem .\dist\win-unpacked\resources\licenses
Get-ChildItem .\dist\win-unpacked\resources\bin
```
