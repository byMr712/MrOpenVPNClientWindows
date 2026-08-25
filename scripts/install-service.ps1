#requires -RunAsAdministrator
# Installs the OpenVPN Interactive Service once on this machine.
# Silent: no console output, all diagnostics go to the log file.

$ErrorActionPreference = 'Stop'

$installDir = 'C:\Program Files\OpenVPN'
$binDir = Join-Path $installDir 'bin'
$srcDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'bin'
$logPath = Join-Path $installDir 'install-service.log'
$svc = 'OpenVPNServiceInteractive'

function Write-Log {
    param([string]$msg)
    ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) | Out-File -FilePath $logPath -Append -Encoding utf8
}

try {
    $svcObj = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($svcObj -and $svcObj.Status -eq 'Running') {
        Write-Log 'service already running'
        exit 0
    }
    if ($svcObj) {
        Write-Log 'service exists but not running, removing'
        sc.exe stop $svc | Out-Null
        sc.exe delete $svc | Out-Null
        Start-Sleep -Milliseconds 1000
    }

    New-Item -ItemType Directory -Path $binDir -Force | Out-Null

    foreach ($name in @('openvpnserv.exe', 'openvpn.exe', 'libcrypto-3-x64.dll', 'libssl-3-x64.dll', 'libpkcs11-helper-1.dll', 'vcruntime140.dll', 'tapctl.exe', 'wintun.dll')) {
        $src = Join-Path $srcDir $name
        if (-not (Test-Path -LiteralPath $src)) {
            throw "Missing $name in $srcDir"
        }
        Copy-Item -LiteralPath $src -Destination (Join-Path $binDir $name) -Force
    }
    $legacy = Join-Path $binDir 'openvpnserv2.exe'
    if (Test-Path -LiteralPath $legacy) {
        Remove-Item -LiteralPath $legacy -Force
    }
    Write-Log 'binaries copied'

    New-Item -Path 'HKLM:\SOFTWARE\OpenVPN' -Force | Out-Null
    New-ItemProperty -Path 'HKLM:\SOFTWARE\OpenVPN' -Name '(default)' -Value $installDir -PropertyType String -Force | Out-Null
    Write-Log 'registry set'

    $bin = '"' + (Join-Path $binDir 'openvpnserv.exe') + '"'

    sc.exe create $svc binPath= $bin start= auto depend= "Dhcp" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "sc create failed (exit $LASTEXITCODE)"
    }
    Write-Log 'service created'
    sc.exe description $svc "OpenVPN Interactive Service" | Out-Null

    sc.exe start $svc | Out-Null
    Start-Sleep -Milliseconds 1000
    if ((Get-Service -Name $svc).Status -eq 'Running') {
        Write-Log 'service started'
        exit 0
    }
    throw 'service failed to start'
}
catch {
    Write-Log ('ERROR: ' + $_.Exception.Message)
    exit 1
}
