param(
    [Parameter(Mandatory = $true)]
    [string]$DriverPackage,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$expectedPackageHash = "642D60F165A007A82CED9796FA9E3E0FC78ADE8F3150B1A71D7CCF3CA787FF8B"
$hardwareId = "USB\VID_154F&PID_154F"
$driverNamePattern = '^BT-T080(?:\(A\)|\(U\)\d*)?$'
$infDriverName = "BT-T080(U)3"
$apiPortName = "USB_BT-T080_3"
$apiPortMonitorName = "USB Printer Port"
$apiPortDeviceId = 738
$deviceRevision = 738
$queueName = "ITP080 (SNBC BT-T080)"
$driverVersion = "2.2.33.1-bt-t080"
$logDirectory = Join-Path $env:ProgramData "JPOS\logs"
$logPath = Join-Path $logDirectory "itp080-driver-install.log"
$extractRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("jpos-itp080-{0}" -f [guid]::NewGuid().ToString("N"))

function Write-InstallLog {
    param([string]$Message)

    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Write-Output $line

    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
        Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    }
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ConnectedItp080Device {
    return Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
        Where-Object { $_.InstanceId -like "$hardwareId*" } |
        Select-Object -First 1
}

function Get-Itp080Printer {
    return Get-Printer -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -eq $queueName -or
            ($_.PortName -eq $apiPortName -and $_.DriverName -match $driverNamePattern)
        } |
        Sort-Object `
            @{ Expression = { $_.Name -eq $queueName }; Descending = $true },
            @{ Expression = { $_.PortName -eq $apiPortName }; Descending = $true } |
        Select-Object -First 1
}

function Add-SnbcPrintMonitor {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Driver
    )

    if (-not ("SnbcPrintMonitorInstaller" -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class SnbcPrintMonitorInstaller {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct MONITOR_INFO_2 {
        [MarshalAs(UnmanagedType.LPWStr)] public string pName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pEnvironment;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDLLName;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool AddMonitor(string pName, uint Level, ref MONITOR_INFO_2 pMonitors);

    public static void Add(string name, string driver) {
        var info = new MONITOR_INFO_2 {
            pName = name,
            pEnvironment = "Windows x64",
            pDLLName = driver
        };
        if (!AddMonitor(null, 2, ref info)) {
            int error = Marshal.GetLastWin32Error();
            if (error != 3006) throw new Win32Exception(error);
        }
    }
}
'@
    }

    [SnbcPrintMonitorInstaller]::Add($Name, $Driver)
}

function Install-SnbcMonitors {
    param([Parameter(Mandatory = $true)][string]$PackageRoot)

    $systemDirectory = Join-Path $env:WINDIR "System32"
    $monitors = @(
        @{ Name = $apiPortMonitorName; Driver = "BYUPM2K.DLL"; Source = "BYUpm2k.dll" },
        @{ Name = "BYLMon"; Driver = "BYLMONITOR.DLL"; Source = "BYLMonitor.dll" }
    )

    foreach ($monitor in $monitors) {
        $monitorKey = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\$($monitor.Name)"
        if (Test-Path -LiteralPath $monitorKey) {
            continue
        }

        $sourcePath = Join-Path $PackageRoot "W64\$($monitor.Source)"
        $destinationPath = Join-Path $systemDirectory $monitor.Driver
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
        Add-SnbcPrintMonitor -Name $monitor.Name -Driver $monitor.Driver
        Write-InstallLog "Da dang ky print monitor $($monitor.Name)."
    }

    $monitorUi = Join-Path $systemDirectory "BYUPM2KUI.DLL"
    if (-not (Test-Path -LiteralPath $monitorUi -PathType Leaf)) {
        Copy-Item `
            -LiteralPath (Join-Path $PackageRoot "W64\BYUpm2kUI.dll") `
            -Destination $monitorUi `
            -Force
    }
}

