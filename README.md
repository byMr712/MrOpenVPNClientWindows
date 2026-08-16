# MrOpenVPN Client for Windows

> **Язык:** Русский · [English](README.en.md)

Desktop-клиент **MrOpenVPN Client** для Windows 10/11 — порт одноимённого
Android-приложения на **Electron**, с тем же интерфейсом и поведением.
В этой папке — исходники, инструменты сборки и всё необходимое для пересборки.

## Авторы

- **Android-оригинал:** [Mr712](https://github.com/byMr712?tab=repositories) —
  форк проекта **ics-openvpn** (ядро: Arne Schwabe).
- **Windows-порт:** [Mr712](https://github.com/byMr712?tab=repositories).
- Windows-версия — независимая реализация того же интерфейса и логики на Electron
  (кода Android/Kotlin не содержит). VPN-движок — официальный **OpenVPN 2.6.13**
  для Windows. Из Android-версии ничего не «переносилось» — только внешний вид,
  набор экранов и поведение.

## Отказ от ответственности

Приложение предоставляется **как есть**, без каких-либо гарантий, явных или
подразумеваемых, включая, но не ограничиваясь, подразумеваемыми гарантиями
товарной пригодности, пригодности для конкретной цели и ненарушения прав.

- Используйте на свой страх и риск. Автор **не несёт ответственности** за потерю
  данных, сбои системы, простой или любые другие последствия использования.
- Для подключения VPN требуются права администратора — приложение корректно
  запрашивает их через UAC (аналогично диалогу разрешения VPN на Android).
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
- Для работы VPN нужен установленный **Wintun**-драйвер (wintun.dll входит в поставку
  и устанавливается автоматически при первом подключении под администратором).
- Приложение использует собственный встроенный `openvpn.exe`, отдельная установка
  OpenVPN **не нужна**.

## Содержимое папки

| Путь | Описание |
|---|---|
| `build.bat` | Скрипт сборки портативной версии (все пути — относительно корня) |
| `src/main.js` | Main-процесс Electron: окно, трей, IPC, управление VPN-движком |
| `src/preload.js` | contextBridge API для рендерера |
| `src/renderer/` | Весь UI: `index.html`, `css/`, `js/`, `js/views/` |
| `src/vpn/` | Движок: `engine.js` (management-протокол), `parser.js` (.ovpn), `store.js` (хранилище) |
| `bin/` | Встроенный VPN-рантайм: `openvpn.exe`, DLL, `wintun.dll` |
| `assets/` | Иконки и шрифты (Roboto, subset woff2) |
| `tests/` | Тесты: `unit.js` (парсер+хранилище), `engine.js` (интеграционный) |
| `scripts/make-icon.ps1` | Генерация `assets/icon.png` (квадратная иконка) |
| `LICENSE` | GNU GPL v3 (приложение) |
| `NOTICE` | Атрибуция и уведомления об изменениях |
| `licenses/` | Лицензии всех встроенных сторонних компонентов |
| `README.md` | README на русском (по умолчанию) |
| `README.en.md` | README на английском (выбор пользователя) |

## Структура портативной сборки

`build.bat` собирает в `dist\MrOpenVPNClient\` портативную версию и архив
`dist\MrOpenVPNClient-<версия>-win-x64.zip`:

```
MrOpenVPNClient\
├── MrOpenVPNClient.exe            # рантайм Electron, переименованный из electron.exe
├── resources\
│   ├── app\                       # само приложение (без asar, обычная папка)
│   │   ├── src\  assets\  package.json  LICENSE  NOTICE  licenses\
│   └── bin\                       # VPN-рантайм: openvpn.exe + DLL + wintun.dll
├── LICENSE                        # лицензия Electron (в составе рантайма)
└── LICENSES.chromium.html         # лицензии Chromium (в составе рантайма)
```

Ключевые факты:
- В упакованном виде `app.isPackaged == true`, поэтому движок ищет `openvpn.exe`
  в `resources\bin` (`process.resourcesPath\bin`).
- Приложение запускается **без asar** — все пути внутри обычной папки, никаких
  проблем с файлами, шрифтами и tray-иконкой.
- Рантайм Electron уже содержит собственные `LICENSE` и `LICENSES.chromium.html`.

## Что требуется для сборки

- **Node.js 20+** (проверено: Node v24, npm 11). https://nodejs.org/
- **npm** — идёт вместе с Node.
- **Сеть** нужна только при первом запуске (скачивание Electron). Если `node_modules`
  уже установлены, сборка проходит **полностью офлайн**.

## Лицензии встроенных компонентов

Все файлы лицензий лежат в `licenses/` и копируются в портативную сборку:

| Компонент (в `bin/`) | Версия | Лицензия | Файл лицензии |
|---|---|---|---|
| `openvpn.exe` | 2.6.13 | GPL-2.0 + исключения OpenSSL/Apache | `LICENSE-OPENVPN.txt`, `LICENSE-GPL-2.0.txt` |
| `libcrypto-3-x64.dll`, `libssl-3-x64.dll` | 3.4.0 | Apache-2.0 | `LICENSE-APACHE-2.0.txt` |
| `libpkcs11-helper-1.dll` | 1.0.0 | GPL-2.0-or-later | `LICENSE-PKCS11HELPER.txt`, `LICENSE-GPL-2.0.txt` |
| `vcruntime140.dll` | 14.29.30037.0 | Microsoft VC++ Redistributable | `LICENSE-VCRUNTIME.txt` |
| `wintun.dll` | 0.14.1 | GPL-2.0 | `LICENSE-WINTUN.txt`, `LICENSE-GPL-2.0.txt` |
| Electron (рантайм) | 33.4.11 | MIT | `LICENSE-ELECTRON.txt` |
| Roboto (шрифты, `assets/fonts/`) | — | Apache-2.0 (шрифт), MIT (@fontsource) | `LICENSE-ROBOTO.txt` |

Примечания:
- **OpenVPN** — GPL-2.0 со специальным исключением на линковку с OpenSSL и на
  линковку с Apache-2.0-библиотеками (см. `LICENSE-OPENVPN.txt`).
- **Wintun** распространяется под GPL-2.0 (WireGuard LLC).
- **vcruntime140.dll** — компонент Microsoft VC++ Redistributable и **не**
  подчиняется GPL; распространяется по условиям лицензии Microsoft.
- **OpenVPN** — товарный знак OpenVPN Inc. Проект не связан и не спонсируется
  OpenVPN Inc.

## Быстрая пересборка портативной версии

```bat
build.bat
```

Скрипт сам:
1. проверит наличие Node.js/npm и `bin\openvpn.exe`;
2. при необходимости установит npm-зависимости (`npm install`);
3. прогонит юнит-тесты и интеграционный тест движка;
4. соберёт `dist\MrOpenVPNClient\` (рантайм + `resources\app` + `resources\bin`);
5. упакует всё в `dist\MrOpenVPNClient-<версия>-win-x64.zip`.

Любой сбой тестов или копирования останавливает сборку с кодом ошибки.
Запускать можно из любого места; пути внутри скрипта — относительно корня проекта.

## Как устроено приложение

- **Окно «как телефон»**: контент фиксированной мобильной ширины 400px,
  по центру растягиваемого окна (минимальный размер 360×560) — как у
  десктоп-версии Amnezia VPN.
- **Темы**: default black/white, neon, oled, paper, redline, mint + выбор
  акцентного цвета (16 пресетов или свой HEX), акцент тинтует весь интерфейс.
- **Анимации**: пульсирующая обводка статуса и выбранного профиля
  (pulse/blink/rainbow/throb), синхронизация всех анимаций.
- **Языки**: English / Русский.
- **Подключение**: импорт `.ovpn` → Connect → запрос прав администратора (UAC,
  как диалог разрешения VPN на Android) → авторизация → подключение.
- **Движок**: `openvpn.exe` запускается с management-интерфейсом
  (`--management-query-passwords`), приложение управляет им по TCP: уровни
  статуса, запрос логина/пароля (`auth-user-pass` без сохранённых кредов),
  лог подключения.
- **Поведение**: автоподключение к последнему профилю при старте, переподключение
  при смене сети, пауза при блокировке экрана, трей с уведомлениями.
- На Windows движку добавляется `ifconfig 10.8.0.2 10.8.0.1` для `dev tun`
  без явного `ifconfig` (иначе OpenVPN на Windows отказывается стартовать;
  реальные адреса сервер присылает по `pull`).

## Тесты

```bat
npm test              :: юнит-тесты парсера и хранилища (tests/unit.js)
npm run test:engine   :: интеграционный тест движка с реальным openvpn.exe
```

Интеграционный тест запускает настоящий `openvpn.exe`, подключается к management,
проверяет запрос пароля, отправку креденшелов, переход в состояние
CONNECTING и корректное завершение. Запускается без прав администратора
(проверяется только management-протокол, адаптер не создаётся).

## Проверка результата

```powershell
# 1. Портативная версия запускается
.\dist\MrOpenVPNClient\MrOpenVPNClient.exe

# 2. Архив распаковывается и работает оттуда же
Expand-Archive .\dist\MrOpenVPNClient-1.0.0-win-x64.zip -DestinationPath .\_unpack

# 3. Внутри есть все лицензии
Get-ChildItem .\dist\MrOpenVPNClient\resources\app\licenses
```
