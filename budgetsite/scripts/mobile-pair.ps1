param(
    [Parameter(Mandatory = $true)]
    [string]$PairingTarget
)

. (Join-Path $PSScriptRoot 'mobile-common.ps1')

if ($PairingTarget -notmatch '^\d{1,3}(?:\.\d{1,3}){3}:\d+$') {
    throw "Endereço de pareamento inválido: '$PairingTarget'. Use IP:PORTA."
}

$pairingCode = if ([Console]::IsInputRedirected) {
    [Console]::In.ReadLine()
}
else {
    Read-Host 'Código de pareamento de seis dígitos'
}

if ($pairingCode -notmatch '^\d{6}$') {
    throw 'Código de pareamento inválido. Informe exatamente seis dígitos.'
}

$adbPath = Get-BudgetAdbPath
$output = $pairingCode | & $adbPath pair $PairingTarget 2>&1
$safeOutput = ($output -join [Environment]::NewLine) -replace [regex]::Escape($pairingCode), '******'
$pairingCode = $null

if ($LASTEXITCODE -ne 0 -or $safeOutput -notmatch 'Successfully paired') {
    throw "Falha no pareamento ADB: $safeOutput"
}

Write-Host $safeOutput
Write-Host 'Pareamento concluído. Agora informe o endereço IP:porta exibido na tela principal de Depuração sem fio para conectar.'