function Set-SnbcApiPortRegistry {
    $monitorPortKey = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\$apiPortMonitorName\Ports\$apiPortName"
    New-Item -Path $monitorPortKey -Force | Out-Null
    New-ItemProperty -Path $monitorPortKey -Name "WriteTimeOut" -Value 0 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $monitorPortKey -Name "ReadTimeOut" -Value 20 -PropertyType DWord -Force | Out-Null

    $portNameKey = "HKLM:\SOFTWARE\BEIYANG\PORTNAME"
    New-Item -Path $portNameKey -Force | Out-Null
    New-ItemProperty -Path $portNameKey -Name $apiPortName -Value $apiPortDeviceId -PropertyType DWord -Force | Out-Null

    $printerPortKey = "HKLM:\SOFTWARE\BEIYANG\PRINTERPORT"
    New-Item -Path $printerPortKey -Force | Out-Null
    New-ItemProperty -Path $printerPortKey -Name "D1" -Value $deviceRevision -PropertyType DWord -Force | Out-Null
    foreach ($index in 2..8) {
        New-ItemProperty -Path $printerPortKey -Name "D$index" -Value 65535 -PropertyType DWord -Force | Out-Null
    }
    New-ItemProperty -Path $printerPortKey -Name $apiPortName -Value 0 -PropertyType DWord -Force | Out-Null
}

