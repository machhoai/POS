export interface OrderItemTaxPricing {
  unitPriceBeforeTax: number;
  unitTaxAmount: number;
  taxRate: number;
}

export function resolveOrderItemTaxPricing(input: {
  basePrice: number;
  sellingPrice: number;
  taxRate: number;
  taxRateType: number;
}): OrderItemTaxPricing {
  const configuredTaxRate = Number.isFinite(input.taxRate) && input.taxRate >= 0
    ? input.taxRate
    : 0;
  const hasExplicitBeforeTaxPrice = Number.isFinite(input.basePrice) &&
    input.basePrice >= 0 &&
    input.basePrice < input.sellingPrice;

  let unitPriceBeforeTax: number;
  if (hasExplicitBeforeTaxPrice) {
    unitPriceBeforeTax = input.basePrice;
  } else if (configuredTaxRate > 0 && input.taxRateType === 2) {
    unitPriceBeforeTax = Math.max(0, input.sellingPrice - configuredTaxRate);
  } else if (configuredTaxRate > 0) {
    unitPriceBeforeTax = input.sellingPrice / (1 + configuredTaxRate / 100);
  } else {
    unitPriceBeforeTax = Number.isFinite(input.basePrice) && input.basePrice >= 0
      ? input.basePrice
      : input.sellingPrice;
  }

  const roundedUnitPriceBeforeTax = Math.round(unitPriceBeforeTax);
  const unitTaxAmount = Math.max(
    0,
    Math.round(input.sellingPrice - roundedUnitPriceBeforeTax),
  );
  const effectiveTaxRate = input.taxRateType !== 2 && configuredTaxRate > 0
    ? configuredTaxRate
    : roundedUnitPriceBeforeTax > 0
      ? (unitTaxAmount / roundedUnitPriceBeforeTax) * 100
      : 0;

  return {
    unitPriceBeforeTax: roundedUnitPriceBeforeTax,
    unitTaxAmount,
    taxRate: Number(effectiveTaxRate.toFixed(4)),
  };
}
