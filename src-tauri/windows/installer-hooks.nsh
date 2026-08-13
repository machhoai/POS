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

  ReadRegStr $1 HKLM "SOFTWARE\JPOS\PrinterDrivers" "SP01Version"
  ${If} $1 != "7.77"
    DetailPrint "Dang cai driver may in bill Sapo SP01..."
    ClearErrors
    ExecWait '"$INSTDIR\resources\printer-drivers\sp01\Xprinter.exe" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-' $2
    ${If} $2 == 0
      WriteRegStr HKLM "SOFTWARE\JPOS\PrinterDrivers" "SP01Version" "7.77"
      DetailPrint "Da cai driver Sapo SP01."
    ${ElseIf} $2 == 3010
      WriteRegStr HKLM "SOFTWARE\JPOS\PrinterDrivers" "SP01Version" "7.77"
      DetailPrint "Da cai driver Sapo SP01; Windows co the can khoi dong lai."
    ${Else}
      DetailPrint "Khong the cai driver Sapo SP01 (ma loi $2)."
      MessageBox MB_ICONEXCLAMATION|MB_OK "JPOS da duoc cai dat, nhung driver Sapo SP01 khong cai duoc (ma loi $2). Vui long lien he bo phan ky thuat."
    ${EndIf}
  ${Else}
    DetailPrint "Driver Sapo SP01 da duoc cai truoc do."
  ${EndIf}
!macroend
