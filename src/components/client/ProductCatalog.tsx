"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { Product, InventoryItem, PriceListItem, ClientPriceOverride, Order } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { resolveProductPrice } from "@/lib/services/pricingService";
import { formatCurrency } from "@/lib/utils/currency";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Tag,
  Repeat,
  PackageCheck,
  TrendingDown,
  Layers
} from "lucide-react";
import confetti from "canvas-confetti";
import { DEMO_PRODUCTS } from "@/lib/services/seedService";
import { getInitialInventory, getInitialTierItems, getInitialOverrides, getStoredOrders, getStoredProducts } from "@/lib/services/storeSync";

export default function ProductCatalog() {
  const { currentClient, currentUser } = useAuth();
  const { addToCart, loadOrderIntoCart } = useCart();

  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [inventoryMap, setInventoryMap] = useState<Record<string, InventoryItem>>(getInitialInventory());
  const [tierItemsMap, setTierItemsMap] = useState<Record<string, PriceListItem>>(getInitialTierItems());
  const [overridesMap, setOverridesMap] = useState<Record<string, ClientPriceOverride>>(getInitialOverrides());
  const [lastCompletedOrder, setLastCompletedOrder] = useState<Order | null>(getStoredOrders()[0] || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    getStoredProducts().forEach((p) => {
      q[p.id] = p.moq;
    });
    return q;
  });
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  // 1. Live subscribe to products (with silent fallback if Firestore disabled)
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "products"), (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
          setProducts(items);
        }
      }, () => {
        setProducts(getStoredProducts());
      });
      return () => unsub();
    } catch {
      setProducts(getStoredProducts());
    }
  }, []);

  // 2. Live subscribe to inventory
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "inventory"), (snap) => {
      const map: Record<string, InventoryItem> = {};
      snap.docs.forEach((d) => {
        const item = d.data() as InventoryItem;
        map[item.productId] = item;
      });
      setInventoryMap(map);
    });
    return () => unsub();
  }, []);

  // 3. Live subscribe to price tier items for current client's tier
  useEffect(() => {
    if (!currentClient?.priceTierId) {
      setTierItemsMap({});
      return;
    }
    const q = query(
      collection(db, "price_list_items"),
      where("priceListId", "==", currentClient.priceTierId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, PriceListItem> = {};
      snap.docs.forEach((d) => {
        const item = d.data() as PriceListItem;
        map[item.productId] = item;
      });
      setTierItemsMap(map);
    });
    return () => unsub();
  }, [currentClient?.priceTierId]);

  // 4. Live subscribe to client price overrides for this client
  useEffect(() => {
    if (!currentClient?.id) {
      setOverridesMap({});
      return;
    }
    const q = query(
      collection(db, "client_price_overrides"),
      where("clientAccountId", "==", currentClient.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, ClientPriceOverride> = {};
      snap.docs.forEach((d) => {
        const item = d.data() as ClientPriceOverride;
        map[item.productId] = item;
      });
      setOverridesMap(map);
    });
    return () => unsub();
  }, [currentClient?.id]);

  // 5. Query last completed order for Quick-Reorder Banner
  useEffect(() => {
    if (!currentClient?.id) return;
    const q = query(
      collection(db, "orders"),
      where("clientAccountId", "==", currentClient.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      // Sort in memory to avoid index requirements
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const completed = orders.find((o) => o.status === "DELIVERED" || o.status === "COMPLETED" || o.status === "CONFIRMED");
      setLastCompletedOrder(completed || null);
    });
    return () => unsub();
  }, [currentClient?.id]);

  // Stepper handlers
  const handleIncrease = (product: Product) => {
    setQuantities((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] || product.moq) + 1
    }));
  };

  const handleDecrease = (product: Product) => {
    setQuantities((prev) => {
      const cur = prev[product.id] || product.moq;
      if (cur <= product.moq) return prev; // Cannot go below MOQ
      return { ...prev, [product.id]: cur - 1 };
    });
  };

  const handleAddToCart = (product: Product) => {
    const qty = quantities[product.id] || product.moq;
    const resolved = resolveProductPrice(
      product,
      overridesMap[product.id],
      tierItemsMap[product.id],
      currentClient?.priceTierId
    );

    const res = addToCart(product, resolved, qty);
    if (res.success) {
      setAddedNotice(`Added ${qty} ${product.unit}s of ${product.name} to cart.`);
      setTimeout(() => setAddedNotice(null), 3000);
    }
  };

  // One-Tap Quick Reorder action
  const handleQuickReorder = () => {
    if (!lastCompletedOrder?.items || lastCompletedOrder.items.length === 0) return;

    const reorderPayload = lastCompletedOrder.items.map((it) => {
      const prod = products.find((p) => p.id === it.productId) || {
        id: it.productId,
        sku: it.skuSnapshot,
        name: it.nameSnapshot,
        description: "",
        unit: it.unitSnapshot,
        packSize: it.packSizeSnapshot,
        moq: 1,
        basePriceCents: it.unitPriceSnapshotCents,
        category: "General",
        createdAt: new Date().toISOString()
      };

      const resolved = resolveProductPrice(
        prod,
        overridesMap[prod.id],
        tierItemsMap[prod.id],
        currentClient?.priceTierId
      );

      return {
        product: prod,
        resolvedPrice: resolved,
        quantity: it.quantity
      };
    });

    loadOrderIntoCart(reorderPayload);
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.3 } });
    setAddedNotice(`Reorder loaded! All ${reorderPayload.length} items from ${lastCompletedOrder.orderNumber} added to cart.`);
    setTimeout(() => setAddedNotice(null), 4000);
  };

  // Filter products by search and category
  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {addedNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-500 shadow-emerald-600/20 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
          <span>{addedNotice}</span>
        </div>
      )}

      {/* QUICK REORDER BANNER (KargoHub.md Screen 2 & Acceptance Criteria #1) */}
      {lastCompletedOrder && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-slate-50 border border-blue-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Repeat className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Instant 1-Tap Reorder
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Past Order #{lastCompletedOrder.orderNumber}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Reorder previous fulfillment ({formatCurrency(lastCompletedOrder.totalAmountCents)})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Loads your past line items with real-time active price validation.
                </p>
              </div>
            </div>
            <button
              onClick={handleQuickReorder}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all hover:scale-105 shrink-0"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Duplicate Last Order</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Category Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by SKU, product name, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 text-xs text-slate-900 placeholder-slate-400 pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:bg-white transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map((product) => {
          const inv = inventoryMap[product.id];
          const availableStock = inv ? inv.qtyOnHand - inv.qtyReserved : 0;
          const isOutOfStock = availableStock <= 0;
          const isLowStock = availableStock > 0 && availableStock <= 25;

          const resolved = resolveProductPrice(
            product,
            overridesMap[product.id],
            tierItemsMap[product.id],
            currentClient?.priceTierId
          );

          const qty = quantities[product.id] || product.moq;

          return (
            <div
              key={product.id}
              className="group relative flex flex-col justify-between bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl overflow-hidden p-4 transition-all hover:shadow-lg shadow-xs"
            >
              {/* Image & Badges */}
              <div className="relative w-full h-44 rounded-xl overflow-hidden bg-slate-100 mb-3 border border-slate-200">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Layers className="w-10 h-10" />
                  </div>
                )}

                {/* Stock Badge (Rule: AvailableStock = qty_on_hand - qty_reserved) */}
                <div className="absolute top-2.5 left-2.5">
                  {isOutOfStock ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 shadow-xs">
                      <XCircle className="w-3 h-3 text-red-600" /> Out of Stock
                    </span>
                  ) : isLowStock ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shadow-xs">
                      <AlertTriangle className="w-3 h-3 text-amber-700" /> Low Stock: {availableStock} {product.unit}s
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> In Stock: {availableStock} {product.unit}s
                    </span>
                  )}
                </div>

                {/* MOQ Badge */}
                <div className="absolute top-2.5 right-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/95 text-slate-700 border border-slate-200 shadow-xs">
                    MOQ: {product.moq} {product.unit}s
                  </span>
                </div>
              </div>

              {/* Title & Specs */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] font-mono text-blue-600 tracking-wider font-bold">
                    {product.sku}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Pack: {product.packSize} items/{product.unit}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                  {product.name}
                </h4>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Pricing & Checkout Stepper */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-3">
                {/* Resolved Price Display */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-900 tracking-tight">
                        {formatCurrency(resolved.unitPriceCents)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">/{product.unit}</span>
                      {resolved.discountPercentage > 0 && (
                        <span className="text-xs text-slate-400 line-through">
                          {formatCurrency(resolved.originalBasePriceCents)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing Source Badge */}
                  <div>
                    {resolved.source === "custom_override" && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        <Tag className="w-2.5 h-2.5" /> Client Override (-{resolved.discountPercentage}%)
                      </span>
                    )}
                    {resolved.source === "tier_pricing" && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        <TrendingDown className="w-2.5 h-2.5" /> Tier Discount (-{resolved.discountPercentage}%)
                      </span>
                    )}
                    {resolved.source === "base_price" && (
                      <span className="text-[10px] font-medium text-slate-500">
                        Base Wholesale Price
                      </span>
                    )}
                  </div>
                </div>

                {/* Stepper & Add to Cart Button */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                    <button
                      onClick={() => handleDecrease(product)}
                      disabled={qty <= product.moq || isOutOfStock}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-slate-900">
                      {qty}
                    </span>
                    <button
                      onClick={() => handleIncrease(product)}
                      disabled={isOutOfStock}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={isOutOfStock}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-blue-600/20"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>{isOutOfStock ? "Out of Stock" : `Add to Cart`}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
