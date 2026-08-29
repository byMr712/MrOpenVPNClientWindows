; MrOpenVPN Client Windows Portable Launcher Script
; Creates a single-file portable executable that extracts to temp and runs cleanly.

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
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\app"
  File /r "..\dist-native\*.*"
  ExecWait '"$PLUGINSDIR\app\${PRODUCT_EXE}"' $0
SectionEnd
