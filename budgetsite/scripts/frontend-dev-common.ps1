Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'mobile-common.ps1')

$script:FrontendRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script:RuntimeRoot = Join-Path $PSScriptRoot '.runtime\frontend-dev'
$script:StatePath = Join-Path $script:RuntimeRoot 'state.json'
$script:StdoutPath = Join-Path $script:RuntimeRoot 'stdout.log'
$script:StderrPath = Join-Path $script:RuntimeRoot 'stderr.log'
$script:HostScriptPath = Join-Path $PSScriptRoot 'frontend-dev-host.ps1'
$script:Port = 4200
$script:LocalUrl = 'http://localhost:4200'
$script:AppUrl = 'http://localhost:4200/#/budget'
$script:HealthUrl = 'http://127.0.0.1:4200'
$script:MaxLogCharacters = 8000

function Initialize-BudgetFrontendRuntime {
    if (-not (Test-Path -LiteralPath $script:RuntimeRoot)) {
        New-Item -Path $script:RuntimeRoot -ItemType Directory -Force | Out-Null
    }
}

function Get-BudgetFrontendState {
    if (-not (Test-Path -LiteralPath $script:StatePath -PathType Leaf)) { return $null }
    try {
        $state = Get-Content -LiteralPath $script:StatePath -Raw | ConvertFrom-Json
        if (-not $state.processId -or $state.port -ne $script:Port) { return $null }
        return $state
    }
    catch { return $null }
}

function Save-BudgetFrontendState {
    param([int]$ProcessId, [string]$DeviceId = '', [bool]$ReverseManaged = $false, [string]$StartedAt = '')
    Initialize-BudgetFrontendRuntime
    if ([string]::IsNullOrWhiteSpace($StartedAt)) { $StartedAt = [DateTimeOffset]::Now.ToString('o') }
    $state = [ordered]@{
        processId = $ProcessId
        startedAt = $StartedAt
        port = $script:Port
        frontendRoot = $script:FrontendRoot
        deviceId = $DeviceId
        reverseManaged = $ReverseManaged
        expectedCommand = 'frontend-dev-host.ps1'
    }
    $temporaryPath = "$($script:StatePath).tmp"
    $state | ConvertTo-Json | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
    Move-Item -LiteralPath $temporaryPath -Destination $script:StatePath -Force
}

function Remove-BudgetFrontendState {
    if (Test-Path -LiteralPath $script:StatePath) {
        Remove-Item -LiteralPath $script:StatePath -Force
    }
}

function Get-BudgetProcess {
    param([int]$ProcessId)
    return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Test-BudgetFrontendOwnedProcess {
    param($State)
    if (-not $State) { return $false }
    $process = Get-BudgetProcess -ProcessId ([int]$State.processId)
    if (-not $process) { return $false }
    $commandLine = [string]$process.CommandLine
    return $process.Name -ieq 'powershell.exe' -and
        $commandLine.IndexOf($script:HostScriptPath, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        [string]$State.frontendRoot -ieq $script:FrontendRoot -and
        [string]$State.expectedCommand -eq 'frontend-dev-host.ps1'
}

function Get-BudgetProcessTreeIds {
    param([int]$RootProcessId)
    $all = @(Get-CimInstance Win32_Process)
    $result = New-Object System.Collections.Generic.List[int]
    $pending = New-Object System.Collections.Generic.Queue[int]
    $pending.Enqueue($RootProcessId)
    while ($pending.Count -gt 0) {
        $parent = $pending.Dequeue()
        foreach ($child in @($all | Where-Object { [int]$_.ParentProcessId -eq $parent })) {
            $childId = [int]$child.ProcessId
            if (-not $result.Contains($childId)) {
                $result.Add($childId)
                $pending.Enqueue($childId)
            }
        }
    }
    $result.Add($RootProcessId)
    return @($result)
}

function Stop-BudgetFrontendProcessTree {
    param($State)
    if (-not (Test-BudgetFrontendOwnedProcess -State $State)) {
        return [PSCustomObject]@{ Stopped = $false; ProcessIds = @(); RemainingProcessIds = @() }
    }

    $rootProcessId = [int]$State.processId
    $processIds = @(Get-BudgetProcessTreeIds -RootProcessId $rootProcessId)
    $taskkillPath = Join-Path $env:SystemRoot 'System32\taskkill.exe'
    if (-not (Test-Path -LiteralPath $taskkillPath -PathType Leaf)) {
        throw 'taskkill.exe não foi encontrado no caminho fixo do Windows.'
    }

    $output = @(& $taskkillPath /PID $rootProcessId /T /F 2>&1)
    $taskkillExitCode = $LASTEXITCODE
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    do {
        $remaining = @($processIds | Where-Object { Get-BudgetProcess -ProcessId $_ })
        if ($remaining.Count -eq 0) { break }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)

    if ($remaining.Count -gt 0) {
        throw "Não foi possível encerrar todos os processos registrados. PIDs restantes: $($remaining -join ', '). taskkill exit code: $taskkillExitCode. $($output -join ' ')"
    }

    return [PSCustomObject]@{ Stopped = $true; ProcessIds = $processIds; RemainingProcessIds = @() }
}

function Get-BudgetFrontendListener {
    $listeners = @(Get-NetTCPConnection -LocalPort $script:Port -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) { return $null }
    return $listeners | Select-Object -First 1
}

function Test-BudgetListenerOwned {
    param($Listener, $State)
    if (-not $Listener -or -not (Test-BudgetFrontendOwnedProcess -State $State)) { return $false }
    $tree = @(Get-BudgetProcessTreeIds -RootProcessId ([int]$State.processId))
    return $tree -contains [int]$Listener.OwningProcess
}

function Get-BudgetFrontendHttp {
    try {
        $response = Invoke-WebRequest -Uri $script:HealthUrl -UseBasicParsing -TimeoutSec 3
        return [PSCustomObject]@{ Healthy = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400); StatusCode = [int]$response.StatusCode; Error = '' }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        return [PSCustomObject]@{ Healthy = $false; StatusCode = $statusCode; Error = $_.Exception.Message }
    }
}

function Get-BudgetLogTail {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
    $value = Get-Content -LiteralPath $Path -Tail 120 -ErrorAction SilentlyContinue | Out-String
    if ($value.Length -gt $script:MaxLogCharacters) {
        return $value.Substring($value.Length - $script:MaxLogCharacters)
    }
    return $value
}

function Invoke-BudgetFrontendAdb {
    param(
        [string]$AdbPath,
        [string[]]$Arguments,
        [int]$TimeoutSeconds = 12
    )
    if ($TimeoutSeconds -lt 1 -or $TimeoutSeconds -gt 30) { throw 'Timeout ADB fora do intervalo permitido.' }
    foreach ($argument in $Arguments) {
        if ($argument -notmatch '^[A-Za-z0-9._:-]+$') { throw "Argumento ADB interno inválido: $argument" }
    }

    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $AdbPath
    $startInfo.Arguments = ($Arguments -join ' ')
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
        if (-not $process.Start()) { throw 'Não foi possível iniciar o ADB.' }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            try { $process.Kill() } catch {}
            throw "ADB excedeu o timeout controlado de $TimeoutSeconds segundos."
        }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        return [PSCustomObject]@{ ExitCode = $process.ExitCode; Stdout = $stdout; Stderr = $stderr }
    }
    finally {
        $process.Dispose()
    }
}

