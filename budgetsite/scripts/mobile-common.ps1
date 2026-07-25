Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-BudgetAdbPath {
    $candidatePaths = @()

    if ($env:ANDROID_SDK_ROOT) {
        $candidatePaths += (Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe')
    }

    if ($env:ANDROID_HOME) {
        $candidatePaths += (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe')
    }

    $localPropertiesPaths = @(
        (Join-Path $PSScriptRoot '..\android\local.properties'),
        (Join-Path $PSScriptRoot '..\..\android\local.properties')
    )

    foreach ($localPropertiesPath in $localPropertiesPaths) {
        $resolvedLocalPropertiesPath = [System.IO.Path]::GetFullPath($localPropertiesPath)
        if (-not (Test-Path $resolvedLocalPropertiesPath)) {
            continue
        }

        $sdkLine = Get-Content $resolvedLocalPropertiesPath | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
        if (-not $sdkLine) {
            continue
        }

        $sdkPath = ($sdkLine -replace '^sdk\.dir=', '') -replace '\\:', ':' -replace '\\\\', '\'
        if ($sdkPath) {
            $candidatePaths += (Join-Path $sdkPath 'platform-tools\adb.exe')
        }
    }

    $candidatePaths += 'D:\Android\Sdk\platform-tools\adb.exe'

    $adbCommand = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($adbCommand) {
        $candidatePaths += $adbCommand.Source
    }

    foreach ($candidatePath in ($candidatePaths | Select-Object -Unique)) {
        if ($candidatePath -and (Test-Path $candidatePath)) {
            return (Resolve-Path $candidatePath).Path
        }
    }

    throw 'ADB não encontrado. Instale o Android SDK Platform-Tools ou configure ANDROID_SDK_ROOT/ANDROID_HOME.'
}

function Get-BudgetAdbDevices {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AdbPath
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $lines = & $AdbPath devices -l 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        throw "Falha ao consultar dispositivos ADB: $($lines -join [Environment]::NewLine)"
    }

    $devices = @()
    foreach ($line in $lines) {
        if ($line -match '^([^\s]+)\s+(device|offline|unauthorized)\b(.*)$') {
            $serial = $Matches[1]
            $state = $Matches[2]
            $details = $Matches[3].Trim()
            $model = $null

            if ($details -match '(?:^|\s)model:([^\s]+)') {
                $model = $Matches[1]
            }

            $devices += [PSCustomObject]@{
                Serial = $serial
                State = $state
                Model = $model
                Details = $details
                IsWifi = $serial -match ':\d+$'
            }
        }
    }

    return $devices
}

function Get-BudgetReadyDevice {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AdbPath,

        [string]$Target,

        [string]$PreferredModel = 'SM_S928B'
    )

    $devices = @(Get-BudgetAdbDevices -AdbPath $AdbPath)

    if ($Target) {
        $targetDevice = $devices | Where-Object { $_.Serial -eq $Target } | Select-Object -First 1
        if (-not $targetDevice) {
            return $null
        }

        if ($targetDevice.State -ne 'device') {
            throw "O dispositivo '$Target' está no estado '$($targetDevice.State)'."
        }

        return $targetDevice
    }

    $readyDevices = @($devices | Where-Object { $_.State -eq 'device' })
    $preferredDevices = @($readyDevices | Where-Object { $_.Model -eq $PreferredModel })

    if ($preferredDevices.Count -eq 1) {
        return $preferredDevices[0]
    }

    if ($preferredDevices.Count -gt 1) {
        $wifiPreferredDevices = @($preferredDevices | Where-Object { $_.IsWifi })
        if ($wifiPreferredDevices.Count -eq 1) {
            return $wifiPreferredDevices[0]
        }

        throw "Mais de um dispositivo $PreferredModel está conectado. Informe o alvo explicitamente."
    }

    if ($readyDevices.Count -eq 1) {
        return $readyDevices[0]
    }

    if ($readyDevices.Count -gt 1) {
        throw 'Mais de um dispositivo ADB está conectado. Informe o alvo explicitamente.'
    }

    return $null
}

function Get-BudgetTargetCachePath {
    $directory = Join-Path $env:LOCALAPPDATA 'BudgetApp'
    if (-not (Test-Path $directory)) {
        New-Item -Path $directory -ItemType Directory -Force | Out-Null
    }

    return (Join-Path $directory 'mobile-adb-target.txt')
}

function Get-BudgetCachedAdbTarget {
    $cachePath = Get-BudgetTargetCachePath
    if (-not (Test-Path $cachePath)) {
        return $null
    }

    $target = (Get-Content $cachePath -Raw).Trim()
    if ($target -match '^(?:\d{1,3}(?:\.\d{1,3}){3}|[A-Za-z0-9._-]+\.local):\d+$') {
        return $target
    }

    return $null
}

function Save-BudgetAdbTarget {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Target
    )

    $cachePath = Get-BudgetTargetCachePath
    Set-Content -Path $cachePath -Value $Target -Encoding ASCII
}

function Connect-BudgetDiscoveredDevices {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AdbPath
    )

    & $AdbPath start-server 2>&1 | Out-Null
    Start-Sleep -Milliseconds 300

    $output = & $AdbPath mdns services 2>&1
    if ($LASTEXITCODE -ne 0) {
        return @()
    }

    $targets = @()
    foreach ($line in $output) {
        if ($line -notmatch '_adb-tls-connect\._tcp') {
            continue
        }

        $matches = [regex]::Matches($line, '(?:\d{1,3}(?:\.\d{1,3}){3}|[A-Za-z0-9._-]+\.local):\d+')
        foreach ($match in $matches) {
            $targets += $match.Value
        }
    }

    $connectedTargets = @()
    foreach ($target in ($targets | Select-Object -Unique)) {
        $connectOutput = & $AdbPath connect $target 2>&1
        if ($LASTEXITCODE -eq 0 -and ($connectOutput -join ' ') -notmatch 'failed|cannot|unable|refused') {
            Save-BudgetAdbTarget -Target $target
            $connectedTargets += $target
        }
    }

    return $connectedTargets
}

function Connect-BudgetCachedDevice {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AdbPath
    )

    $cachedTarget = Get-BudgetCachedAdbTarget
    if (-not $cachedTarget) {
        return $null
    }

    try {
        Connect-BudgetAdbTarget -AdbPath $AdbPath -Target $cachedTarget | Out-Null
        return $cachedTarget
    }
    catch {
        return $null
    }
}

function Connect-BudgetAdbTarget {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AdbPath,

        [Parameter(Mandatory = $true)]
        [string]$Target
    )

    if ($Target -notmatch '^(?:\d{1,3}(?:\.\d{1,3}){3}|[A-Za-z0-9._-]+\.local):\d+$') {
        throw "Alvo invalido: '$Target'. Use IP:PORTA, por exemplo 192.168.1.114:46575."
    }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & $AdbPath connect $Target 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0 -or ($output -join ' ') -match 'failed|cannot|unable|refused') {
        throw "Falha ao conectar ao dispositivo ${Target}: $($output -join [Environment]::NewLine)"
    }

    Save-BudgetAdbTarget -Target $Target
    return ($output -join [Environment]::NewLine)
}
