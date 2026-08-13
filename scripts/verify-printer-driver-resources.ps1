$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "Printer driver resources can only be verified on Windows."
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$driverRoot = Join-Path $workspaceRoot "src-tauri\resources\printer-drivers"
$sp01Installer = Join-Path $driverRoot "sp01\Xprinter.exe"
$printer365Inf = Join-Path $driverRoot "365b\4BARCODE.inf"
$printer365Catalog = Join-Path $driverRoot "365b\4BARCODE.cat"
$required365Files = @(
    "365b\licSSenu.rtf",
    "365b\Common\Defaults[SS]_2024.2.0.0.sds",
    "365b\Common\ss#base_2024.2.0.0.ddz",
    "365b\Common\ss#tsc_2024.2.0.0.ddz",
    "365b\Common\tscSSenu_2024.2.0.0.chm",
    "365b\Common\tscSS_2024.2.0.0.ini",
    "365b\x64\Seagull_V3_ConfigDispatcher.dll",
    "365b\x64\Seagull_V3_NetMonDispatcher.dll",
    "365b\x64\Seagull_V3_PrintDispatcher.dll",
    "365b\x64\ss#base_2024.2.0.0.cab",
    "365b\x64\ss#tsc_2024.2.0.0.cab"
)

$expectedHashes = @{
    $sp01Installer = "6EC487455F383373E490290445D7A5EC61C634D9040FAEB92F766AE1F70706B0"
    $printer365Inf = "5A0C98F5AB66EBD52AC0798AE8316DE852C076EE363D441876C1455CD02CDE0D"
    $printer365Catalog = "B5ACA506A3C67B5F95EC911B43A5209869E6E404146F05A4B2DB82BCD0D0C3FF"
}

foreach ($entry in $expectedHashes.GetEnumerator()) {
    if (-not (Test-Path -LiteralPath $entry.Key -PathType Leaf)) {
        throw "Missing printer driver resource: $($entry.Key)"
    }

    $actualHash = (Get-FileHash -LiteralPath $entry.Key -Algorithm SHA256).Hash
    if ($actualHash -ne $entry.Value) {
        throw "Printer driver resource hash mismatch: $($entry.Key)"
    }
}

foreach ($relativePath in $required365Files) {
    $requiredPath = Join-Path $driverRoot $relativePath
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "Missing 365B driver dependency: $requiredPath"
    }
}

foreach ($signedFile in @($sp01Installer, $printer365Catalog)) {
    $signature = Get-AuthenticodeSignature -LiteralPath $signedFile
    if ($signature.Status -ne "Valid") {
        throw "Printer driver signature is not valid: $signedFile ($($signature.Status))"
    }
}

$printer365Definition = Get-Content -LiteralPath $printer365Inf -Raw
if ($printer365Definition -notmatch '"4BARCODE 3B-365B"') {
    throw "The bundled 365B INF does not contain the 4BARCODE 3B-365B model."
}

Write-Host "Printer driver resources verified successfully."
