import { db } from "@/lib/firebase/config";
import { doc, setDoc, getDocs, collection, writeBatch } from "firebase/firestore";
import { Product, ClientAccount, PriceList, PriceListItem, ClientPriceOverride, InventoryItem, UserProfile } from "@/types";

export const DEMO_USERS: UserProfile[] = [
  {
    id: "usr-admin-01",
    email: "admin@kargohub.com",
    name: "Arthur Pendelton (Admin Owner)",
    role: "admin",
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "usr-client-metro-owner",
    email: "sarah@metrosupermarket.com",
    name: "Sarah Chen (Metro Supermarket Owner)",
    role: "client_owner",
    clientAccountId: "client-metro-supermarket",
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "usr-client-metro-staff",
    email: "orderdesk@metrosupermarket.com",
    name: "David Kim (Metro Purchasing Staff)",
    role: "client_staff",
    clientAccountId: "client-metro-supermarket",
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "usr-warehouse-01",
    email: "warehouse@kargohub.com",
    name: "Marcus Vance (Warehouse Lead)",
    role: "warehouse",
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "usr-driver-01",
    email: "driver.alex@kargohub.com",
    name: "Alex Mercer (Fleet Route Driver)",
    role: "driver",
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

export const DEMO_CLIENTS: ClientAccount[] = [
  {
    id: "client-metro-supermarket",
    companyName: "Metro Supermarket Chain",
    priceTierId: "tier-supermarket-prime",
    creditLimitCents: 2500000, // $25,000.00
    creditTerms: "net_30",
    isCreditSuspended: false,
    contactPerson: "Sarah Chen",
    phone: "+1 (555) 349-8812",
    deliveryAddress: "4800 Industrial Blvd, Bay 4, Logistics City",
    createdAt: new Date().toISOString()
  },
  {
    id: "client-quickstop-grocers",
    companyName: "QuickStop 24/7 Grocers",
    priceTierId: "tier-convenience-retail",
    creditLimitCents: 500000, // $5,000.00
    creditTerms: "net_15",
    isCreditSuspended: false,
    contactPerson: "Rajiv Patel",
    phone: "+1 (555) 782-9901",
    deliveryAddress: "128 Commerce Way, Suite B",
    createdAt: new Date().toISOString()
  },
  {
    id: "client-urban-bodega",
    companyName: "Urban Eats Bodega",
    creditLimitCents: 0,
    creditTerms: "none",
    isCreditSuspended: false,
    contactPerson: "Elena Rostova",
    phone: "+1 (555) 431-7722",
    deliveryAddress: "77 Downtown Market Ave",
    createdAt: new Date().toISOString()
  }
];

export const DEMO_PRICE_LISTS: PriceList[] = [
  {
    id: "tier-supermarket-prime",
    name: "Tier 1 - Supermarket Prime",
    description: "Highest volume wholesale accounts. 15% discount off base price.",
    createdAt: new Date().toISOString()
  },
  {
    id: "tier-convenience-retail",
    name: "Tier 2 - Convenience Retail",
    description: "Standard retail accounts. 8% discount off base price.",
    createdAt: new Date().toISOString()
  }
];

export const DEMO_PRODUCTS: Product[] = [
  {
    id: "prod-colombian-coffee-case",
    sku: "BEV-COF-001",
    name: "Artisan Colombian Supremo Whole Bean Coffee",
    description: "100% Arabica, single-origin medium dark roast. Vacuum sealed freshness valves.",
    unit: "case",
    packSize: 6, // 6 x 1kg bags per case
    moq: 2, // Minimum 2 cases
    basePriceCents: 8400, // $84.00 per case
    category: "Beverages",
    imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-organic-oat-milk",
    sku: "BEV-MILK-002",
    name: "Barista Edition Organic Oat Milk (1L)",
    description: "Specially formulated for micro-foam and heat stability. Plant-based certified.",
    unit: "case",
    packSize: 12, // 12 x 1L cartons per case
    moq: 3, // Minimum 3 cases
    basePriceCents: 4200, // $42.00 per case
    category: "Beverages",
    imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-extra-virgin-olive-oil",
    sku: "DRY-OIL-003",
    name: "Cold-Pressed Extra Virgin Olive Oil (5L Tin)",
    description: "Single estate Greek Koroneiki olives. Acidity < 0.3%. Restaurant grade packaging.",
    unit: "case",
    packSize: 4, // 4 x 5L tins per case
    moq: 1,
    basePriceCents: 16800, // $168.00 per case
    category: "Pantry & Oils",
    imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-organic-pasta-fusilli",
    sku: "DRY-PASTA-004",
    name: "Artisanal Bronze-Cut Fusilli Pasta (500g)",
    description: "100% durum wheat semolina from Gragnano, slow dried at low temperature.",
    unit: "case",
    packSize: 20, // 20 bags per case
    moq: 2,
    basePriceCents: 3800, // $38.00 per case
    category: "Pantry & Dry Goods",
    imageUrl: "https://images.unsplash.com/photo-1551462147-37885acc36f1?auto=format&fit=crop&w=600&q=80",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-san-marzano-tomatoes",
    sku: "CAN-TOM-005",
    name: "D.O.P. San Marzano Peeled Tomatoes (2.5kg Can)",
    description: "Authentic Agro Sarnese-Nocerino certified. Rich, sweet and non-acidic sauce base.",
    unit: "case",
    packSize: 6, // 6 x 2.5kg cans
    moq: 2,
    basePriceCents: 5400, // $54.00 per case
    category: "Pantry & Dry Goods",
    imageUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-sparkling-mineral-water",
    sku: "BEV-WAT-006",
    name: "Alpine Natural Sparkling Mineral Water (750ml)",
    description: "Bottled at source in glass bottles. Crisp effervescence and low sodium balance.",
    unit: "case",
    packSize: 15,
    moq: 4,
    basePriceCents: 3200, // $32.00 per case
    category: "Beverages",
    imageUrl: "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80",
    createdAt: new Date().toISOString()
  }
];

export async function seedInitialDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    const clean = (data: any) => JSON.parse(JSON.stringify(data));
    const batch = writeBatch(db);

    // 1. Seed Price Lists
    for (const pl of DEMO_PRICE_LISTS) {
      batch.set(doc(db, "price_lists", pl.id), clean(pl));
    }

    // 2. Seed Client Accounts
    for (const cl of DEMO_CLIENTS) {
      batch.set(doc(db, "client_accounts", cl.id), clean(cl));
    }

    // 3. Seed Products & Inventory
    const warehouseId = "wh-central-01";
    for (const prod of DEMO_PRODUCTS) {
      batch.set(doc(db, "products", prod.id), clean(prod));

      // Create initial physical warehouse inventory
      const invRef = doc(db, "inventory", `${prod.id}_${warehouseId}`);
      const invData: InventoryItem = {
        productId: prod.id,
        warehouseId,
        warehouseName: "Central Fulfillment Hub (Bay A)",
        qtyOnHand: 150, // 150 cases physically in stock
        qtyReserved: 12 // 12 cases currently committed to open orders
      };
      batch.set(invRef, clean(invData));
    }

    // 4. Seed Tier Pricing Items
    // Tier 1: 15% discount off base prices
    for (const prod of DEMO_PRODUCTS) {
      const discounted = Math.round(prod.basePriceCents * 0.85);
      const tier1Item: PriceListItem = {
        id: `tier1_${prod.id}`,
        priceListId: "tier-supermarket-prime",
        productId: prod.id,
        priceCents: discounted
      };
      batch.set(doc(db, "price_list_items", tier1Item.id), clean(tier1Item));

      // Tier 2: 8% discount
      const discounted2 = Math.round(prod.basePriceCents * 0.92);
      const tier2Item: PriceListItem = {
        id: `tier2_${prod.id}`,
        priceListId: "tier-convenience-retail",
        productId: prod.id,
        priceCents: discounted2
      };
      batch.set(doc(db, "price_list_items", tier2Item.id), clean(tier2Item));
    }

    // 5. Seed Client Price Override (Special negotiated deal for Metro Supermarket on Colombian Coffee)
    const override1: ClientPriceOverride = {
      id: "override_metro_coffee",
      clientAccountId: "client-metro-supermarket",
      productId: "prod-colombian-coffee-case",
      customPriceCents: 6800 // Special negotiated $68.00 vs $84.00 base price
    };
    batch.set(doc(db, "client_price_overrides", override1.id), clean(override1));

    // 6. Seed Demo Users
    for (const usr of DEMO_USERS) {
      batch.set(doc(db, "users", usr.id), clean(usr));
    }

    await batch.commit();
    return { success: true, message: "KargoHub database initialized with enterprise demo catalog and tier pricing." };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to seed database." };
  }
}
