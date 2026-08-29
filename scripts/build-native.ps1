# Build script for MrOpenVPN Client (C# .NET + WebView2 Native Edition)
param(
    [string]$Configuration = "Release",
    [switch]$SelfContained = $false
)

$ErrorActionPreference = "Stop"

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $rootDir

Write-Host "==> [1/4] Ensuring application icon..." -ForegroundColor Cyan
& (Join-Path $rootDir "scripts\make-icon.ps1")

Write-Host "==> [2/4] Finding Visual Studio MSBuild..." -ForegroundColor Cyan
$msbuild = "C:\Program Files\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe"
if (-not (Test-Path $msbuild)) {
    $found = Get-ChildItem "C:\Program Files\Microsoft Visual Studio" -Recurse -Filter "MSBuild.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $msbuild = $found.FullName }
    else { throw "MSBuild.exe not found in Microsoft Visual Studio directory." }
}
Write-Host "Using MSBuild: $msbuild" -ForegroundColor Gray

$outDir = if ($SelfContained) { Join-Path $rootDir "dist-native-standalone" } else { Join-Path $rootDir "dist-native" }
if (Test-Path $outDir) {
    Get-ChildItem -Path $outDir -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
} else {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Write-Host "==> [3/4] Building MrOpenVPN Client (.NET + WebView2)..." -ForegroundColor Cyan
$proj = Join-Path $rootDir "src-net\MrOpenVPNClient.csproj"
$args = @(
    $proj,
    "-restore",
    "-t:Publish",
    "-p:Configuration=$Configuration",
    "-p:PublishDir=$outDir\",
    "-p:SelfContained=$($SelfContained.ToString().ToLower())",
    "-p:PublishSingleFile=true"
)

if ($SelfContained) {
    $args += "-p:RuntimeIdentifier=win-x64"
    $args += "-p:EnableCompressionInSingleFile=true"
} else {
    $args += "-p:EnableCompressionInSingleFile=false"
}

& $msbuild $args
if ($LASTEXITCODE -ne 0) {
    throw "Build failed with exit code $LASTEXITCODE"
}

Write-Host "==> [4/4] Finalizing release package..." -ForegroundColor Cyan

# Remove unnecessary XML doc files and PDB
Get-ChildItem -Path $outDir -Filter "*.xml" | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $outDir -Filter "*.pdb" | Remove-Item -Force -ErrorAction SilentlyContinue

# Ensure bin folder with openvpn binaries is copied
$binSrc = Join-Path $rootDir "bin"
$binDst = Join-Path $outDir "bin"
if (-not (Test-Path $binDst)) {
    Copy-Item -Recurse -Force $binSrc $binDst
}

# Ensure assets with icon.ico and icon.png are copied
$assetsSrc = Join-Path $rootDir "assets"
$assetsDst = Join-Path $outDir "assets"
if (-not (Test-Path $assetsDst)) {
    New-Item -ItemType Directory -Path $assetsDst -Force | Out-Null
}
if (Test-Path $assetsSrc) {
    Copy-Item -Recurse -Force (Join-Path $assetsSrc "*") $assetsDst
}

$exe = Join-Path $outDir "MrOpenVPNClient.exe"
if (-not (Test-Path $exe)) {
    throw "Output executable not found in $outDir"
}
$sizeMb = [Math]::Round(((Get-Item $exe).Length / 1MB), 2)
Write-Host "Native bundle built: $exe ($sizeMb MB)" -ForegroundColor Green

# ---- NSIS Installer & Portable Builds ----
Write-Host "`n==> [5/5] Building Setup and Portable executables with NSIS..." -ForegroundColor Cyan

function Find-MakeNSIS {
    $cmd = Get-Command makensis.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        "C:\Program Files (x86)\NSIS\makensis.exe",
        "C:\Program Files\NSIS\makensis.exe",
        (Join-Path $env:LOCALAPPDATA "Programs\NSIS\makensis.exe")
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }

    $cacheNsis = Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache\nsis*" -Recurse -Filter "makensis.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cacheNsis) { return $cacheNsis.FullName }

    return $null
}

$makensis = Find-MakeNSIS

$distDir = Join-Path $rootDir "dist"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}

if ($makensis) {
    Write-Host "Using NSIS compiler: $makensis" -ForegroundColor Gray

    # Build Setup Installer
    Write-Host "Compiling Setup Installer..." -ForegroundColor Yellow
    $nsiSetup = Join-Path $rootDir "scripts\installer.nsi"
    & $makensis $nsiSetup
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Setup installer build failed with exit code $LASTEXITCODE"
    }

    # Build Portable Single-File EXE
    Write-Host "Compiling Portable Launcher..." -ForegroundColor Yellow
    $nsiPortable = Join-Path $rootDir "scripts\portable.nsi"
    & $makensis $nsiPortable
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Portable launcher build failed with exit code $LASTEXITCODE"
    }
} else {
    Write-Warning "makensis.exe not found. Setup installer and portable single-file EXE were skipped."
    Write-Host "Install NSIS (winget install NSIS.NSIS) to enable installer and portable builds." -ForegroundColor Gray
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "           BUILD COMPLETED SUCCESSFULLY!                " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

$setupExe = Join-Path $distDir "MrOpenVPNClient-1.3.0-setup.exe"
$portableExe = Join-Path $distDir "MrOpenVPNClient-1.3.0-portable.exe"

if (Test-Path $setupExe) {
    $setupSize = [Math]::Round(((Get-Item $setupExe).Length / 1MB), 2)
    Write-Host "  Setup Installer : $setupExe ($setupSize MB)" -ForegroundColor Yellow
}
if (Test-Path $portableExe) {
    $portableSize = [Math]::Round(((Get-Item $portableExe).Length / 1MB), 2)
    Write-Host "  Portable EXE    : $portableExe ($portableSize MB)" -ForegroundColor Yellow
}
Write-Host "  Native Folder   : $outDir ($sizeMb MB)`n" -ForegroundColor Yellow
