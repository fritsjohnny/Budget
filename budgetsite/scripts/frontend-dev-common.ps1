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
$script:Url = 'http://localhost:4200/#/budget'
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
    param([int]$ProcessId, [string]$DeviceId)
    Initialize-BudgetFrontendRuntime
    $state = [ordered]@{
        processId = $ProcessId
        startedAt = [DateTimeOffset]::Now.ToString('o')
        port = $script:Port
        frontendRoot = $script:FrontendRoot
        deviceId = $DeviceId
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
        $response = Invoke-WebRequest -Uri $script:Url -UseBasicParsing -TimeoutSec 3
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

function Get-BudgetExactlyOneReadyDevice {
    param([string]$AdbPath)
    $all = @(Get-BudgetAdbDevices -AdbPath $AdbPath)
    $ready = @($all | Where-Object { $_.State -eq 'device' })
    if ($ready.Count -ne 1) {
        $summary = @($all | ForEach-Object { "$($_.Serial) [$($_.State)] $($_.Model)" })
        throw "É necessário exatamente um dispositivo Android pronto no ADB; encontrados $($ready.Count). Dispositivos: $($summary -join ', ')"
    }
    return $ready[0]
}

function Test-BudgetReverse {
    param([string]$AdbPath, [string]$DeviceId)
    $output = @(& $AdbPath -s $DeviceId reverse --list 2>&1)
    if ($LASTEXITCODE -ne 0) { return $false }
    return [bool]($output | Where-Object { $_ -match '(?:^|\s)tcp:4200\s+tcp:4200(?:\s|$)' })
}

function Set-BudgetReverse {
    param([string]$AdbPath, [string]$DeviceId)
    $output = @(& $AdbPath -s $DeviceId reverse tcp:4200 tcp:4200 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "Falha ao configurar ADB Reverse: $($output -join ' ')" }
    return (Test-BudgetReverse -AdbPath $AdbPath -DeviceId $DeviceId)
}

function Remove-BudgetReverse {
    param([string]$AdbPath, [string]$DeviceId)
    if (-not (Test-BudgetReverse -AdbPath $AdbPath -DeviceId $DeviceId)) { return $false }
    $output = @(& $AdbPath -s $DeviceId reverse --remove tcp:4200 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "Falha ao remover ADB Reverse: $($output -join ' ')" }
    return $true
}

function Write-BudgetJson {
    param($Value)
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::Out.WriteLine(($Value | ConvertTo-Json -Depth 8))
}
