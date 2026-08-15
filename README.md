# MrOpenVPN Client for Windows

A Windows 10/11 desktop OpenVPN client that copies the look and behavior of the
[MrOpenVPNClient](https://github.com/byMr712/MrOpenVPNClient) Android app.

The interface is a phone-like window: the content keeps the mobile width and is
centered inside a resizable window (like Amnezia VPN on desktop).

## Features

- Same screens as the Android app: main, settings, users, app theme,
  animations, about.
- Same design details: accent-colored text and controls everywhere, the status
  card, profile cards with outline animations (pulse, blink, rainbow, throb).
- Themes: default black, default white, neon, oled, paper, redline, mint plus
  16 accent colors and a custom hex color.
- English and Russian interface.
- Uses the real OpenVPN 2.6.13 (`bin/openvpn.exe`) with the wintun driver.
- The app restarts itself with administrator rights when you connect (like the
  Android VPN permission dialog).
- Auto connect, pause when the screen is locked, reconnect on network change,
  notifications.

## Run

```
npm install
npm start
```

## Test

```
npm test
```

## Structure

```
bin/                 OpenVPN 2.6.13, its dlls and wintun.dll
assets/              app icon and Roboto fonts
src/
  main.js            electron main process (window, tray, ipc, engine wiring)
  preload.js         safe api for the renderer
  vpn/
    engine.js        openvpn process + management interface
    parser.js        .ovpn config parsing
    store.js         settings, profiles and users persistence
  renderer/          the phone-like ui (html, css, js)
tests/               unit tests
```
