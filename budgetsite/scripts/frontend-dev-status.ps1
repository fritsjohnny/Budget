$started = [Diagnostics.Stopwatch]::StartNew()
. (Join-Path $PSScriptRoot 'frontend-dev-common.ps1')
$adbAvailable = $false
$device = $null
$reverseConfigured = $false
$adbError = ''
try {
    try {
        $adbPath = Get-BudgetAdbPath
        $adbAvailable = $true
        $devices = @(Get-BudgetAdbDevices -AdbPath $adbPath)
        $ready = @($devices | Where-Object { $_.State -eq 'device' })
        if ($ready.Count -eq 1) {
            $device = $ready[0]
            $reverseConfigured = Test-BudgetReverse -AdbPath $adbPath -DeviceId $device.Serial
        }
        elseif ($ready.Count -gt 1) {
            $adbError = "Mais de um dispositivo pronto: $(@($ready | ForEach-Object Serial) -join ', ')"
        }
        else { $adbError = 'Nenhum dispositivo ADB pronto.' }
    }
    catch { $adbError = $_.Exception.Message }

    $state = Get-BudgetFrontendState
    $savedPid = if ($state) { [int]$state.processId } else { 0 }
    $ownedProcessActive = Test-BudgetFrontendOwnedProcess -State $state
    $savedPidMissing = [bool]($state -and -not $ownedProcessActive)
    $listener = Get-BudgetFrontendListener
    $portListening = [bool]$listener
    $listenerOwned = Test-BudgetListenerOwned -Listener $listener -State $state
    $externalPid = if ($listener -and -not $listenerOwned) { [int]$listener.OwningProcess } else { 0 }
    $http = if ($listener) { Get-BudgetFrontendHttp } else { [PSCustomObject]@{ Healthy = $false; StatusCode = 0; Error = 'Porta 4200 sem listener.' } }
    $frontendReady = $ownedProcessActive -and $listenerOwned -and $http.Healthy
    $compiling = $ownedProcessActive -and (-not $listenerOwned -or -not $http.Healthy)
    $message = if ($frontendReady) { 'Frontend pronto.' } elseif ($externalPid) { "Processo externo PID $externalPid ocupa a porta 4200." } elseif ($savedPidMissing) { 'O PID salvo não existe mais ou não corresponde ao processo esperado.' } elseif ($compiling) { 'Angular em execução, compilando ou ainda sem resposta HTTP saudável.' } else { 'Frontend iniciado pela ferramenta não está em execução.' }

    Write-BudgetJson ([ordered]@{
        success = $true; operation = 'frontend-dev-status'; message = $message; adbAvailable = $adbAvailable
        deviceReady = [bool]$device; deviceId = $(if ($device) { $device.Serial } else { '' }); deviceModel = $(if ($device) { [string]$device.Model } else { '' })
        adbError = $adbError; reverseConfigured = $reverseConfigured; portListening = $portListening; listenerProcessId = $(if ($listener) { [int]$listener.OwningProcess } else { 0 })
        savedProcessId = $savedPid; savedProcessActive = $ownedProcessActive; savedPidMissing = $savedPidMissing
        processStartedByTool = $ownedProcessActive; externalProcessOnPort = [bool]$externalPid; externalProcessId = $externalPid
        angularCompiling = $compiling; frontendRunning = $ownedProcessActive; frontendReady = $frontendReady
        httpHealthy = $http.Healthy; httpStatusCode = $http.StatusCode; httpError = $http.Error; port = $script:Port
        mobileUrl = $script:Url; localUrl = $script:Url; stdoutLog = $script:StdoutPath; stderrLog = $script:StderrPath
        stdoutTail = Get-BudgetLogTail -Path $script:StdoutPath; stderrTail = Get-BudgetLogTail -Path $script:StderrPath
        failedStage = ''; exitCode = 0; durationMs = $started.ElapsedMilliseconds; timedOut = $false
    })
    exit 0
}
catch {
    Write-BudgetJson ([ordered]@{ success = $false; operation = 'frontend-dev-status'; message = $_.Exception.Message; failedStage = 'status'; exitCode = 1; durationMs = $started.ElapsedMilliseconds; timedOut = $false })
    exit 1
}
