# MrOpenVPN Client for Windows

> **Язык:** Русский · [English](README.en.md)

Нативный desktop-клиент **MrOpenVPN Client** для Windows 10/11 (.NET 8 + WebView2) — порт одноимённого Android-приложения с тем же интерфейсом и поведением.
В этой папке — исходники, инструменты сборки и всё необходимое для пересборки.

## Авторы

- **Android-оригинал:** [Mr712](https://github.com/byMr712?tab=repositories) —
  форк проекта **ics-openvpn** (ядро: Arne Schwabe).
- **Windows-порт:** [Mr712](https://github.com/byMr712?tab=repositories).
- Windows-версия — независимая нативная реализация интерфейса на WebView2 и логики на C# .NET 8
  (кода Android/Kotlin не содержит). VPN-движок — официальный **OpenVPN 2.6.13**
  для Windows.

## Отказ от ответственности

Приложение предоставляется **как есть**, без каких-либо гарантий, явных или
подразумеваемых, включая, но не ограничиваясь, подразумеваемыми гарантиями
товарной пригодности, пригодности для конкретной цели и ненарушения прав.

- Используйте на свой страх и риск. Автор **не несёт ответственности** за потерю
  данных, сбои системы, простой или любые другие последствия использования.
- Для подключения VPN требуются права администратора — приложение корректно
  взаимодействует со службой OpenVPNServiceInteractive.
- Нет гарантий, что приложение заработает на вашем конкретном оборудовании или
  версии Windows. Поддержка предоставляется только «по возможности».

## Лицензия и атрибуция

- **MrOpenVPN Client for Windows** распространяется под **GNU GPL v3**.
  Полный текст: [`LICENSE`](LICENSE).
- Android-оригинал (форк ics-openvpn) — **GNU GPL v3**, автор [Mr712](https://github.com/byMr712?tab=repositories).
- Атрибуция и перечень встроенных компонентов: [`NOTICE`](NOTICE).
- Встроенные сторонние компоненты (`bin/`) — см. раздел
  [«Лицензии встроенных компонентов»](#лицензии-встроенных-компонентов) и папку `licenses/`.

## Требования

- **Windows 10 / 11, x64.**
- Для работы VPN используется **Wintun**-драйвер (`wintun.dll` входит в поставку).
- Приложение использует собственный встроенный `openvpn.exe`, отдельная установка
  OpenVPN **не нужна**.

## Содержимое папки

| Путь | Описание |
|---|---|
| `src-net/` | Исходный код C# .NET 8 (MainForm, VpnEngine, VpnStore, ConfigParser, ServiceHelper) |
| `src/renderer/` | Весь веб-UI: `index.html`, `css/`, `js/`, `js/views/` |
| `bin/` | Встроенный VPN-рантайм: `openvpn.exe`, `openvpnserv.exe`, DLL, `wintun.dll` |
| `assets/` | Иконки (`icon.ico`, `icon.png`) и шрифты (Inter woff2) |
| `scripts/build-native.ps1` | Скрипт сборки нативного приложения |
| `scripts/install-service.ps1` | Установка интерактивной службы OpenVPN |
| `scripts/uninstall-service.ps1` | Удаление интерактивной службы OpenVPN |
| `scripts/make-icon.ps1` | Генерация `assets/icon.png` и `assets/icon.ico` |
| `LICENSE` | GNU GPL v3 (приложение) |
| `NOTICE` | Атрибуция и компоненты |
| `licenses/` | Лицензии встроенных компонентов |
| `README.md` | README на русском |
| `README.en.md` | README на английском |

## Сборка приложения

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-native.ps1
```

Результат сборки создаётся в папке `dist-native\MrOpenVPNClient.exe` (~8.8 МБ).
Сборка представляет собой одиночный переносимый исполняемый файл (Single-File .NET).

## Лицензии встроенных компонентов

Все файлы лицензий лежат в `licenses/`:

| Компонент (в `bin/`) | Версия | Лицензия | Файл лицензии |
|---|---|---|---|
| `openvpn.exe` | 2.6.13 | GPL-2.0 + исключения OpenSSL/Apache | `LICENSE-OPENVPN.txt`, `LICENSE-GPL-2.0.txt` |
| `libcrypto-3-x64.dll`, `libssl-3-x64.dll` | 3.4.0 | Apache-2.0 | `LICENSE-APACHE-2.0.txt` |
| `libpkcs11-helper-1.dll` | 1.0.0 | GPL-2.0-or-later | `LICENSE-PKCS11HELPER.txt`, `LICENSE-GPL-2.0.txt` |
| `vcruntime140.dll` | 14.29.30037.0 | Microsoft VC++ Redistributable | `LICENSE-VCRUNTIME.txt` |
| `wintun.dll` | 0.14.1 | GPL-2.0 | `LICENSE-WINTUN.txt`, `LICENSE-GPL-2.0.txt` |
| Inter (шрифты, `assets/fonts/`) | — | SIL OFL 1.1 | `LICENSE-INTER.txt` |

## Как устроено приложение

- **Окно «как телефон»**: контент фиксированной мобильной ширины 400px,
  по центру растягиваемого окна (минимальный размер 360×560).
- **Темы**: default black/white, neon, oled, paper, redline, mint + выбор
  акцентного цвета (пресеты или свой HEX).
- **Анимации**: пульсирующая обводка статуса и выбранного профиля
  (pulse/blink/rainbow/throb).
- **Языки**: English / Русский.
- **Движок**: `openvpn.exe` запускается через Windows Interactive Service,
  приложение управляет им по management TCP-порту.
- **Маршрутизация**: поддержка Full Tunnel (`redirect-gateway def1` и `block-outside-dns`)
  и Split Tunnel.
- **Поведение**: автоподключение, переподключение при смене сети,
  пауза при блокировке экрана, системный трей.
