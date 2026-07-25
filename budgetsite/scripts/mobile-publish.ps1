param(
    [string]$Target,
    [switch]$SkipWebBuild
)

. (Join-Path $PSScriptRoot 'mobile-common.ps1')

$adbPath = Get-BudgetAdbPath

if ($Target) {
    $existingTarget = Get-BudgetReadyDevice -AdbPath $adbPath -Target $Target
    if (-not $existingTarget) {
        Write-Host "Conectando ao dispositivo $Target..."
        Write-Host (Connect-BudgetAdbTarget -AdbPath $adbPath -Target $Target)
    }
}

$device = Get-BudgetReadyDevice -AdbPath $adbPath -Target $Target
if (-not $device -and -not $Target) {
    Write-Host 'Nenhum dispositivo conectado. Tentando localizar dispositivos pareados via mDNS...'
    $discoveredTargets = @(Connect-BudgetDiscoveredDevices -AdbPath $adbPath)
    if ($discoveredTargets.Count -gt 0) {
        Write-Host "Endpoint(s) localizado(s): $($discoveredTargets -join ', ')"
        Start-Sleep -Milliseconds 500
        $device = Get-BudgetReadyDevice -AdbPath $adbPath
    }

    if (-not $device) {
        $cachedTarget = Connect-BudgetCachedDevice -AdbPath $adbPath
        if ($cachedTarget) {
            Write-Host "Reconectado usando o ultimo endpoint conhecido: $cachedTarget"
            Start-Sleep -Milliseconds 500
            $device = Get-BudgetReadyDevice -AdbPath $adbPath
        }
    }
}

if (-not $device) {
    throw @'
Nenhum dispositivo ADB pronto para publicação.
No celular, ative Opções do desenvolvedor > Depuração sem fio.
Se o aparelho já estiver pareado, informe o IP:porta atual com:
  npm run mobile:publish -- -Target 192.168.1.114:46575
Se o pareamento tiver sido perdido, execute primeiro mobile:pair.
'@
}

Push-Location (Join-Path $PSScriptRoot '..')
try {
    if (-not $SkipWebBuild) {
        Write-Host 'Gerando build Angular de produção...'
        & npx ng build --configuration production
        if ($LASTEXITCODE -ne 0) {
            throw "Falha no build Angular. Código de saída: $LASTEXITCODE"
        }
    }

    Write-Host 'Sincronizando o projeto Android...'
    & npx cap sync android
    if ($LASTEXITCODE -ne 0) {
        throw "Falha no Capacitor Sync. Código de saída: $LASTEXITCODE"
    }

    Write-Host "Compilando, instalando e abrindo no dispositivo $($device.Serial)..."
    & npx cap run android --target=$($device.Serial)
    if ($LASTEXITCODE -ne 0) {
        throw "Falha na publicação mobile. Código de saída: $LASTEXITCODE"
    }

    Write-Host "BudgetApp publicado com sucesso em $($device.Serial) ($($device.Model))."
}
finally {
    Pop-Location
}
