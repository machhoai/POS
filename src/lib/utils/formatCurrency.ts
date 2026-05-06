// =============================================================================
// Currency Formatter — Vietnamese Dong (VND) formatting
// =============================================================================

/**
 * Format a number as Vietnamese currency.
 * Uses dot as thousands separator and appends "đ".
 *
 * @example formatCurrency(150000) → "150.000 đ"
 * @example formatCurrency(1500)   → "1.500 đ"
 * @example formatCurrency(0)      → "0 đ"
 */
export function formatCurrency(amount: number): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted} đ`;
}
