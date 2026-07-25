param(
    [Parameter(Mandatory = $true)]
    [string]$Target
)

. (Join-Path $PSScriptRoot 'mobile-common.ps1')

$adbPath = Get-BudgetAdbPath
Write-Host (Connect-BudgetAdbTarget -AdbPath $adbPath -Target $Target)

$device = Get-BudgetReadyDevice -AdbPath $adbPath -Target $Target
if (-not $device) {
    throw "A conexão com $Target foi solicitada, mas o dispositivo não ficou disponível no ADB."
}

Write-Host "Dispositivo conectado: $($device.Serial) ($($device.Model))"
