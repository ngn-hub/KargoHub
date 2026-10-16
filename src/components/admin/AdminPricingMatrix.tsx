"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot } from "firebase/firestore";
import { Product, PriceList, PriceListItem, ClientPriceOverride } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import { Layers, Tag, TrendingDown, Users } from "lucide-react";

import { DEMO_PRODUCTS, DEMO_PRICE_LISTS } from "@/lib/services/seedService";
import { getInitialTierItems, getInitialOverrides } from "@/lib/services/storeSync";

export default function AdminPricingMatrix() {
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [priceLists, setPriceLists] = useState<PriceList[]>(DEMO_PRICE_LISTS);
  const [tierItems, setTierItems] = useState<PriceListItem[]>(() => {
    return Object.values(getInitialTierItems());
  });
  const [overrides, setOverrides] = useState<ClientPriceOverride[]>(() => {
    return Object.values(getInitialOverrides());
  });

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "products"), (snap) => {
        if (!snap.empty) setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      }, () => {});
      return () => unsub();
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "price_lists"), (snap) => {
        if (!snap.empty) setPriceLists(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceList)));
      }, () => {});
      return () => unsub();
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "price_list_items"), (snap) => {
        if (!snap.empty) setTierItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceListItem)));
      }, () => {});
      return () => unsub();
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "client_price_overrides"), (snap) => {
        if (!snap.empty) setOverrides(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientPriceOverride)));
      }, () => {});
      return () => unsub();
    } catch {}
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Tiered Wholesale Pricing Matrix</h2>
        <p className="text-xs text-slate-400">
          Strict precedence resolution: Client Custom Override &rarr; Tier Assigned Price &rarr; Base Wholesale Price.
        </p>
      </div>

      {/* Pricing Matrix Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 font-bold">
              <tr>
                <th className="py-3.5 px-4">Product SKU & Name</th>
                <th className="py-3.5 px-4">Base Wholesale</th>
                {priceLists.map((pl) => (
                  <th key={pl.id} className="py-3.5 px-4">
                    <div className="text-blue-300 font-bold">{pl.name}</div>
                    <div className="text-[9px] text-slate-500 normal-case">{pl.description}</div>
                  </th>
                ))}
                <th className="py-3.5 px-4">Client Custom Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {products.map((p) => {
                const override = overrides.find((o) => o.productId === p.id);

                return (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition-colors">
                    {/* SKU & Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs font-bold text-blue-400">{p.sku}</div>
                      <div className="font-medium text-white text-xs">{p.name}</div>
                    </td>

                    {/* Base Wholesale */}
                    <td className="py-3.5 px-4 font-bold text-slate-300">
                      {formatCurrency(p.basePriceCents)}
                    </td>

                    {/* Tier Columns */}
                    {priceLists.map((pl) => {
                      const item = tierItems.find(
                        (ti) => ti.priceListId === pl.id && ti.productId === p.id
                      );
                      const discount =
                        item && p.basePriceCents > 0
                          ? Math.round(((p.basePriceCents - item.priceCents) / p.basePriceCents) * 100)
                          : 0;

                      return (
                        <td key={pl.id} className="py-3.5 px-4">
                          {item ? (
                            <div>
                              <span className="font-bold text-white">
                                {formatCurrency(item.priceCents)}
                              </span>
                              <span className="ml-1 text-[10px] text-blue-400 font-semibold">
                                (-{discount}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Custom Override Column */}
                    <td className="py-3.5 px-4">
                      {override ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-[11px]">
                          <Tag className="w-3 h-3" />
                          Metro Supermarket: {formatCurrency(override.customPriceCents)}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[11px]">Standard Tier Applies</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
