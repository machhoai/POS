import type { Product } from "@/lib/types/product";

const HEX_COLOR = /^#?([0-9a-f]{6})$/i;
const DEFAULT_BACKGROUND = "#F97316";
const LIGHT_TEXT = "#FFFFFF";
const DARK_TEXT = "#111827";

function normalizeHexColor(value: string | undefined, fallback: string): string {
  const match = value?.trim().match(HEX_COLOR);
  return match ? `#${match[1].toUpperCase()}` : fallback;
}

function hexToRgb(color: string): [number, number, number] {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(color.slice(offset, offset + 2), 16),
  ) as [number, number, number];
}

function relativeLuminance(color: string): number {
  const channels = hexToRgb(color).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string): number {
  const brightest = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darkest = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Normalize the visual colors supplied by HK and keep labels/buttons readable
 * if an invalid or low-contrast color pair is returned by the API.
 */
export function getProductColors(
  product: Pick<Product, "foreColor" | "backColor">,
) {
  const background = normalizeHexColor(product.backColor, DEFAULT_BACKGROUND);
  const preferredForeground = normalizeHexColor(product.foreColor, LIGHT_TEXT);
  const automaticForeground = contrastRatio(background, DARK_TEXT) >=
    contrastRatio(background, LIGHT_TEXT)
    ? DARK_TEXT
    : LIGHT_TEXT;
  const foreground = contrastRatio(background, preferredForeground) >= 3
    ? preferredForeground
    : automaticForeground;
  const accentText = contrastRatio(background, LIGHT_TEXT) >= 3
    ? background
    : contrastRatio(preferredForeground, LIGHT_TEXT) >= 3
      ? preferredForeground
      : "#C2410C";

  return { background, foreground, accentText };
}
