$started = [Diagnostics.Stopwatch]::StartNew()
. (Join-Path $PSScriptRoot 'frontend-dev-common.ps1')
$stage = 'validate-frontend'
$device = $null
$reverseConfigured = $false
$processId = 0
$alreadyRunning = $false
try {
    if (-not (Test-Path -LiteralPath $script:FrontendRoot -PathType Container)) { throw 'Diretório do frontend autorizado não encontrado.' }
    if (-not (Test-Path -LiteralPath (Join-Path $script:FrontendRoot 'package.json') -PathType Leaf)) { throw 'package.json não encontrado no frontend autorizado.' }
    Initialize-BudgetFrontendRuntime

    $stage = 'adb'
    $adbPath = Get-BudgetAdbPath
    $device = Get-BudgetExactlyOneReadyDevice -AdbPath $adbPath
    $stage = 'adb-reverse'
    $reverseConfigured = Set-BudgetReverse -AdbPath $adbPath -DeviceId $device.Serial

    $stage = 'process-check'
    $state = Get-BudgetFrontendState
    $listener = Get-BudgetFrontendListener
    if ($listener -and -not (Test-BudgetListenerOwned -Listener $listener -State $state)) {
        throw "A porta 4200 está ocupada pelo processo externo PID $($listener.OwningProcess). Nenhum processo foi encerrado ou iniciado."
    }
    if ($state -and (Test-BudgetFrontendOwnedProcess -State $state)) {
        $processId = [int]$state.processId
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
        Save-BudgetFrontendState -ProcessId $processId -DeviceId $device.Serial
    }

    $stage = 'frontend-readiness'
    $deadline = [DateTime]::UtcNow.AddSeconds(55)
    $http = $null
    do {
        Start-Sleep -Milliseconds 500
        if (-not (Test-BudgetFrontendOwnedProcess -State (Get-BudgetFrontendState))) {
            throw "O processo Angular terminou antes de ficar pronto. Consulte os logs retornados."
        }
        $listener = Get-BudgetFrontendListener
        if ($listener -and (Test-BudgetListenerOwned -Listener $listener -State (Get-BudgetFrontendState))) {
            $http = Get-BudgetFrontendHttp
            if ($http.Healthy) { break }
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $http -or -not $http.Healthy) { throw 'O Angular continua compilando ou não respondeu por HTTP dentro do prazo.' }

    Write-BudgetJson ([ordered]@{
        success = $true; operation = 'frontend-dev-start'; message = $(if ($alreadyRunning) { 'Frontend já estava em execução e o ADB Reverse foi confirmado.' } else { 'Frontend iniciado e pronto para acesso pelo celular.' })
        deviceReady = $true; deviceId = $device.Serial; deviceModel = [string]$device.Model; reverseConfigured = $reverseConfigured
        frontendRunning = $true; frontendAlreadyRunning = $alreadyRunning; processId = $processId; port = $script:Port
        mobileUrl = $script:Url; localUrl = $script:Url; stdoutLog = $script:StdoutPath; stderrLog = $script:StderrPath
        failedStage = ''; exitCode = 0; durationMs = $started.ElapsedMilliseconds; timedOut = $false
    })
    exit 0
}
catch {
    Write-BudgetJson ([ordered]@{
        success = $false; operation = 'frontend-dev-start'; message = $_.Exception.Message
        deviceReady = [bool]$device; deviceId = $(if ($device) { $device.Serial } else { '' }); deviceModel = $(if ($device) { [string]$device.Model } else { '' })
        reverseConfigured = $reverseConfigured; frontendRunning = [bool](Test-BudgetFrontendOwnedProcess -State (Get-BudgetFrontendState))
        frontendAlreadyRunning = $alreadyRunning; processId = $processId; port = $script:Port; mobileUrl = $script:Url; localUrl = $script:Url
        stdoutLog = $script:StdoutPath; stderrLog = $script:StderrPath; stdoutTail = Get-BudgetLogTail -Path $script:StdoutPath; stderrTail = Get-BudgetLogTail -Path $script:StderrPath
        failedStage = $stage; exitCode = 1; durationMs = $started.ElapsedMilliseconds; timedOut = ($stage -eq 'frontend-readiness')
    })
    exit 1
}
