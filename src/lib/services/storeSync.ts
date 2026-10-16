import { Product, InventoryItem, PriceListItem, ClientPriceOverride, Order } from "@/types";
import { DEMO_PRODUCTS, DEMO_PRICE_LISTS } from "./seedService";

// Pre-seeded initial sample orders so Admin, Driver, and Client views have rich data immediately
export const INITIAL_SAMPLE_ORDERS: Order[] = [
  {
    id: "ord-sample-01",
    orderNumber: "SO-2026-0001",
    invoiceNumber: "INV-2026-0001",
    clientAccountId: "client-metro-supermarket",
    clientCompanyName: "Metro Supermarket Chain",
    placedByUserId: "usr-client-metro-owner",
    placedByEmail: "sarah@metrosupermarket.com",
    status: "DELIVERED",
    paymentMethod: "credit",
    paymentStatus: "paid",
    subtotalCents: 154000, // $1,540.00
    totalAmountCents: 154000,
    requestedDeliveryDate: "2026-10-18",
    deliveryReceiptNumber: "DR-2026-0001",
    driverSignatureUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><path d='M10 20 Q 30 5, 50 25 T 90 20' stroke='cyan' stroke-width='3' fill='none'/></svg>",
    notes: "Deliver via rear loading bay #4.",
    items: [
      {
        id: "item-01",
        orderId: "ord-sample-01",
        productId: "prod-colombian-coffee-case",
        skuSnapshot: "BEV-COF-001",
        nameSnapshot: "Artisan Colombian Supremo Whole Bean Coffee",
        unitSnapshot: "case",
        packSizeSnapshot: 6,
        unitPriceSnapshotCents: 6800, // Client override price
        quantity: 10,
        lineTotalCents: 68000
      },
      {
        id: "item-02",
        orderId: "ord-sample-01",
        productId: "prod-extra-virgin-olive-oil",
        skuSnapshot: "DRY-OIL-003",
        nameSnapshot: "Cold-Pressed Extra Virgin Olive Oil (5L Tin)",
        unitSnapshot: "case",
        packSizeSnapshot: 4,
        unitPriceSnapshotCents: 14280, // Tier 1 price
        quantity: 6,
        lineTotalCents: 85680
      }
    ],
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: "ord-sample-02",
    orderNumber: "SO-2026-0002",
    clientAccountId: "client-metro-supermarket",
    clientCompanyName: "Metro Supermarket Chain",
    placedByUserId: "usr-client-metro-owner",
    placedByEmail: "sarah@metrosupermarket.com",
    status: "PLACED",
    paymentMethod: "transfer",
    paymentStatus: "submitted",
    proofImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
    subtotalCents: 210000, // $2,100.00
    totalAmountCents: 210000,
    requestedDeliveryDate: "2026-10-20",
    autoCancelAt: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
    notes: "Wire transfer initiated from Chase commercial checking.",
    items: [
      {
        id: "item-03",
        orderId: "ord-sample-02",
        productId: "prod-organic-oat-milk",
        skuSnapshot: "BEV-MILK-002",
        nameSnapshot: "Barista Edition Organic Oat Milk (1L)",
        unitSnapshot: "case",
        packSizeSnapshot: 12,
        unitPriceSnapshotCents: 3570,
        quantity: 20,
        lineTotalCents: 71400
      }
    ],
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: "ord-sample-03",
    orderNumber: "SO-2026-0003",
    invoiceNumber: "INV-2026-0002",
    clientAccountId: "client-quickstop-grocers",
    clientCompanyName: "QuickStop 24/7 Grocers",
    placedByUserId: "usr-client-quickstop",
    placedByEmail: "rajiv@quickstop.com",
    status: "SHIPPED",
    paymentMethod: "cod",
    paymentStatus: "pending",
    subtotalCents: 96000,
    totalAmountCents: 96000,
    requestedDeliveryDate: "2026-10-19",
    notes: "Have change for $1000 cash.",
    items: [
      {
        id: "item-04",
        orderId: "ord-sample-03",
        productId: "prod-sparkling-mineral-water",
        skuSnapshot: "BEV-WAT-006",
        nameSnapshot: "Alpine Natural Sparkling Mineral Water (750ml)",
        unitSnapshot: "case",
        packSizeSnapshot: 15,
        unitPriceSnapshotCents: 2944,
        quantity: 15,
        lineTotalCents: 44160
      }
    ],
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
  }
];

