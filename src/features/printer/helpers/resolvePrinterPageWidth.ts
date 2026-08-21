const THERMAL_80MM_CUSTOM_MEDIA_WIDTH_MM = 72;

function usesNarrowCustomMedia(printerName: string): boolean {
  return /(?:sapo\s*)?sp[\s_-]*0?1|xp[\s_-]*80c|bt[\s_-]*t080/i.test(printerName);
}

/**
 * These Windows drivers reliably expose only about 72 mm to WebView2 custom
 * print jobs on an 80 mm roll. Sending an 80 mm custom page to BT-T080 moves
 * the right edge outside the raster that reaches the paper.
 */
export function resolvePrinterPageWidthMm(
  configuredWidthMm: number,
  printerName: string | null,
): number {
  if (!printerName || !usesNarrowCustomMedia(printerName)) {
    return configuredWidthMm;
  }

  return Math.min(configuredWidthMm, THERMAL_80MM_CUSTOM_MEDIA_WIDTH_MM);
}
