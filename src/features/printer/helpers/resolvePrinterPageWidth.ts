const SP01_MAX_CUSTOM_MEDIA_WIDTH_MM = 72;

function isSp01PrinterName(printerName: string): boolean {
  return /(?:sapo\s*)?sp[\s_-]*0?1|xp[\s_-]*80c/i.test(printerName);
}

/**
 * XP-80C exposes only 72.07 mm of custom media on an 80 mm roll.
 * BT-T080 uses its native 80 mm / 640-dot driver profile and must not be
 * reduced to the XP-80C width.
 */
export function resolvePrinterPageWidthMm(
  configuredWidthMm: number,
  printerName: string | null,
): number {
  if (!printerName || !isSp01PrinterName(printerName)) {
    return configuredWidthMm;
  }

  return Math.min(configuredWidthMm, SP01_MAX_CUSTOM_MEDIA_WIDTH_MM);
}
