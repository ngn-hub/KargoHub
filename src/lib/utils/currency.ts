/**
 * Financial precision utility:
 * Strictly enforces integer-based cent calculations to prevent floating point drift.
 * (KargoHub.md Rule 5: NUMERIC(12, 2) financial precision).
 */

export function formatCurrency(cents: number, currencySymbol: string = '$'): string {
  if (isNaN(cents)) return `${currencySymbol}0.00`;
  const absoluteCents = Math.abs(cents);
  const dollars = (absoluteCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cents < 0 ? `-${currencySymbol}${dollars}` : `${currencySymbol}${dollars}`;
}

export function parseDollarsToCents(dollarAmount: string | number): number {
  if (typeof dollarAmount === 'number') {
    return Math.round(dollarAmount * 100);
  }
  const clean = dollarAmount.replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function calculateLineTotalCents(unitPriceCents: number, quantity: number): number {
  return Math.round(unitPriceCents * quantity);
}
