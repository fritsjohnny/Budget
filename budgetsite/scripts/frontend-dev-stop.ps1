$started = [Diagnostics.Stopwatch]::StartNew()
. (Join-Path $PSScriptRoot 'frontend-dev-common.ps1')
$stage = 'process-check'
$processStopped = $false
$reverseRemoved = $false
$processId = 0
try {
    $state = Get-BudgetFrontendState
    if ($state) { $processId = [int]$state.processId }
    if ($state -and (Test-BudgetFrontendOwnedProcess -State $state)) {
        $stage = 'process-stop'
        $tree = @(Get-BudgetProcessTreeIds -RootProcessId $processId)
        foreach ($id in $tree) {
            Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        }
        $deadline = [DateTime]::UtcNow.AddSeconds(10)
        while ((Get-BudgetProcess -ProcessId $processId) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 200 }
        if (Get-BudgetProcess -ProcessId $processId) { throw "Não foi possível encerrar a árvore registrada do PID $processId." }
        $processStopped = $true
    }
    elseif ($state) {
        $processId = [int]$state.processId
    }

    $stage = 'adb-reverse-remove'
    try {
        $adbPath = Get-BudgetAdbPath
        $deviceId = if ($state -and $state.deviceId) { [string]$state.deviceId } else { '' }
        if ($deviceId) {
            $available = @(Get-BudgetAdbDevices -AdbPath $adbPath | Where-Object { $_.Serial -eq $deviceId -and $_.State -eq 'device' })
            if ($available.Count -eq 1) { $reverseRemoved = Remove-BudgetReverse -AdbPath $adbPath -DeviceId $deviceId }
        }
    }
    catch {
        # O processo já foi encerrado com segurança; ausência/reinício do ADB não torna o stop inseguro.
    }
    Remove-BudgetFrontendState
    Write-BudgetJson ([ordered]@{
        success = $true; operation = 'frontend-dev-stop'; message = $(if ($processStopped) { 'Frontend encerrado e estado invalidado.' } else { 'Frontend já estava parado; estado invalidado.' })
        processStopped = $processStopped; reverseRemoved = $reverseRemoved; processId = $processId; port = $script:Port
        failedStage = ''; exitCode = 0; durationMs = $started.ElapsedMilliseconds; timedOut = $false
    })
    exit 0
}
catch {
    Write-BudgetJson ([ordered]@{
        success = $false; operation = 'frontend-dev-stop'; message = $_.Exception.Message; processStopped = $processStopped
        reverseRemoved = $reverseRemoved; processId = $processId; port = $script:Port; failedStage = $stage
        exitCode = 1; durationMs = $started.ElapsedMilliseconds; timedOut = $false
    })
    exit 1
}
