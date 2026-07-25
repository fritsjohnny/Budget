param(
    [string]$Target
)

. (Join-Path $PSScriptRoot 'mobile-common.ps1')

$adbPath = Get-BudgetAdbPath

if ($Target) {
    Write-Host "Tentando conectar ao alvo $Target..."
    Write-Host (Connect-BudgetAdbTarget -AdbPath $adbPath -Target $Target)
}

$devices = @(Get-BudgetAdbDevices -AdbPath $adbPath)

if ($devices.Count -eq 0 -and -not $Target) {
    Write-Host 'Nenhum dispositivo conectado. Tentando localizar dispositivos pareados via mDNS...'
    $discoveredTargets = @(Connect-BudgetDiscoveredDevices -AdbPath $adbPath)
    if ($discoveredTargets.Count -gt 0) {
        Start-Sleep -Milliseconds 500
        $devices = @(Get-BudgetAdbDevices -AdbPath $adbPath)
    }

    if ($devices.Count -eq 0) {
        $cachedTarget = Connect-BudgetCachedDevice -AdbPath $adbPath
        if ($cachedTarget) {
            Write-Host "Reconectado usando o ultimo endpoint conhecido: $cachedTarget"
            Start-Sleep -Milliseconds 500
            $devices = @(Get-BudgetAdbDevices -AdbPath $adbPath)
        }
    }
}

Write-Host "ADB: $adbPath"

if ($devices.Count -eq 0) {
    Write-Host 'Nenhum dispositivo ADB encontrado.'
    Write-Host 'No celular, ative Opções do desenvolvedor > Depuração sem fio.'
    exit 2
}

foreach ($device in $devices) {
    $connectionType = if ($device.IsWifi) { 'Wi-Fi' } else { 'USB/local' }
    $model = if ($device.Model) { $device.Model } else { 'modelo não identificado' }
    Write-Host "$($device.Serial) | $($device.State) | $model | $connectionType"
}

$readyDevice = Get-BudgetReadyDevice -AdbPath $adbPath -Target $Target
if (-not $readyDevice) {
    Write-Host 'Nenhum dispositivo pronto para publicação.'
    exit 3
}

Write-Host "Dispositivo pronto: $($readyDevice.Serial) ($($readyDevice.Model))"
