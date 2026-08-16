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
if not exist "node_modules\electron\dist\electron.exe" (
  echo  [1/5] Installing npm dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo  [ERROR] npm install failed.
    exit /b 1
  )
) else (
  echo  [1/5] Dependencies already installed, skipping npm install.
)

rem -------- tests --------
echo  [2/5] Running unit tests...
call npm test
if errorlevel 1 (
  echo  [ERROR] Unit tests failed.
  exit /b 1
)
echo  [3/5] Running engine integration test...
call npm run test:engine
if errorlevel 1 (
  echo  [ERROR] Engine integration test failed.
  exit /b 1
)

rem -------- package --------
set "OUT=%ROOT%dist\%APPNAME%"
set "APPDIR=%OUT%\resources\app"
echo  [4/5] Packaging portable build to %OUT%
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%"
if errorlevel 1 (
  echo  [ERROR] Cannot create output folder.
  exit /b 1
)

rem electron runtime
xcopy "node_modules\electron\dist" "%OUT%" /e /i /q /y >nul
if errorlevel 1 (
  echo  [ERROR] Failed to copy Electron runtime.
  exit /b 1
)

rem app launcher
if exist "%OUT%\electron.exe" (
  move /y "%OUT%\electron.exe" "%OUT%\%APPNAME%.exe" >nul
)
del /q "%OUT%\resources\default_app.asar" 2>nul

rem application itself (runs un-packed, no asar)
mkdir "%APPDIR%"
xcopy "src" "%APPDIR%\src" /e /i /q /y >nul
xcopy "assets" "%APPDIR%\assets" /e /i /q /y >nul
copy /y "package.json" "%APPDIR%\package.json" >nul
copy /y "LICENSE" "%APPDIR%\LICENSE" >nul
copy /y "NOTICE" "%APPDIR%\NOTICE" >nul
xcopy "licenses" "%APPDIR%\licenses" /e /i /q /y >nul

rem OpenVPN runtime + drivers
xcopy "bin" "%OUT%\resources\bin" /e /i /q /y >nul

rem -------- archive --------
echo  [5/5] Creating ZIP archive...
powershell -NoProfile -Command "Compress-Archive -Path '%OUT%' -DestinationPath '%ROOT%dist\%APPNAME%-%VER%-win-x64.zip' -Force"
if errorlevel 1 (
  echo  [WARN] ZIP creation failed; the portable folder is still available.
)

echo.
echo  Build OK.
echo    Portable : %OUT%\%APPNAME%.exe
echo    Archive  : %ROOT%dist\%APPNAME%-%VER%-win-x64.zip
echo.
endlocal