export function getInitialInventory(): Record<string, InventoryItem> {
  const map: Record<string, InventoryItem> = {};
  DEMO_PRODUCTS.forEach((p) => {
    map[p.id] = {
      productId: p.id,
      warehouseId: "wh-central-01",
      warehouseName: "Central Fulfillment Hub (Bay A)",
      qtyOnHand: 150,
      qtyReserved: 12
    };
  });
  return map;
}

export function getInitialTierItems(): Record<string, PriceListItem> {
  const map: Record<string, PriceListItem> = {};
  DEMO_PRODUCTS.forEach((p) => {
    map[p.id] = {
      id: `tier1_${p.id}`,
      priceListId: "tier-supermarket-prime",
      productId: p.id,
      priceCents: Math.round(p.basePriceCents * 0.85) // 15% tier discount
    };
  });
  return map;
}

export function getInitialOverrides(): Record<string, ClientPriceOverride> {
  return {
    "prod-colombian-coffee-case": {
      id: "override_metro_coffee",
      clientAccountId: "client-metro-supermarket",
      productId: "prod-colombian-coffee-case",
      customPriceCents: 6800 // $68.00 override vs $84.00 base
    }
  };
}

// Local Storage helpers for resilient offline state
export function getStoredOrders(): Order[] {
  if (typeof window === "undefined") return INITIAL_SAMPLE_ORDERS;
  try {
    const raw = localStorage.getItem("kargohub_orders");
    if (raw) return JSON.parse(raw);
    localStorage.setItem("kargohub_orders", JSON.stringify(INITIAL_SAMPLE_ORDERS));
    return INITIAL_SAMPLE_ORDERS;
  } catch {
    return INITIAL_SAMPLE_ORDERS;
  }
}

export function saveStoredOrders(orders: Order[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kargohub_orders", JSON.stringify(orders));
  } catch (e) {
    console.warn("Could not save to localStorage", e);
  }
}

export function getStoredProducts(): Product[] {
  if (typeof window === "undefined") return DEMO_PRODUCTS;
  try {
    const raw = localStorage.getItem("kargohub_products");
    if (raw) return JSON.parse(raw);
    localStorage.setItem("kargohub_products", JSON.stringify(DEMO_PRODUCTS));
    return DEMO_PRODUCTS;
  } catch {
    return DEMO_PRODUCTS;
  }
}

export function saveStoredProducts(products: Product[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kargohub_products", JSON.stringify(products));
  } catch (e) {
    console.warn("Could not save products to localStorage", e);
  }
}

import { DEMO_CLIENTS } from "./seedService";
export function getStoredClients(): import("@/types").ClientAccount[] {
  if (typeof window === "undefined") return DEMO_CLIENTS;
  try {
    const raw = localStorage.getItem("kargohub_clients");
    if (raw) return JSON.parse(raw);
    localStorage.setItem("kargohub_clients", JSON.stringify(DEMO_CLIENTS));
    return DEMO_CLIENTS;
  } catch {
    return DEMO_CLIENTS;
  }
}

export function saveStoredClients(clients: import("@/types").ClientAccount[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kargohub_clients", JSON.stringify(clients));
  } catch (e) {
    console.warn("Could not save clients to localStorage", e);
  }
}

import { DEMO_USERS } from "./seedService";
import { UserProfile, InboundRestockRecord, DispatchAssignment } from "@/types";

export function getStoredUsers(): UserProfile[] {
  if (typeof window === "undefined") return DEMO_USERS;
  try {
    const raw = localStorage.getItem("kargohub_staff_users");
    if (raw) return JSON.parse(raw);
    localStorage.setItem("kargohub_staff_users", JSON.stringify(DEMO_USERS));
    return DEMO_USERS;
  } catch {
    return DEMO_USERS;
  }
}

export function saveStoredUsers(users: UserProfile[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kargohub_staff_users", JSON.stringify(users));
  } catch (e) {
    console.warn("Could not save staff to localStorage", e);
  }
}

export function getStoredRestocks(): InboundRestockRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("kargohub_restocks");
    if (raw) return JSON.parse(raw);
    return [];
  } catch {
    return [];
  }
}

export function saveStoredRestocks(restocks: InboundRestockRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kargohub_restocks", JSON.stringify(restocks));
  } catch (e) {
    console.warn("Could not save restocks to localStorage", e);
  }
}

export function getStoredDispatches(): DispatchAssignment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("kargohub_dispatches");
    if (raw) return JSON.parse(raw);
    return [];
  } catch {
    return [];
  }
}

export function saveStoredDispatches(dispatches: DispatchAssignment[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("kargohub_dispatches", JSON.stringify(dispatches));
  } catch (e) {
    console.warn("Could not save dispatches to localStorage", e);
  }
}

