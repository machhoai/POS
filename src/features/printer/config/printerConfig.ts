export const MIN_PRINT_TOP_MARGIN_MM = 0;
export const MAX_PRINT_TOP_MARGIN_MM = 10;
export const PRINT_TOP_MARGIN_STEP_MM = 0.5;
export const DEFAULT_PRINT_TOP_MARGIN_MM = 1;

export function normalizePrintTopMarginMm(value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_PRINT_TOP_MARGIN_MM;

  const clampedValue = Math.min(
    MAX_PRINT_TOP_MARGIN_MM,
    Math.max(MIN_PRINT_TOP_MARGIN_MM, numericValue),
  );
  return Math.round(clampedValue / PRINT_TOP_MARGIN_STEP_MM)
    * PRINT_TOP_MARGIN_STEP_MM;
}
