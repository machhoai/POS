!macro NSIS_HOOK_POSTINSTALL
  ReadRegStr $3 HKLM "SOFTWARE\JPOS\PrinterDrivers" "365BVersion"
  ${If} $3 != "2024.2"
    DetailPrint "Dang cai driver may in 4BARCODE 3B-365B..."
    ClearErrors
    ExecWait '"$WINDIR\Sysnative\pnputil.exe" /add-driver "$INSTDIR\resources\printer-drivers\365b\4BARCODE.inf" /install' $0
    ${If} $0 == 0
      WriteRegStr HKLM "SOFTWARE\JPOS\PrinterDrivers" "365BVersion" "2024.2"
      DetailPrint "Da cai driver 4BARCODE 3B-365B."
    ${ElseIf} $0 == 3010
      WriteRegStr HKLM "SOFTWARE\JPOS\PrinterDrivers" "365BVersion" "2024.2"
      DetailPrint "Da cai driver 4BARCODE 3B-365B; Windows co the can khoi dong lai."
    ${Else}
      DetailPrint "Khong the cai driver 4BARCODE 3B-365B (ma loi $0)."
      MessageBox MB_ICONEXCLAMATION|MB_OK "JPOS da duoc cai dat, nhung driver 4BARCODE 3B-365B khong cai duoc (ma loi $0). Vui long lien he bo phan ky thuat."
    ${EndIf}
  ${Else}
    DetailPrint "Driver 4BARCODE 3B-365B da duoc cai truoc do."
  ${EndIf}

  DetailPrint "Dang cai driver XP-80C va cau hinh may in Sapo SP01..."
  ClearErrors
  ExecWait '"$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\printer-drivers\sp01\install-sp01-driver.ps1" -DriverPackage "$INSTDIR\resources\printer-drivers\sp01\Xprinter.exe"' $2
  ${If} $2 == 0
    DetailPrint "Da cai driver XP-80C va tao may in Sapo SP01."
  ${ElseIf} $2 == 10
    DetailPrint "Da cai driver XP-80C; hay ket noi va bat Sapo SP01 de tao hang doi in."
  ${Else}
    DetailPrint "Khong the cau hinh Sapo SP01 (ma loi $2)."
    MessageBox MB_ICONEXCLAMATION|MB_OK "JPOS da duoc cai dat, nhung driver Sapo SP01 XP-80C khong cau hinh duoc (ma loi $2). Vui long ket noi may in, bat nguon va thu cai lai JPOS."
  ${EndIf}
!macroend
