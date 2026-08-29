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

$exe = Join-Path $outDir "MrOpenVPNClient.exe"
if (Test-Path $exe) {
    $sizeMb = [Math]::Round(((Get-Item $exe).Length / 1MB), 2)
    Write-Host "`nSUCCESS! MrOpenVPN Client Native Edition built successfully." -ForegroundColor Green
    Write-Host "Executable: $exe ($sizeMb MB)" -ForegroundColor Yellow
    Write-Host "Output Directory: $outDir`n" -ForegroundColor Green
} else {
    throw "Output executable not found in $outDir"
}