function Install-SnbcPrinterDriver {
    param([Parameter(Mandatory = $true)][string]$PrintInf)

    if (Get-PrinterDriver -Name $infDriverName -ErrorAction SilentlyContinue) {
        return
    }

    $pnputil = Join-Path $env:WINDIR "System32\pnputil.exe"
    $stageProcess = Start-Process `
        -FilePath $pnputil `
        -ArgumentList @('/add-driver', ('"{0}"' -f $PrintInf)) `
        -Wait `
        -PassThru `
        -WindowStyle Hidden
    if ($stageProcess.ExitCode -notin @(0, 3010)) {
        throw "pnputil tra ve ma loi $($stageProcess.ExitCode)."
    }

    $driverStoreInf = Get-ChildItem `
        -Path (Join-Path $env:WINDIR "System32\DriverStore\FileRepository\setup_pos.inf_amd64_*\Setup_POS.inf") `
        -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $driverStoreInf) {
        throw "Khong tim thay Setup_POS.inf trong Windows Driver Store."
    }

    Add-PrinterDriver -Name $infDriverName -InfPath $driverStoreInf.FullName
    if (-not (Get-PrinterDriver -Name $infDriverName -ErrorAction SilentlyContinue)) {
        throw "Windows khong dang ky duoc driver $infDriverName."
    }
}

function Assert-SignedCatalog {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Khong tim thay catalog driver: $Path"
    }

    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    if ($signature.Status -ne "Valid") {
        throw "Chu ky catalog driver khong hop le: $Path ($($signature.Status))."
    }

    if ($signature.SignerCertificate.Subject -notmatch 'Shandong New Beiyang') {
        throw "Catalog driver khong do SNBC/New Beiyang phat hanh: $Path"
    }
}

try {
    Write-InstallLog "Bat dau cau hinh ITP080 bang driver SNBC BT-T080."

    if (-not $DryRun -and -not (Test-IsAdministrator)) {
        Write-InstallLog "Can quyen quan tri de cai driver may in."
        exit 740
    }

    if (-not (Test-Path -LiteralPath $DriverPackage -PathType Leaf)) {
        throw "Khong tim thay goi driver ITP080: $DriverPackage"
    }

    $packageHash = (Get-FileHash -LiteralPath $DriverPackage -Algorithm SHA256).Hash
    if ($packageHash -ne $expectedPackageHash) {
        throw "Hash goi driver ITP080 khong hop le: $packageHash"
    }

    Write-InstallLog "Dang kiem tra goi driver SNBC $driverVersion."
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
    Expand-Archive -LiteralPath $DriverPackage -DestinationPath $extractRoot -Force

    $setup = Get-ChildItem -LiteralPath $extractRoot -Filter "Setup.exe" -Recurse -File |
        Select-Object -First 1
    if (-not $setup) {
        throw "Goi driver SNBC khong chua Setup.exe."
    }

    $packageRoot = $setup.Directory.FullName
    $printInf = Join-Path $packageRoot "W64\Setup_POS.inf"
    $printCatalog = Join-Path $packageRoot "W64\Setup_POS.cat"
    $portCatalog = Join-Path $packageRoot "W64\usbprinter.cat"
    $usbBootstrap = Join-Path $packageRoot "USBDrv\USBDriverSetup.exe"

    $requiredMonitorFiles = @(
        (Join-Path $packageRoot "W64\BYUpm2k.dll"),
        (Join-Path $packageRoot "W64\BYUpm2kUI.dll"),
        (Join-Path $packageRoot "W64\BYLMonitor.dll")
    )
    foreach ($requiredPath in @($printInf, $printCatalog, $portCatalog, $usbBootstrap) + $requiredMonitorFiles) {
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "Goi driver SNBC thieu tai nguyen: $requiredPath"
        }
    }

    $infDefinition = Get-Content -LiteralPath $printInf -Raw
    if ($infDefinition -notmatch '"BT-T080\(U\)1"' -or
        $infDefinition -notmatch 'DriverVer=24/09/2025,2\.2\.33\.0') {
        throw "INF SNBC khong chua dung driver BT-T080 2.2.33.0."
    }

    Assert-SignedCatalog -Path $printCatalog
    Assert-SignedCatalog -Path $portCatalog

    $connectedDevice = Get-ConnectedItp080Device
    if ($connectedDevice) {
        Write-InstallLog "Da nhan dien ITP080 tai $($connectedDevice.InstanceId)."
    } else {
        Write-InstallLog "Chua tim thay ITP080 dang ket noi voi hardware ID $hardwareId."
    }

    if ($DryRun) {
        Write-InstallLog "Dry-run: goi driver va chu ky hop le; se cai truc tiep USB transport, print monitor, driver va queue '$queueName'."
        exit 0
    }

    Write-InstallLog "Dang cai USB transport SNBC o che do im lang."
    $usbProcess = Start-Process `
        -FilePath $usbBootstrap `
        -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-') `
        -WorkingDirectory $packageRoot `
        -Wait `
        -PassThru `
        -WindowStyle Hidden
    if ($usbProcess.ExitCode -notin @(0, 3010)) {
        throw "Bo cai USB SNBC tra ve ma loi $($usbProcess.ExitCode)."
    }

    Install-SnbcMonitors -PackageRoot $packageRoot
    Set-SnbcApiPortRegistry
    Install-SnbcPrinterDriver -PrintInf $printInf

    $pnputil = Join-Path $env:WINDIR "System32\pnputil.exe"
    if (Test-Path -LiteralPath $pnputil -PathType Leaf) {
        Start-Process `
            -FilePath $pnputil `
            -ArgumentList @('/scan-devices') `
            -Wait `
            -WindowStyle Hidden | Out-Null

    }

    Get-Printer -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(?i)ITP[\s_-]*0?80|BT[\s_-]*T0?80' } |
        ForEach-Object {
            Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue |
                Remove-PrintJob -ErrorAction SilentlyContinue
        }
    Restart-Service -Name Spooler -Force
    Start-Sleep -Seconds 3

    $installedPrinter = $null
    for ($attempt = 0; $attempt -lt 15 -and -not $installedPrinter; $attempt++) {
        $installedPrinter = Get-Itp080Printer
        if (-not $installedPrinter) {
            Start-Sleep -Seconds 2
        }
    }

    New-Item -Path "HKLM:\SOFTWARE\JPOS\PrinterDrivers" -Force | Out-Null
    Set-ItemProperty -Path "HKLM:\SOFTWARE\JPOS\PrinterDrivers" -Name "ITP080Version" -Value $driverVersion

    $queueDriverName = if ($installedPrinter) { $installedPrinter.DriverName } else { $infDriverName }
    $existingQueue = Get-Printer -Name $queueName -ErrorAction SilentlyContinue
    if ($existingQueue) {
        Set-Printer -Name $queueName -DriverName $queueDriverName -PortName $apiPortName
        Write-InstallLog "Da cap nhat queue '$queueName' tren cong $apiPortName."
    } else {
        Add-Printer -Name $queueName -DriverName $queueDriverName -PortName $apiPortName
        Write-InstallLog "Da tao queue '$queueName' tren cong $apiPortName."
    }

    Get-Printer -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^BT-T080' -and $_.PortName -match '^LPT' } |
        Remove-Printer -ErrorAction SilentlyContinue

    Start-Process `
        -FilePath (Join-Path $env:WINDIR "System32\rundll32.exe") `
        -ArgumentList ('printui.dll,PrintUIEntry /Xs /n "{0}" attributes -enablebidi' -f $queueName) `
        -Wait `
        -WindowStyle Hidden | Out-Null

    $jposPrinter = Get-Printer -Name $queueName -ErrorAction Stop
    if (-not $jposPrinter.DriverName -or $jposPrinter.PortName -ne $apiPortName) {
        throw "Queue ITP080 chua co driver hoac cong in hop le."
    }

    Write-InstallLog "Cau hinh ITP080 hoan tat; JPOS se hien thi queue '$queueName'."
    exit 0
} catch {
    Write-InstallLog "Cai dat ITP080 that bai: $($_.Exception.Message)"
    Write-InstallLog "Chi tiet: $($_.ScriptStackTrace)"
    exit 1
} finally {
    if (Test-Path -LiteralPath $extractRoot -PathType Container) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
