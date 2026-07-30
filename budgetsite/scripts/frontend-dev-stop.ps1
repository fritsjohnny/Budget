$started = [Diagnostics.Stopwatch]::StartNew()
. (Join-Path $PSScriptRoot 'frontend-dev-common.ps1')
$stage = 'process-check'
$processStopped = $false
$reverseRemoved = $false
$processId = 0
try {
    $state = Get-BudgetFrontendState
    if ($state) { $processId = [int]$state.processId }
    $ownedBefore = Test-BudgetFrontendOwnedProcess -State $state
    if ($ownedBefore) {
        $stage = 'process-stop'
        $stopResult = Stop-BudgetFrontendProcessTree -State $state
        $processStopped = $stopResult.Stopped
    }

    $stage = 'adb-reverse-remove'
    $reverseManaged = [bool]($state -and $state.PSObject.Properties['reverseManaged'] -and $state.reverseManaged)
    $deviceId = if ($state -and $state.deviceId) { [string]$state.deviceId } else { '' }
    if ($reverseManaged -and $deviceId) {
        try {
            $adb = Get-BudgetFrontendAdbSnapshot
            $matchingDevice = @($adb.Devices | Where-Object { $_.Serial -eq $deviceId -and $_.State -eq 'device' })
            if ($matchingDevice.Count -eq 1) { $reverseRemoved = Remove-BudgetReverse -AdbPath $adb.AdbPath -DeviceId $deviceId }
        }
        catch {}
    }
    Remove-BudgetFrontendState

    $stage = 'shutdown-verification'
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $listener = Get-BudgetFrontendListener
        $http = if ($listener) { Get-BudgetFrontendHttp } else { [PSCustomObject]@{ Healthy = $false; StatusCode = 0; Error = 'Porta 4200 sem listener.' } }
        if (-not $listener -and -not $http.Healthy) { break }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    $processRunning = [bool](Get-BudgetProcess -ProcessId $processId)
    $portListening = [bool]$listener
    $httpResponding = $http.Healthy
    $externalPid = if ($listener) { [int]$listener.OwningProcess } else { 0 }
    $status = if (-not $processRunning -and -not $portListening -and -not $httpResponding) { 'stopped' } elseif (-not $processRunning -and $externalPid) { 'tool-stopped-external-port-active' } else { 'stop-incomplete' }
    $success = -not $processRunning
    $message = if ($status -eq 'stopped') { $(if ($processStopped) { 'Frontend encerrado; processo, porta e HTTP confirmados como inativos.' } else { 'Frontend já estava parado; estado obsoleto removido e porta confirmada como inativa.' }) } elseif ($status -eq 'tool-stopped-external-port-active') { "O processo da tool foi encerrado, mas o processo externo PID $externalPid está na porta 4200 e não foi alterado." } else { 'Não foi possível confirmar completamente o encerramento do processo da tool.' }

    Write-BudgetJson ([ordered]@{
        success = $success; status = $status; operation = 'frontend-dev-stop'; message = $message; error = $(if ($success) { '' } else { $message })
        processStopped = $processStopped; processRunning = $processRunning; pid = $processId; processId = $processId
        port = $script:Port; portListening = $portListening; httpResponding = $httpResponding; externalProcessId = $externalPid
        adbDevice = $deviceId; adbReverseRemoved = $reverseRemoved; reverseRemoved = $reverseRemoved
        localUrl = $script:LocalUrl; mobileUrl = $script:LocalUrl
        stdoutTail = Get-BudgetLogTail -Path $script:StdoutPath; stderrTail = Get-BudgetLogTail -Path $script:StderrPath
        failedStage = $(if ($success) { '' } else { $stage }); exitCode = $(if ($success) { 0 } else { 1 }); durationMs = $started.ElapsedMilliseconds; timedOut = $false
    })
    exit $(if ($success) { 0 } else { 1 })
}
catch {
    Write-BudgetJson ([ordered]@{
        success = $false; status = 'error'; operation = 'frontend-dev-stop'; message = $_.Exception.Message; error = $_.Exception.Message
        processStopped = $processStopped; pid = $processId; processId = $processId; port = $script:Port; adbReverseRemoved = $reverseRemoved
        failedStage = $stage; exitCode = 1; durationMs = $started.ElapsedMilliseconds; timedOut = $false
    })
    exit 1
}
