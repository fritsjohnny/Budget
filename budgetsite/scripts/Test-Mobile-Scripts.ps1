Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptFiles = @(
    'mobile-common.ps1',
    'mobile-status.ps1',
    'mobile-pair.ps1',
    'mobile-connect.ps1',
    'mobile-publish.ps1'
)

foreach ($scriptFile in $scriptFiles) {
    $path = Join-Path $PSScriptRoot $scriptFile
    $bytes = [System.IO.File]::ReadAllBytes($path)

    if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
        throw "${scriptFile}: o arquivo deve estar em UTF-8 com BOM."
    }

    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors)

    if ($errors.Count -gt 0) {
        $messages = $errors | ForEach-Object { "${scriptFile}:$($_.Extent.StartLineNumber): $($_.Message)" }
        throw ($messages -join [Environment]::NewLine)
    }

    Write-Host "${scriptFile}: sintaxe válida"
}

Write-Host 'Todos os scripts mobile possuem sintaxe PowerShell válida.'
