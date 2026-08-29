; MrOpenVPN Client Windows Installer Script
; Written for NSIS 3.0+

!include "MUI2.nsh"
!include "Sections.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

Unicode True

!define PRODUCT_NAME "MrOpenVPN Client"
!define PRODUCT_VERSION "1.3.0"
!define PRODUCT_PUBLISHER "Mr712"
!define PRODUCT_WEB_SITE "https://github.com/byMr712/MrOpenVPNClientWindows"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\MrOpenVPNClient.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"
!define PRODUCT_EXE "MrOpenVPNClient.exe"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\dist\MrOpenVPNClient-${PRODUCT_VERSION}-setup.exe"
InstallDir "$PROGRAMFILES64\MrOpenVPNClientWindows"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel admin

; UI / Graphics
!define MUI_ICON "..\assets\icon.ico"
!define MUI_UNICON "..\assets\icon.ico"
!define MUI_ABORTWARNING

; Language storage in registry for clean Uninstaller localization without mojibake
!define MUI_LANGDLL_REGISTRY_ROOT "${PRODUCT_UNINST_ROOT_KEY}"
!define MUI_LANGDLL_REGISTRY_KEY "${PRODUCT_UNINST_KEY}"
!define MUI_LANGDLL_REGISTRY_VALUENAME "Installer Language"

; Welcome page
!insertmacro MUI_PAGE_WELCOME

; Directory page (default C:\Program Files\MrOpenVPNClientWindows)
!insertmacro MUI_PAGE_DIRECTORY

; Components page (checkboxes, without description box)
!define MUI_COMPONENTSPAGE_NODESC
!define MUI_PAGE_CUSTOMFUNCTION_SHOW ComponentsPageShow
!insertmacro MUI_PAGE_COMPONENTS

; Instfiles page
!insertmacro MUI_PAGE_INSTFILES

; Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXE}"
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages (Russian first as default)
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"

; Language strings for Sections
LangString SEC_CORE_NAME ${LANG_RUSSIAN} "Основная программа"
LangString SEC_CORE_NAME ${LANG_ENGLISH} "Core Application"

LangString SEC_DESKTOP_NAME ${LANG_RUSSIAN} "Создать ярлык на рабочий стол"
LangString SEC_DESKTOP_NAME ${LANG_ENGLISH} "Create Desktop shortcut"

LangString SEC_STARTMENU_NAME ${LANG_RUSSIAN} "Создать ярлык в меню пуск"
LangString SEC_STARTMENU_NAME ${LANG_ENGLISH} "Create Start Menu shortcut"

LangString SEC_SERVICE_NAME ${LANG_RUSSIAN} "Сразу установить службу (обязательно, но можно потом)"
LangString SEC_SERVICE_NAME ${LANG_ENGLISH} "Install OpenVPN service now (recommended, or do it later)"

LangString SEC_UNINSTALL_NAME ${LANG_RUSSIAN} "Удалить ${PRODUCT_NAME}"
LangString SEC_UNINSTALL_NAME ${LANG_ENGLISH} "Uninstall ${PRODUCT_NAME}"

LangString MSG_STOPPING ${LANG_RUSSIAN} "Остановка работающих процессов..."
LangString MSG_STOPPING ${LANG_ENGLISH} "Stopping running processes..."

LangString MSG_INSTALL_SERVICE ${LANG_RUSSIAN} "Установка интерактивной службы OpenVPN..."
LangString MSG_INSTALL_SERVICE ${LANG_ENGLISH} "Installing OpenVPN Interactive Service..."

LangString MSG_SERVICE_OK ${LANG_RUSSIAN} "Служба OpenVPNServiceInteractive успешно установлена и запущена."
LangString MSG_SERVICE_OK ${LANG_ENGLISH} "OpenVPNServiceInteractive service successfully installed and running."

LangString MSG_SERVICE_WARN ${LANG_RUSSIAN} "Предупреждение: не удалось автоматически запустить службу. Службу можно запустить позже из приложения."
LangString MSG_SERVICE_WARN ${LANG_ENGLISH} "Warning: could not automatically start the service. You can start it later from the app."

