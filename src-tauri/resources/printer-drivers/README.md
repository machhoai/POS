# Bundled Windows printer drivers

These resources are installed by the Tauri NSIS post-install hook. The JPOS
uninstaller intentionally leaves installed printer drivers in Windows because
other printer queues and applications may still depend on them.

## Sapo Printer SP01

- Package: XPrinter Driver V7.77 (`Xprinter.exe`)
- Windows model: `XP-80C` (80 mm paper with automatic cutter)
- Queue name: `Sapo SP01 (XP-80C)`
- `install-sp01-driver.ps1` registers the driver with the Windows Print Spooler,
  detects the connected Xprinter USB port, and creates or repairs the queue.
- Source: https://shop.sapo.vn/driver
- Publisher signature: Zhuhai Hena Electronic Technology CO., LTD
- SHA-256: `6EC487455F383373E490290445D7A5EC61C634D9040FAEB92F766AE1F70706B0`

## 4BARCODE 3B-365B

- Package: Seagull 2024.2 x64 driver package
- Model: `4BARCODE 3B-365B`
- Publisher signature: Seagull Scientific Inc.
- INF SHA-256: `5A0C98F5AB66EBD52AC0798AE8316DE852C076EE363D441876C1455CD02CDE0D`
- Catalog SHA-256: `B5ACA506A3C67B5F95EC911B43A5209869E6E404146F05A4B2DB82BCD0D0C3FF`
- The Seagull license is included as `365b/licSSenu.rtf`.

## ITP080 / SNBC BT-T080

- Package: SNBC Receipt Printer Universal WinDrv V2.2.33.1
- Windows model: `BT-T080` (ITP080 OEM device)
- Hardware ID: `USB\VID_154F&PID_154F`
- JPOS queue name: `ITP080 (SNBC BT-T080)`
- USB interface ID: `738` (the connected ITP080 OEM firmware reports the
  BTP-U80II-compatible interface; using nominal BT-T080 ID `130` leaves the
  queue offline)
- `install-itp080-driver.ps1` verifies the pinned package hash and both signed
  x64 catalogs, silently installs only the vendor USB transport, then registers
  the SNBC print monitor, driver, API port and stable JPOS queue directly. The
  interactive vendor port-selection wizard is never launched.
- Source: https://www.snbc.cn/Driver/
- Publisher on signed catalogs: Shandong New Beiyang Information Technology Co., Ltd.
- Package SHA-256: `642D60F165A007A82CED9796FA9E3E0FC78ADE8F3150B1A71D7CCF3CA787FF8B`

Run `pnpm printer-drivers:verify` before building a release. The release build
also runs this verification automatically.
