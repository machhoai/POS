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

Run `pnpm printer-drivers:verify` before building a release. The release build
also runs this verification automatically.
