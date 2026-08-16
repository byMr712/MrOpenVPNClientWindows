; Custom NSIS script for MrOpenVPNClient installer.
; The installer runs elevated (perMachine), so the OpenVPN Interactive
; Service can be installed right after the files are copied (customInstall)
; and removed on uninstall (customUnInstall).

!macro customInstall
  DetailPrint "Installing OpenVPN Interactive Service..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\install-service.ps1"'
  Pop $0
  DetailPrint "install-service.ps1 exit code: $0"
!macroend

; Runs after "common.nsh" is included, so we can override the default
; uninstaller file name and its version info (shown in the UAC prompt).
!macro customHeader
  !ifdef BUILD_UNINSTALLER
    !undef UNINSTALL_FILENAME
    !define UNINSTALL_FILENAME "MrOpenVPN UnInstaller.exe"
  !endif
!macroend

!macro customUnInstall
  DetailPrint "Removing OpenVPN Interactive Service..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\uninstall-service.ps1"'
  Pop $0
  SetShellVarContext current
  RMDir /r "$APPDATA\mropenvpn-client-windows"
  SetShellVarContext all
!macroend
