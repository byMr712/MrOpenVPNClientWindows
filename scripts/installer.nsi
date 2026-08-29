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

; Welcome page
!insertmacro MUI_PAGE_WELCOME

; Directory page (default C:\Program Files\MrOpenVPNClientWindows)
!insertmacro MUI_PAGE_DIRECTORY

; Components page (checkboxes, without description box)
!define MUI_COMPONENTSPAGE_NODESC
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

; Languages
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

LangString MSG_STOPPING ${LANG_RUSSIAN} "Остановка работающих процессов..."
LangString MSG_STOPPING ${LANG_ENGLISH} "Stopping running processes..."

LangString MSG_INSTALL_SERVICE ${LANG_RUSSIAN} "Установка интерактивной службы OpenVPN..."
LangString MSG_INSTALL_SERVICE ${LANG_ENGLISH} "Installing OpenVPN Interactive Service..."

LangString MSG_SERVICE_OK ${LANG_RUSSIAN} "Служба OpenVPNServiceInteractive успешно установлена и запущена."
LangString MSG_SERVICE_OK ${LANG_ENGLISH} "OpenVPNServiceInteractive service successfully installed and running."

LangString MSG_SERVICE_WARN ${LANG_RUSSIAN} "Предупреждение: не удалось автоматически запустить службу. Службу можно запустить позже из приложения."
LangString MSG_SERVICE_WARN ${LANG_ENGLISH} "Warning: could not automatically start the service. You can start it later from the app."

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
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Удалить ${PRODUCT_NAME}.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
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
  ; Stop app
  ExecWait 'taskkill /F /IM "${PRODUCT_EXE}"' $0

  ; Delete shortcuts
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Удалить ${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

  ; Delete Registry keys
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"

  ; Delete files
  Delete "$INSTDIR\uninstall.exe"
  Delete "$INSTDIR\${PRODUCT_EXE}"
  RMDir /r "$INSTDIR\assets"
  RMDir /r "$INSTDIR\bin"
  RMDir /r "$INSTDIR\licenses"
  RMDir /r "$INSTDIR\renderer"
  RMDir /r "$INSTDIR\scripts"
  RMDir "$INSTDIR"
SectionEnd
