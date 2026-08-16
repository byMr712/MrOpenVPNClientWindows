@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
set "ROOT=%~dp0"
cd /d "%ROOT%"
set "APPNAME=MrOpenVPNClient"

echo.
echo  === MrOpenVPN Client for Windows: build ===
echo.

rem -------- checks --------
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js not found in PATH. Install from https://nodejs.org/
  goto fail
)
where npm >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] npm not found in PATH.
  goto fail
)
if not exist "bin\openvpn.exe" (
  echo  [ERROR] bin\openvpn.exe not found. Put the OpenVPN 2.6 runtime into bin\.
  goto fail
)

rem -------- version from package.json --------
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VER=%%v"
if not defined VER set "VER=1.0.0"
echo  Building version %VER%

rem -------- dependencies --------
if not exist "node_modules\electron-builder" (
  echo  [1/5] Installing npm dependencies... first run downloads Electron + NSIS
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo  [ERROR] npm install failed.
    goto fail
  )
) else (
  echo  [1/5] Dependencies already installed, skipping npm install.
)

rem -------- tests --------
echo  [2/5] Running unit tests...
call npm test
if errorlevel 1 (
  echo  [ERROR] Unit tests failed.
  goto fail
)
echo  [3/5] Running engine integration test (warning only, does not stop the build)...
call npm run test:engine
if errorlevel 1 (
  echo  [WARN] Engine integration test failed. This test needs the OpenVPN
  echo         Interactive Service and a real network, so the build continues.
)

rem -------- build portable exe --------
echo  [4/5] Building single-file portable EXE (electron-builder)...
if exist "dist\%APPNAME%-%VER%-portable.exe" del /q "dist\%APPNAME%-%VER%-portable.exe"
call npx electron-builder --win portable
if errorlevel 1 (
  echo  [ERROR] electron-builder failed. The first run needs internet to download
  echo         Electron and NSIS; later runs work offline.
  goto fail
)

rem -------- build setup exe --------
echo  [5/5] Building NSIS setup EXE (electron-builder)...
if exist "dist\%APPNAME%-%VER%-setup.exe" del /q "dist\%APPNAME%-%VER%-setup.exe"
call npx electron-builder --win nsis
if errorlevel 1 (
  echo  [ERROR] electron-builder failed. The first run needs internet to download
  echo         Electron and NSIS; later runs work offline.
  goto fail
)

rem -------- result --------
set "PORTABLE=%ROOT%dist\%APPNAME%-%VER%-portable.exe"
set "SETUP=%ROOT%dist\%APPNAME%-%VER%-setup.exe"
if not exist "%PORTABLE%" (
  echo  [ERROR] Output exe not found: %PORTABLE%
  goto fail
)
if not exist "%SETUP%" (
  echo  [ERROR] Output exe not found: %SETUP%
  goto fail
)
for %%A in ("%PORTABLE%") do set "SZP=%%~zA"
for %%A in ("%SETUP%") do set "SZS=%%~zA"
set /a "MBP=%SZP%/1048576"
set /a "MBS=%SZS%/1048576"

echo.
echo  Build OK.
echo.
echo    Portable EXE : %PORTABLE%
echo    Size         : %MBP% MB
echo.
echo    Setup EXE    : %SETUP%
echo    Size         : %MBS% MB
echo.
echo  Portable is a single self-contained file - copy it anywhere and run it.
echo  Setup is an installer that registers the OpenVPN Interactive Service
echo  and can change the installation directory.
echo  Outputs are in the "dist" folder next to this script:
echo    - %APPNAME%-%VER%-portable.exe
echo    - %APPNAME%-%VER%-setup.exe
echo  Press any key to close this window...
pause >nul
endlocal
exit /b 0

:fail
echo.
echo  [ERROR] Build aborted, see messages above.
pause >nul
endlocal
exit /b 1
