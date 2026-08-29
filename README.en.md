# MrOpenVPN Client for Windows

> **Language:** English · [Русский](README.md)

Native desktop client **MrOpenVPN Client** for Windows 10/11 (.NET 8 + WebView2) — a port of the same-named Android app with the same interface and behaviour.
This folder contains the sources, build tooling and everything needed to rebuild it.

## Credits

- **Android original:** [Mr712](https://github.com/byMr712?tab=repositories) —
  a fork of **ics-openvpn** (core: Arne Schwabe).
- **Windows port:** [Mr712](https://github.com/byMr712?tab=repositories).
- The Windows version is an independent native implementation of the WebView2 interface and logic in C# .NET 8
  (it contains no Android/Kotlin code). The VPN engine is the official **OpenVPN 2.6.13** for Windows.

## Disclaimer

This application is provided **as is**, without warranties of any kind, either
express or implied, including, but not limited to, the implied warranties of
merchantability, fitness for a particular purpose and non-infringement.

- Use at your own risk. The author is **not responsible** for data loss, system
  crashes, downtime, or any other consequences of using this application.
- Connecting the VPN requires administrator rights — the app interacts properly
  with the `OpenVPNServiceInteractive` service.
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
- The **Wintun** driver is used for VPN (`wintun.dll` is included in the package).
- The app uses its own bundled `openvpn.exe`; a separate OpenVPN install is **not** needed.

## Folder contents

| Path | Description |
|---|---|
| `src-net/` | C# .NET 8 source code (MainForm, VpnEngine, VpnStore, ConfigParser, ServiceHelper) |
| `src/renderer/` | The whole web UI: `index.html`, `css/`, `js/`, `js/views/` |
| `bin/` | Bundled VPN runtime: `openvpn.exe`, `openvpnserv.exe`, DLLs, `wintun.dll` |
| `assets/` | Icons (`icon.ico`, `icon.png`) and fonts (Inter woff2) |
| `build.bat` | One-click build script (Setup + Portable + Zip) |
| `scripts/build-native.ps1` | Native application and NSIS installer build script |
| `scripts/installer.nsi` | NSIS Setup installer script (folder selection, shortcuts, service) |
| `scripts/portable.nsi` | NSIS Portable launcher script (instant cached launch) |
| `scripts/install-service.ps1` | Installs OpenVPN Interactive Service |
| `scripts/uninstall-service.ps1` | Uninstalls OpenVPN Interactive Service |
| `scripts/make-icon.ps1` | Generates `assets/icon.png` and multi-res `assets/icon.ico` |
| `LICENSE` | GNU GPL v3 (application) |
| `NOTICE` | Attribution and notices |
| `licenses/` | Licenses of bundled components |
| `README.md` | README in Russian |
| `README.en.md` | README in English |

## Building the application

Build everything with one click:
```bat
build.bat
```
or via PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-native.ps1
```

The output binaries are produced in the `dist/` directory:
- **`dist\MrOpenVPNClient-1.3.0-setup.exe`** — full NSIS installer:
  - Custom install directory choice (default: `C:\Program Files\MrOpenVPNClientWindows`);
  - "Create Desktop shortcut" option;
  - "Create Start Menu shortcut" option;
  - "Install service now (recommended, or do it later)" option;
  - Registered in Windows Apps and Features with a clean uninstaller.
- **`dist\MrOpenVPNClient-1.3.0-portable.exe`** — ultra-fast single-file executable without installation (caches launch in LocalAppData).
- **`dist\MrOpenVPNClient-1.3.0-portable.zip`** — classic ZIP archive containing the portable folder.
- **`dist-native\`** — raw extracted native application folder.

## Bundled component licenses

All license files live in `licenses/`:

| Component (in `bin/`) | Version | License | License file |
|---|---|---|---|
| `openvpn.exe` | 2.6.13 | GPL-2.0 + OpenSSL/Apache exceptions | `LICENSE-OPENVPN.txt`, `LICENSE-GPL-2.0.txt` |
| `libcrypto-3-x64.dll`, `libssl-3-x64.dll` | 3.4.0 | Apache-2.0 | `LICENSE-APACHE-2.0.txt` |
| `libpkcs11-helper-1.dll` | 1.0.0 | GPL-2.0-or-later | `LICENSE-PKCS11HELPER.txt`, `LICENSE-GPL-2.0.txt` |
| `vcruntime140.dll` | 14.29.30037.0 | Microsoft VC++ Redistributable | `LICENSE-VCRUNTIME.txt` |
| `wintun.dll` | 0.14.1 | GPL-2.0 | `LICENSE-WINTUN.txt`, `LICENSE-GPL-2.0.txt` |
| Inter (fonts, `assets/fonts/`) | — | SIL OFL 1.1 | `LICENSE-INTER.txt` |

## How the app works

- **Phone-like window**: fixed mobile content width of 400px, centered in a
  resizable window (minimum 360×560).
- **Themes**: default black/white, neon, oled, paper, redline, mint + an accent
  color picker (presets or custom HEX).
- **Animations**: pulsing outline of the status card and the selected profile
  (pulse/blink/rainbow/throb).
- **Languages**: English / Русский.
- **Engine**: `openvpn.exe` runs via Windows Interactive Service,
  the app controls it over a management TCP port.
- **Routing**: Full Tunnel (`redirect-gateway def1` and `block-outside-dns`)
  and Split Tunnel support.
- **Tray & Single-Instance Behaviour**:
  - Closing the window minimizes the application to the system tray.
  - Launching the shortcut while the app is running in tray immediately restores and brings the existing window to the front.
  - Auto-connect, reconnect on network change, pause on screen lock.