function Get-BudgetFrontendAdbDevices {
    param([string]$AdbPath)
    $result = Invoke-BudgetFrontendAdb -AdbPath $AdbPath -Arguments @('devices', '-l')
    if ($result.ExitCode -ne 0) { throw "Falha ao consultar dispositivos ADB: $($result.Stderr.Trim())" }
    $devices = @()
    foreach ($line in ($result.Stdout -split "(`r`n|`n|`r)")) {
        if ($line -match '^([^\s]+)\s+(device|offline|unauthorized)\b(.*)$') {
            $serial = $Matches[1]
            $state = $Matches[2]
            $details = $Matches[3].Trim()
            $model = ''
            if ($details -match '(?:^|\s)model:([^\s]+)') { $model = $Matches[1] }
            $devices += [PSCustomObject]@{ Serial = $serial; State = $state; Model = $model; Details = $details }
        }
    }
    return $devices
}

function Test-BudgetReverse {
    param([string]$AdbPath, [string]$DeviceId)
    $result = Invoke-BudgetFrontendAdb -AdbPath $AdbPath -Arguments @('-s', $DeviceId, 'reverse', '--list')
    if ($result.ExitCode -ne 0) { return $false }
    return [bool](($result.Stdout -split "(`r`n|`n|`r)") | Where-Object { $_ -match '(?:^|\s)tcp:4200\s+tcp:4200(?:\s|$)' })
}

function Set-BudgetReverse {
    param([string]$AdbPath, [string]$DeviceId)
    $result = Invoke-BudgetFrontendAdb -AdbPath $AdbPath -Arguments @('-s', $DeviceId, 'reverse', 'tcp:4200', 'tcp:4200')
    if ($result.ExitCode -ne 0) { throw "Falha ao configurar ADB Reverse: $($result.Stderr.Trim())" }
    return (Test-BudgetReverse -AdbPath $AdbPath -DeviceId $DeviceId)
}

function Remove-BudgetReverse {
    param([string]$AdbPath, [string]$DeviceId)
    if (-not (Test-BudgetReverse -AdbPath $AdbPath -DeviceId $DeviceId)) { return $false }
    $result = Invoke-BudgetFrontendAdb -AdbPath $AdbPath -Arguments @('-s', $DeviceId, 'reverse', '--remove', 'tcp:4200')
    if ($result.ExitCode -ne 0) { throw "Falha ao remover ADB Reverse: $($result.Stderr.Trim())" }
    return $true
}

function Write-BudgetJson {
    param($Value)
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::Out.WriteLine(($Value | ConvertTo-Json -Depth 8))
}

function Get-BudgetFrontendAdbSnapshot {
    $result = [ordered]@{ Available = $false; Devices = @(); Device = $null; Error = ''; AdbPath = '' }
    try {
        $result.AdbPath = Get-BudgetAdbPath
        $result.Available = $true
        $result.Devices = @(Get-BudgetFrontendAdbDevices -AdbPath $result.AdbPath)
        $ready = @($result.Devices | Where-Object { $_.State -eq 'device' })
        if ($ready.Count -eq 1) { $result.Device = $ready[0] }
        elseif ($ready.Count -gt 1) { $result.Error = "Mais de um dispositivo ADB pronto: $(@($ready | ForEach-Object Serial) -join ', ')." }
        else { $result.Error = 'Nenhum dispositivo ADB pronto.' }
    }
    catch { $result.Error = $_.Exception.Message }
    return [PSCustomObject]$result
}

function Get-BudgetActiveIpv4Url {
    try {
        $address = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction Stop |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual|VPN' } |
            Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress
        if ($address) { return "http://${address}:$($script:Port)" }
    }
    catch {}
    return ''
}
