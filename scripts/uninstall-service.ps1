#requires -RunAsAdministrator
# Stops and removes the OpenVPN Interactive Service.
# Silent: no console output, diagnostics go to the log file.

$ErrorActionPreference = 'Continue'

$installDir = 'C:\Program Files\OpenVPN'
$logPath = Join-Path $installDir 'install-service.log'
$svc = 'OpenVPNServiceInteractive'

("  {0}  Uninstalling {1}..." -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $svc) | Out-File -FilePath $logPath -Append -Encoding utf8

sc.exe stop $svc | Out-Null
Start-Sleep -Milliseconds 1000
sc.exe delete $svc | Out-Null
Start-Sleep -Milliseconds 1000

exit 0
