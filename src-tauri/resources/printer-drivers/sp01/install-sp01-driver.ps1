param(
    [Parameter(Mandatory = $true)]
    [string]$DriverPackage,

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$driverName = "XP-80C"
$queueName = "Sapo SP01 (XP-80C)"
$driverVersion = "7.77-xp80c"
$logDirectory = Join-Path $env:ProgramData "JPOS\logs"
$logPath = Join-Path $logDirectory "sp01-driver-install.log"
$usbMonitorPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\USB Monitor\Ports"

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

function Get-NativeSystemExecutable {
    param([Parameter(Mandatory = $true)][string]$FileName)

    $sysnativePath = Join-Path $env:WINDIR "Sysnative\$FileName"
    if (Test-Path -LiteralPath $sysnativePath -PathType Leaf) {
        return $sysnativePath
    }

    return (Join-Path $env:WINDIR "System32\$FileName")
}

function Get-XPrinterInstallLocation {
    $uninstallRoots = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
    )

    foreach ($root in $uninstallRoots) {
        if (-not (Test-Path -LiteralPath $root)) {
            continue
        }

        foreach ($key in Get-ChildItem -LiteralPath $root) {
            try {
                $entry = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction Stop
            } catch {
                continue
            }
            if ($entry.DisplayName -like "XPrinter Driver V7.77*") {
                return $entry.InstallLocation
            }
        }
    }

    return "C:\XINYE POS Printer Driver\XPrinter Driver V7.77"
}

function Get-XPrinterUsbPort {
    if (-not (Test-Path -LiteralPath $usbMonitorPath)) {
        return $null
    }

    $presentDeviceIds = @{}
    if (Get-Command Get-PnpDevice -ErrorAction SilentlyContinue) {
        foreach ($device in Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue) {
            if (-not [string]::IsNullOrWhiteSpace($device.InstanceId)) {
                $presentDeviceIds[$device.InstanceId.ToLowerInvariant()] = $true
            }
        }
    }

    $candidates = foreach ($portKey in Get-ChildItem -LiteralPath $usbMonitorPath) {
        $port = Get-ItemProperty -LiteralPath $portKey.PSPath
        $deviceId = [string]$port.'Device Id'
        if ([string]::IsNullOrWhiteSpace($deviceId)) {
            continue
        }

        $isPresent = $presentDeviceIds.Count -eq 0 -or $presentDeviceIds.ContainsKey($deviceId.ToLowerInvariant())
        if (-not $isPresent) {
            continue
        }

        $isKnownSp01Hardware = $deviceId -match '^USB\\VID_0483&PID_5743\\'
        $isXPrinter = $false
        if (-not $isKnownSp01Hardware -and (Get-Command Get-PnpDeviceProperty -ErrorAction SilentlyContinue)) {
            $description = Get-PnpDeviceProperty `
                -InstanceId $deviceId `
                -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' `
                -ErrorAction SilentlyContinue
            $isXPrinter = [string]$description.Data -match '(?i)xprinter'
        }

        if ($isKnownSp01Hardware -or $isXPrinter) {
            $ippStartTime = 0
            if ($null -ne $port.IppStartTime) {
                $ippStartTime = [long]$port.IppStartTime
            }

            [pscustomobject]@{
                Name = $portKey.PSChildName
                IsKnownSp01Hardware = $isKnownSp01Hardware
                IppStartTime = $ippStartTime
            }
        }
    }

    return $candidates |
        Sort-Object IsKnownSp01Hardware, IppStartTime -Descending |
        Select-Object -First 1 -ExpandProperty Name
}

