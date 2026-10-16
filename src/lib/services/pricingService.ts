import { Product, ClientPriceOverride, PriceListItem } from "@/types";

export interface ResolvedPrice {
  productId: string;
  unitPriceCents: number;
  source: 'custom_override' | 'tier_pricing' | 'base_price';
  tierName?: string;
  originalBasePriceCents: number;
  discountPercentage: number;
}

/**
 * Resolves the unit price according to strict KargoHub.md precedence:
 * 1. Client Custom Override
 * 2. Assigned Price Tier
 * 3. Product Base Price
 */
export function resolveProductPrice(
  product: Product,
  clientOverride?: ClientPriceOverride | null,
  tierItem?: PriceListItem | null,
  tierName?: string
): ResolvedPrice {
  const basePriceCents = product.basePriceCents;

  // 1. Client Custom Override takes highest precedence
  if (clientOverride && typeof clientOverride.customPriceCents === 'number') {
    const custom = clientOverride.customPriceCents;
    const discount = basePriceCents > 0 ? Math.round(((basePriceCents - custom) / basePriceCents) * 100) : 0;
    return {
      productId: product.id,
      unitPriceCents: custom,
      source: 'custom_override',
      originalBasePriceCents: basePriceCents,
      discountPercentage: Math.max(0, discount)
    };
  }

  // 2. Assigned Tier Price takes second precedence
  if (tierItem && typeof tierItem.priceCents === 'number') {
    const tierPrice = tierItem.priceCents;
    const discount = basePriceCents > 0 ? Math.round(((basePriceCents - tierPrice) / basePriceCents) * 100) : 0;
    return {
      productId: product.id,
      unitPriceCents: tierPrice,
      source: 'tier_pricing',
      tierName,
      originalBasePriceCents: basePriceCents,
      discountPercentage: Math.max(0, discount)
    };
  }

  // 3. Fallback to Base Product Price
  return {
    productId: product.id,
    unitPriceCents: basePriceCents,
    source: 'base_price',
    originalBasePriceCents: basePriceCents,
    discountPercentage: 0
  };
}
