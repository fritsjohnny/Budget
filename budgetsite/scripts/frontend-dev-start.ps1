$started = [Diagnostics.Stopwatch]::StartNew()
. (Join-Path $PSScriptRoot 'frontend-dev-common.ps1')
$stage = 'validate-frontend'
$device = $null
$adb = $null
$adbReverseConfigured = $false
$reverseManaged = $false
$processId = 0
$alreadyRunning = $false
$startedAt = ''
try {
    if (-not (Test-Path -LiteralPath $script:FrontendRoot -PathType Container)) { throw 'Diretório do frontend autorizado não encontrado.' }
    if (-not (Test-Path -LiteralPath (Join-Path $script:FrontendRoot 'package.json') -PathType Leaf)) { throw 'package.json não encontrado no frontend autorizado.' }
    Initialize-BudgetFrontendRuntime

    $stage = 'process-check'
    $state = Get-BudgetFrontendState
    $listener = Get-BudgetFrontendListener
    if ($listener -and -not (Test-BudgetListenerOwned -Listener $listener -State $state)) {
        throw "A porta 4200 está ocupada pelo processo externo PID $($listener.OwningProcess). Nenhum processo foi encerrado ou iniciado."
    }
    if ($state -and (Test-BudgetFrontendOwnedProcess -State $state)) {
        $processId = [int]$state.processId
        $startedAt = [string]$state.startedAt
        $alreadyRunning = $true
    }
    else {
        if ($state) { Remove-BudgetFrontendState }
        $stage = 'process-start'
        Set-Content -LiteralPath $script:StdoutPath -Value '' -Encoding UTF8
        Set-Content -LiteralPath $script:StderrPath -Value '' -Encoding UTF8
        $arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', "`"$($script:HostScriptPath)`"")
        $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WorkingDirectory $script:FrontendRoot -RedirectStandardOutput $script:StdoutPath -RedirectStandardError $script:StderrPath -WindowStyle Hidden -PassThru
        $processId = $process.Id
        $startedAt = [DateTimeOffset]::Now.ToString('o')
        Save-BudgetFrontendState -ProcessId $processId -StartedAt $startedAt
    }

    $stage = 'frontend-readiness'
    $deadline = [DateTime]::UtcNow.AddSeconds(210)
    $http = $null
    do {
        Start-Sleep -Milliseconds 500
        $state = Get-BudgetFrontendState
        if (-not (Test-BudgetFrontendOwnedProcess -State $state)) { throw 'O processo Angular terminou antes de ficar pronto. Consulte os logs retornados.' }
        $listener = Get-BudgetFrontendListener
        if ($listener -and (Test-BudgetListenerOwned -Listener $listener -State $state)) {
            $http = Get-BudgetFrontendHttp
            if ($http.Healthy) { break }
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $http -or -not $http.Healthy) { throw 'O Angular não respondeu por HTTP dentro do prazo de inicialização.' }

    $stage = 'adb'
    $adb = Get-BudgetFrontendAdbSnapshot
    if ($adb.Device) {
        $device = $adb.Device
        $reverseAlreadyPresent = Test-BudgetReverse -AdbPath $adb.AdbPath -DeviceId $device.Serial
        if (-not $reverseAlreadyPresent) {
            $adbReverseConfigured = Set-BudgetReverse -AdbPath $adb.AdbPath -DeviceId $device.Serial
            $reverseManaged = $adbReverseConfigured
        }
        else { $adbReverseConfigured = $true }
        $previousManaged = [bool]($state -and $state.PSObject.Properties['reverseManaged'] -and $state.reverseManaged -and [string]$state.deviceId -eq $device.Serial)
        $reverseManaged = $reverseManaged -or $previousManaged
        Save-BudgetFrontendState -ProcessId $processId -DeviceId $device.Serial -ReverseManaged $reverseManaged -StartedAt $startedAt
    }

    $status = if ($adbReverseConfigured) { 'running-mobile-ready' } else { 'running-adb-unavailable' }
    $message = if ($adbReverseConfigured) { $(if ($alreadyRunning) { 'Frontend já estava saudável; ADB Reverse confirmado.' } else { 'Frontend iniciado; HTTP e ADB Reverse confirmados.' }) } else { "Frontend saudável, mas localhost no celular não foi configurado: $($adb.Error)" }
    Write-BudgetJson ([ordered]@{
        success = $true; status = $status; operation = 'frontend-dev-start'; message = $message
        pid = $processId; processId = $processId; processRunning = $true; port = $script:Port; portListening = $true; httpResponding = $true
        localUrl = $script:LocalUrl; mobileUrl = $script:LocalUrl; appUrl = $script:AppUrl; networkUrl = Get-BudgetActiveIpv4Url
        adbDevice = $(if ($device) { $device.Serial } else { '' }); adbDeviceModel = $(if ($device) { [string]$device.Model } else { '' })
        adbDevices = @($adb.Devices | ForEach-Object { [ordered]@{ serial = $_.Serial; state = $_.State; model = [string]$_.Model } })
        adbReverseConfigured = $adbReverseConfigured; reverseConfigured = $adbReverseConfigured; reverseManagedByTool = $reverseManaged
        startedAt = $startedAt; frontendAlreadyRunning = $alreadyRunning
        stdoutTail = Get-BudgetLogTail -Path $script:StdoutPath; stderrTail = Get-BudgetLogTail -Path $script:StderrPath
        failedStage = ''; error = ''; exitCode = 0; durationMs = $started.ElapsedMilliseconds; timedOut = $false
    })
    exit 0
}
catch {
    $originalError = $_.Exception.Message
    $cleanupError = ''
    $stateNow = Get-BudgetFrontendState
    $running = Test-BudgetFrontendOwnedProcess -State $stateNow
    if (-not $alreadyRunning -and $running) {
        try {
            Stop-BudgetFrontendProcessTree -State $stateNow | Out-Null
            Remove-BudgetFrontendState
            $running = $false
        }
        catch {
            $cleanupError = " Falha adicional ao limpar a árvore registrada: $($_.Exception.Message)"
            $running = Test-BudgetFrontendOwnedProcess -State $stateNow
        }
    }
    $errorMessage = "$originalError$cleanupError"
    Write-BudgetJson ([ordered]@{
        success = $false; status = 'error'; operation = 'frontend-dev-start'; message = $errorMessage; error = $errorMessage
        pid = $processId; processId = $processId; processRunning = $running; port = $script:Port
        portListening = [bool](Get-BudgetFrontendListener); httpResponding = $false; localUrl = $script:LocalUrl; mobileUrl = $script:LocalUrl; appUrl = $script:AppUrl
        adbDevice = $(if ($device) { $device.Serial } else { '' }); adbReverseConfigured = $adbReverseConfigured; reverseConfigured = $adbReverseConfigured
        startedAt = $startedAt; stdoutTail = Get-BudgetLogTail -Path $script:StdoutPath; stderrTail = Get-BudgetLogTail -Path $script:StderrPath
        failedStage = $stage; exitCode = 1; durationMs = $started.ElapsedMilliseconds; timedOut = ($stage -eq 'frontend-readiness')
    })
    exit 1
}
