Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$frontendRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packagePath = Join-Path $frontendRoot 'package.json'
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
    throw "package.json não encontrado no frontend autorizado."
}
Set-Location -LiteralPath $frontendRoot
& npm.cmd start -- --host 0.0.0.0 --port 4200
exit $LASTEXITCODE
