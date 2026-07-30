$started = [Diagnostics.Stopwatch]::StartNew()
. (Join-Path $PSScriptRoot 'frontend-dev-common.ps1')
try {
    $adb = Get-BudgetFrontendAdbSnapshot
    $device = $adb.Device
    $reverseConfigured = if ($device) { Test-BudgetReverse -AdbPath $adb.AdbPath -DeviceId $device.Serial } else { $false }

    $state = Get-BudgetFrontendState
    $registeredProcessId = if ($state) { [int]$state.processId } else { 0 }
    $processRunning = Test-BudgetFrontendOwnedProcess -State $state
    $stalePid = [bool]($state -and -not $processRunning)
    $listener = Get-BudgetFrontendListener
    $portListening = [bool]$listener
    $listenerOwned = Test-BudgetListenerOwned -Listener $listener -State $state
    $externalPid = if ($listener -and -not $listenerOwned) { [int]$listener.OwningProcess } else { 0 }
    $http = if ($listener) { Get-BudgetFrontendHttp } else { [PSCustomObject]@{ Healthy = $false; StatusCode = 0; Error = 'Porta 4200 sem listener.' } }
    $healthy = $processRunning -and $listenerOwned -and $http.Healthy
    $status = if ($healthy -and $reverseConfigured) { 'running-mobile-ready' } elseif ($healthy) { 'running-adb-unavailable' } elseif ($externalPid) { 'external-process-on-port' } elseif ($processRunning) { 'starting-or-unhealthy' } elseif ($stalePid) { 'stale-state' } else { 'stopped' }
    $message = switch ($status) {
        'running-mobile-ready' { 'Frontend saudável e ADB Reverse confirmado.' }
        'running-adb-unavailable' { "Frontend saudável, mas localhost no celular não está configurado: $($adb.Error)" }
        'external-process-on-port' { "Processo externo PID $externalPid ocupa a porta 4200." }
        'starting-or-unhealthy' { 'Processo da tool ativo, porém listener ou HTTP ainda não está saudável.' }
        'stale-state' { 'O PID registrado está obsoleto ou não pertence mais à tool.' }
        default { 'Frontend iniciado pela tool está parado.' }
    }

    Write-BudgetJson ([ordered]@{
        success = $true; status = $status; operation = 'frontend-dev-status'; message = $message
        processRunning = $processRunning; portListening = $portListening; httpResponding = $http.Healthy
        pid = $registeredProcessId; processId = $registeredProcessId; listenerProcessId = $(if ($listener) { [int]$listener.OwningProcess } else { 0 }); port = $script:Port
        localUrl = $script:LocalUrl; mobileUrl = $script:LocalUrl; appUrl = $script:AppUrl; networkUrl = Get-BudgetActiveIpv4Url
        adbAvailable = $adb.Available; adbDevice = $(if ($device) { $device.Serial } else { '' }); adbDeviceModel = $(if ($device) { [string]$device.Model } else { '' })
        adbDevices = @($adb.Devices | ForEach-Object { [ordered]@{ serial = $_.Serial; state = $_.State; model = [string]$_.Model } })
        adbError = $adb.Error; adbReverseConfigured = $reverseConfigured; reverseConfigured = $reverseConfigured
        startedAt = $(if ($state) { [string]$state.startedAt } else { '' }); stalePid = $stalePid; processStartedByTool = $processRunning
        externalProcessOnPort = [bool]$externalPid; externalProcessId = $externalPid; httpStatusCode = $http.StatusCode; httpError = $http.Error
        stdoutTail = Get-BudgetLogTail -Path $script:StdoutPath; stderrTail = Get-BudgetLogTail -Path $script:StderrPath
        failedStage = ''; error = ''; exitCode = 0; durationMs = $started.ElapsedMilliseconds; timedOut = $false
    })
    exit 0
}
catch {
    Write-BudgetJson ([ordered]@{ success = $false; status = 'error'; operation = 'frontend-dev-status'; message = $_.Exception.Message; error = $_.Exception.Message; failedStage = 'status'; exitCode = 1; durationMs = $started.ElapsedMilliseconds; timedOut = $false })
    exit 1
}
