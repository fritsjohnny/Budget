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
    $syncAttempts = 0
    do {
        $syncAttempts++
        Write-Host "Sincronizando o projeto Android (tentativa $syncAttempts de 3)..."
        & npx cap sync android

        if ($LASTEXITCODE -eq 0) {
            break
        }

        if ($syncAttempts -lt 3) {
            Write-Host 'O sync encontrou um bloqueio transitório. Aguardando antes de tentar novamente...'
            Start-Sleep -Seconds 3
        }
    } while ($syncAttempts -lt 3)
    if ($LASTEXITCODE -ne 0) {
        throw "Falha no Capacitor Sync. Código de saída: $LASTEXITCODE"
    }

    Write-Host "Compilando o APK Android..."
    Push-Location (Join-Path (Get-Location) 'android')
    try {
        & .\gradlew.bat assembleDebug
        $gradleExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($gradleExitCode -ne 0) {
        throw "Falha no build Android. Código de saída: $gradleExitCode"
    }

    $apkPath = Join-Path (Get-Location) 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path $apkPath)) {
        throw "APK de debug não encontrado em: $apkPath"
    }

    Write-Host "Instalando o APK no dispositivo $($device.Serial)..."
    & $adbPath -s $device.Serial install -r -d $apkPath
    if ($LASTEXITCODE -ne 0) {
        throw "Falha na instalação do APK. Código de saída: $LASTEXITCODE"
    }

    Write-Host "Abrindo o BudgetApp no dispositivo $($device.Serial)..."
    & $adbPath -s $device.Serial shell am start -n 'com.budget.app/.MainActivity'
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao abrir o BudgetApp. Código de saída: $LASTEXITCODE"
    }

    Write-Host "BudgetApp publicado com sucesso em $($device.Serial) ($($device.Model))."
}
finally {
    Pop-Location
}
