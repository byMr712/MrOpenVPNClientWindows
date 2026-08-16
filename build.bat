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
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] npm not found in PATH.
  exit /b 1
)
if not exist "bin\openvpn.exe" (
  echo  [ERROR] bin\openvpn.exe not found. Put the OpenVPN 2.6 runtime into bin\.
  exit /b 1
)

rem -------- version from package.json --------
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VER=%%v"
if not defined VER set "VER=1.0.0"
echo  Building version %VER%

rem -------- dependencies --------
if not exist "node_modules\electron-builder" (
  echo  [1/4] Installing npm dependencies... first run downloads Electron + NSIS
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo  [ERROR] npm install failed.
    exit /b 1
  )
) else (
  echo  [1/4] Dependencies already installed, skipping npm install.
)

rem -------- tests --------
echo  [2/4] Running unit tests...
call npm test
if errorlevel 1 (
  echo  [ERROR] Unit tests failed.
  exit /b 1
)
echo  [3/4] Running engine integration test...
call npm run test:engine
if errorlevel 1 (
  echo  [ERROR] Engine integration test failed.
  exit /b 1
)

rem -------- build portable exe --------
echo  [4/4] Building single-file portable EXE (electron-builder)...
if exist "dist\%APPNAME%-%VER%-portable.exe" del /q "dist\%APPNAME%-%VER%-portable.exe"
call npx electron-builder --win portable
if errorlevel 1 (
  echo  [ERROR] electron-builder failed. The first run needs internet to download
  echo         Electron and NSIS; later runs work offline.
  exit /b 1
)

rem -------- result --------
set "EXE=%ROOT%dist\%APPNAME%-%VER%-portable.exe"
if not exist "%EXE%" (
  echo  [ERROR] Output exe not found: %EXE%
  exit /b 1
)
for %%A in ("%EXE%") do set "SZ=%%~zA"
set /a "MB=%SZ%/1048576"

echo.
echo  Build OK.
echo.
echo    Portable EXE : %EXE%
echo    Size         : %MB% MB
echo.
echo  This is a single self-contained file - copy it anywhere and run it.
echo  Press any key to close this window...
pause >nul
endlocal
