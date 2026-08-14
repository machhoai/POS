$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "Printer driver resources can only be verified on Windows."
}

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$driverRoot = Join-Path $workspaceRoot "src-tauri\resources\printer-drivers"
$sp01Installer = Join-Path $driverRoot "sp01\Xprinter.exe"
$sp01InstallScript = Join-Path $driverRoot "sp01\install-sp01-driver.ps1"
$itp080Package = Join-Path $driverRoot "itp080\Setup_PosPrn_WinDrv_V2.2.33.1.zip"
$itp080InstallScript = Join-Path $driverRoot "itp080\install-itp080-driver.ps1"
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
    $itp080Package = "642D60F165A007A82CED9796FA9E3E0FC78ADE8F3150B1A71D7CCF3CA787FF8B"
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

if (-not (Test-Path -LiteralPath $sp01InstallScript -PathType Leaf)) {
    throw "Missing SP01 installation script: $sp01InstallScript"
}

if (-not (Test-Path -LiteralPath $itp080InstallScript -PathType Leaf)) {
    throw "Missing ITP080 installation script: $itp080InstallScript"
}

$sp01InstallDefinition = Get-Content -LiteralPath $sp01InstallScript -Raw
if ($sp01InstallDefinition -notmatch '\$driverName = "XP-80C"' -or
    $sp01InstallDefinition -notmatch '\$queueName = "Sapo SP01 \(XP-80C\)"') {
    throw "The SP01 installation script is not configured for XP-80C."
}

$itp080InstallDefinition = Get-Content -LiteralPath $itp080InstallScript -Raw
if ($itp080InstallDefinition -notmatch '\$hardwareId = "USB\\VID_154F&PID_154F"' -or
    $itp080InstallDefinition -notmatch '\$queueName = "ITP080 \(SNBC BT-T080\)"' -or
    $itp080InstallDefinition -notmatch '\$apiPortName = "USB_BT-T080_3"' -or
    $itp080InstallDefinition -notmatch '\$apiPortDeviceId = 738' -or
    $itp080InstallDefinition -notmatch "'/VERYSILENT', '/SUPPRESSMSGBOXES'" -or
    $itp080InstallDefinition -notmatch 'Add-PrinterDriver -Name \$infDriverName' -or
    $itp080InstallDefinition -match "'/add-driver'.*'/install'" -or
    $itp080InstallDefinition -match '\$setup\.FullName') {
    throw "The ITP080 installation script is not configured for SNBC BT-T080 silent setup."
}

& $itp080InstallScript -DriverPackage $itp080Package -DryRun
if ($LASTEXITCODE -ne 0) {
    throw "ITP080 driver package dry-run verification failed with exit code $LASTEXITCODE."
}

$printer365Definition = Get-Content -LiteralPath $printer365Inf -Raw
if ($printer365Definition -notmatch '"4BARCODE 3B-365B"') {
    throw "The bundled 365B INF does not contain the 4BARCODE 3B-365B model."
}

Write-Host "Printer driver resources verified successfully."
