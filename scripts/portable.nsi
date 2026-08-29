; MrOpenVPN Client Windows Fast Portable Launcher Script
; Caches runtime files in LocalAppData to guarantee instant (<0.5s) startup on all subsequent runs.

Unicode True

!define PRODUCT_NAME "MrOpenVPN Client"
!define PRODUCT_VERSION "1.3.0"
!define PRODUCT_EXE "MrOpenVPNClient.exe"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION} Portable"
OutFile "..\dist\MrOpenVPNClient-${PRODUCT_VERSION}-portable.exe"
RequestExecutionLevel user
SilentInstall silent

Icon "..\assets\icon.ico"

Section
  ; Fast portable cache directory in LocalAppData
  StrCpy $INSTDIR "$LOCALAPPDATA\MrOpenVPNClient\portable"
  
  ; If already extracted and current version tag matches, skip extraction for instant launch
  IfFileExists "$INSTDIR\v${PRODUCT_VERSION}.tag" run_app

  ; Extract / update bundle
  CreateDirectory "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "..\dist-native\*.*"
  
  ; Write version tag
  FileOpen $0 "$INSTDIR\v${PRODUCT_VERSION}.tag" w
  FileWrite $0 "${PRODUCT_VERSION}"
  FileClose $0

run_app:
  SetOutPath "$INSTDIR"
  Exec '"$INSTDIR\${PRODUCT_EXE}"'
SectionEnd
