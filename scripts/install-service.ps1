#requires -RunAsAdministrator
# Installs the OpenVPN Interactive Service and Wintun adapter on this machine.
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

    # Ensure Wintun network adapter exists
    $tapctl = Join-Path $binDir 'tapctl.exe'
    if (Test-Path $tapctl) {
        $adapters = & $tapctl list 2>&1 | Out-String
        if (-not ($adapters -match 'wintun|tap0901|root\\tap0901')) {
            Write-Log 'creating wintun adapter...'
            & $tapctl create --hwid wintun --name "OpenVPN Wintun" 2>&1 | Out-Null
            Write-Log 'wintun adapter created'
        } else {
            Write-Log 'wintun or tap adapter already present'
        }
    }

    $svcObj = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if (-not $svcObj) {
        $bin = '"' + (Join-Path $binDir 'openvpnserv.exe') + '"'
        sc.exe create $svc binPath= $bin start= auto depend= "Dhcp" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "sc create failed (exit $LASTEXITCODE)"
        }
        Write-Log 'service created'
        sc.exe description $svc "OpenVPN Interactive Service" | Out-Null
    }

    $svcObj = Get-Service -Name $svc -ErrorAction SilentlyContinue
    if ($svcObj -and $svcObj.Status -ne 'Running') {
        sc.exe start $svc | Out-Null
        Start-Sleep -Milliseconds 1000
    }

    if ((Get-Service -Name $svc).Status -eq 'Running') {
        Write-Log 'service running'
        exit 0
    }
    throw 'service failed to start'
}
catch {
    Write-Log ('ERROR: ' + $_.Exception.Message)
    exit 1
}