; Uninstaller language initializer
Function un.onInit
  !insertmacro MUI_UNGETLANGUAGE
FunctionEnd

; Callback to customize controls on Components Page
Function ComponentsPageShow
  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 != 0
    ; Hide 1006, 1021, and 1022 duplicate subtitle / prompt controls
    GetDlgItem $1 $0 1006
    ShowWindow $1 0

    GetDlgItem $1 $0 1021
    ShowWindow $1 0

    GetDlgItem $1 $0 1022
    ShowWindow $1 0

    ; Query exact inner dialog width and height in pixels
    System::Call '*(i, i, i, i) p .r4'
    System::Call 'user32::GetClientRect(p $0, p $4)'
    System::Call '*$4(i .r5, i .r6, i .r7, i .r8)'
    System::Free $4

    ; Move 1023 ("Требуется на диске: ...") to top directly under header
    GetDlgItem $2 $0 1023
    System::Call 'user32::SetWindowPos(p $2, p 0, i 0, i 0, i $7, i 18, i 0x0014)'

    ; Resize 1032 (Components list / TreeView) to stretch from edge to edge
    GetDlgItem $3 $0 1032
    IntOp $9 $8 - 24
    System::Call 'user32::SetWindowPos(p $3, p 0, i 0, i 22, i $7, i $9, i 0x0014)'
  ${EndIf}
FunctionEnd

; Sections
Section "$(SEC_CORE_NAME)" SEC_CORE
  SectionIn RO
  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; Stop running instance if any
  DetailPrint "$(MSG_STOPPING)"
  ExecWait 'taskkill /F /IM "${PRODUCT_EXE}"' $0

  ; Copy native bundle
  File /r "..\dist-native\*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Write App Paths
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "Path" "$INSTDIR"

  ; Write Uninstall keys
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "$(SEC_DESKTOP_NAME)" SEC_DESKTOP
  SetOutPath "$INSTDIR"
  CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\assets\icon.ico" 0
SectionEnd

Section "$(SEC_STARTMENU_NAME)" SEC_STARTMENU
  SetOutPath "$INSTDIR"
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\assets\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\$(SEC_UNINSTALL_NAME).lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
SectionEnd

Section "$(SEC_SERVICE_NAME)" SEC_SERVICE
  DetailPrint "$(MSG_INSTALL_SERVICE)"
  SetOutPath "$INSTDIR"
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\scripts\install-service.ps1"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "$(MSG_SERVICE_WARN)"
  ${Else}
    DetailPrint "$(MSG_SERVICE_OK)"
  ${EndIf}
SectionEnd

; Uninstallation
Section "Uninstall"
  ; 1. Stop all application and OpenVPN processes
  ExecWait 'taskkill /F /IM "${PRODUCT_EXE}"' $0
  ExecWait 'taskkill /F /IM "openvpn.exe"' $0
  ExecWait 'taskkill /F /IM "openvpnserv.exe"' $0

  ; 2. Stop and completely remove OpenVPNServiceInteractive service
  nsExec::ExecToLog 'sc.exe stop OpenVPNServiceInteractive'
  Sleep 1000
  nsExec::ExecToLog 'sc.exe delete OpenVPNServiceInteractive'
  Sleep 500

  ; 3. Remove OpenVPN service runtime files and registry
  RMDir /r "C:\Program Files\OpenVPN"
  DeleteRegKey HKLM "SOFTWARE\OpenVPN"

  ; 4. Delete shortcuts
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\$(SEC_UNINSTALL_NAME).lnk"
  RMDir /r "$SMPROGRAMS\${PRODUCT_NAME}"

  ; 5. Delete Registry keys
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"

  ; 6. Clean up AppData, User Profiles, Logs, and WebView2 cache
  RMDir /r "$APPDATA\mropenvpn-client-windows"
  RMDir /r "$LOCALAPPDATA\MrOpenVPNClient"

  ; 7. Delete all files in installation directory
  RMDir /r "$INSTDIR"
SectionEnd