function Install-XPrinterPackage {
    if (-not (Test-Path -LiteralPath $DriverPackage -PathType Leaf)) {
        throw "Khong tim thay bo cai Xprinter: $DriverPackage"
    }

    Write-InstallLog "Dang giai nen bo driver Xprinter V7.77."
    $packageProcess = Start-Process `
        -FilePath $DriverPackage `
        -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-') `
        -Wait `
        -PassThru
    if ($packageProcess.ExitCode -notin @(0, 3010)) {
        throw "Bo cai Xprinter tra ve ma loi $($packageProcess.ExitCode)."
    }
}

try {
    Write-InstallLog "Bat dau cau hinh Sapo SP01 bang driver $driverName."

    if (-not $DryRun -and -not (Test-IsAdministrator)) {
        Write-InstallLog "Can quyen quan tri de cai driver may in."
        exit 740
    }

    $installLocation = Get-XPrinterInstallLocation
    $driverInf = Join-Path $installLocation "Windows x64\XPDRVx64.INF"
    if (-not (Test-Path -LiteralPath $driverInf -PathType Leaf)) {
        if ($DryRun) {
            throw "Chua co driver da giai nen tai $driverInf."
        }

        Install-XPrinterPackage
        $installLocation = Get-XPrinterInstallLocation
        $driverInf = Join-Path $installLocation "Windows x64\XPDRVx64.INF"
    }

    if (-not (Test-Path -LiteralPath $driverInf -PathType Leaf)) {
        throw "Khong tim thay INF XPDRVx64.INF sau khi giai nen driver."
    }

    $infDefinition = Get-Content -LiteralPath $driverInf -Raw
    if ($infDefinition -notmatch '"XP-80C"') {
        throw "INF Xprinter khong chua model XP-80C."
    }

    $driverCatalog = Join-Path (Split-Path -Parent $driverInf) "XPDRVx64.cat"
    if (-not (Test-Path -LiteralPath $driverCatalog -PathType Leaf)) {
        throw "Khong tim thay chu ky XPDRVx64.cat cua driver Xprinter."
    }

    $catalogSignature = Get-AuthenticodeSignature -LiteralPath $driverCatalog
    if ($catalogSignature.Status -ne "Valid") {
        throw "Chu ky driver Xprinter khong hop le: $($catalogSignature.Status)."
    }

    if (-not $DryRun) {
        $pnputil = Get-NativeSystemExecutable -FileName "pnputil.exe"
        Write-InstallLog "Dang dua driver Xprinter vao Windows Driver Store."
        $stageProcess = Start-Process `
            -FilePath $pnputil `
            -ArgumentList @('/add-driver', ('"{0}"' -f $driverInf), '/install') `
            -Wait `
            -PassThru `
            -WindowStyle Hidden
        if ($stageProcess.ExitCode -notin @(0, 3010)) {
            throw "pnputil tra ve ma loi $($stageProcess.ExitCode)."
        }

        if (-not (Get-PrinterDriver -Name $driverName -ErrorAction SilentlyContinue)) {
            Write-InstallLog "Dang dang ky driver $driverName voi Print Spooler."
            $printUiArguments = 'printui.dll,PrintUIEntry /ia /m "{0}" /h "x64" /v "Type 3 - User Mode" /f "{1}"' -f $driverName, $driverInf
            $registerProcess = Start-Process `
                -FilePath (Get-NativeSystemExecutable -FileName "rundll32.exe") `
                -ArgumentList $printUiArguments `
                -Wait `
                -PassThru `
                -WindowStyle Hidden
            if ($registerProcess.ExitCode -ne 0) {
                throw "PrintUI tra ve ma loi $($registerProcess.ExitCode)."
            }
        }

        if (-not (Get-PrinterDriver -Name $driverName -ErrorAction SilentlyContinue)) {
            throw "Windows chua dang ky driver $driverName."
        }
    }

    $usbPort = Get-XPrinterUsbPort
    if ([string]::IsNullOrWhiteSpace($usbPort)) {
        Write-InstallLog "Da cai driver $driverName, nhung khong tim thay SP01 dang ket noi de tao hang doi in."
        if (-not $DryRun) {
            New-Item -Path "HKLM:\SOFTWARE\JPOS\PrinterDrivers" -Force | Out-Null
            Set-ItemProperty -Path "HKLM:\SOFTWARE\JPOS\PrinterDrivers" -Name "SP01Version" -Value $driverVersion
        }
        exit 10
    }

    Write-InstallLog "Da tim thay SP01 tai cong $usbPort."
    if ($DryRun) {
        Write-InstallLog "Dry-run: se tao hang doi '$queueName' bang driver $driverName tren cong $usbPort."
        exit 0
    }

    $existingPrinter = Get-Printer -Name $queueName -ErrorAction SilentlyContinue
    if ($existingPrinter) {
        if ($existingPrinter.DriverName -ne $driverName -or $existingPrinter.PortName -ne $usbPort) {
            Set-Printer -Name $queueName -DriverName $driverName -PortName $usbPort
            Write-InstallLog "Da cap nhat hang doi $queueName sang cong $usbPort."
        }
    } else {
        Add-Printer -Name $queueName -DriverName $driverName -PortName $usbPort
        Write-InstallLog "Da tao hang doi $queueName tren cong $usbPort."
    }

    $installedPrinter = Get-Printer -Name $queueName -ErrorAction Stop
    if ($installedPrinter.DriverName -ne $driverName -or $installedPrinter.PortName -ne $usbPort) {
        throw "Hang doi SP01 khong dung driver hoac cong USB mong doi."
    }

    New-Item -Path "HKLM:\SOFTWARE\JPOS\PrinterDrivers" -Force | Out-Null
    Set-ItemProperty -Path "HKLM:\SOFTWARE\JPOS\PrinterDrivers" -Name "SP01Version" -Value $driverVersion
    Write-InstallLog "Cau hinh Sapo SP01 hoan tat."
    exit 0
} catch {
    Write-InstallLog "Cai dat SP01 that bai: $($_.Exception.Message)"
    Write-InstallLog "Chi tiet: $($_.ScriptStackTrace)"
    exit 1
}
