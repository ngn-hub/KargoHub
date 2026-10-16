"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Product, InventoryItem } from "@/types";
import { formatCurrency, parseDollarsToCents } from "@/lib/utils/currency";
import {
  Package,
  Layers,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Boxes,
  PlusCircle,
  Save,
  CheckCircle2
} from "lucide-react";
import { DEMO_PRODUCTS } from "@/lib/services/seedService";
import { getInitialInventory } from "@/lib/services/storeSync";

export default function AdminInventoryManager() {
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [inventoryMap, setInventoryMap] = useState<Record<string, InventoryItem>>(getInitialInventory());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStockOnHand, setEditStockOnHand] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "products"), (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
          setProducts(items);
        }
      }, () => {});
      return () => unsub();
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "inventory"), (snap) => {
        if (!snap.empty) {
          const map: Record<string, InventoryItem> = {};
          snap.docs.forEach((d) => {
            const item = d.data() as InventoryItem;
            map[item.productId] = item;
          });
          setInventoryMap(map);
        }
      }, () => {});
      return () => unsub();
    } catch {}
  }, []);

  const handleStartEdit = (product: Product) => {
    setEditingId(product.id);
    setEditPrice((product.basePriceCents / 100).toFixed(2));
    const inv = inventoryMap[product.id];
    setEditStockOnHand(inv ? inv.qtyOnHand : 0);
  };

  const handleSave = async (product: Product) => {
    const newPriceCents = parseDollarsToCents(editPrice);
    if (newPriceCents <= 0) {
      alert("Price must be greater than zero.");
      return;
    }

    try {
      // 1. Update product base price
      await updateDoc(doc(db, "products", product.id), {
        basePriceCents: newPriceCents
      });

      // 2. Update physical stock on hand
      const warehouseId = "wh-central-01";
      const invRef = doc(db, "inventory", `${product.id}_${warehouseId}`);
      await updateDoc(invRef, {
        qtyOnHand: editStockOnHand
      });

      setEditingId(null);
      setNotice(`Updated ${product.name} base price and stock.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update item.");
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Master Catalog & Warehouse Stock</h2>
          <p className="text-xs text-slate-400">
            Real-time control over physical inventory on hand and base wholesale prices.
          </p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-medium">
          Warehouse: <strong className="text-white">Central Hub (wh-central-01)</strong>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800 font-bold">
              <tr>
                <th className="py-3.5 px-4">SKU / Item</th>
                <th className="py-3.5 px-4">Unit / Pack</th>
                <th className="py-3.5 px-4">MOQ</th>
                <th className="py-3.5 px-4">Base Price</th>
                <th className="py-3.5 px-4">Stock On Hand</th>
                <th className="py-3.5 px-4">Reserved</th>
                <th className="py-3.5 px-4">Available</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {products.map((p) => {
                const inv = inventoryMap[p.id];
                const onHand = inv ? inv.qtyOnHand : 0;
                const reserved = inv ? inv.qtyReserved : 0;
                const available = onHand - reserved;
                const isEditing = editingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition-colors">
                    {/* SKU & Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[11px] font-bold text-blue-400">
                        {p.sku}
                      </div>
                      <div className="font-semibold text-white text-xs mt-0.5 line-clamp-1">
                        {p.name}
                      </div>
                    </td>

                    {/* Unit & Pack Size */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <span className="capitalize">{p.unit}</span> ({p.packSize} pk)
                    </td>

                    {/* MOQ */}
                    <td className="py-3.5 px-4 text-slate-300 font-semibold">
                      {p.moq} {p.unit}s
                    </td>

                    {/* Base Price */}
                    <td className="py-3.5 px-4">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-20 bg-slate-950 border border-slate-700 text-xs text-white p-1 rounded"
                          />
                        </div>
                      ) : (
                        <span className="font-bold text-white">
                          {formatCurrency(p.basePriceCents)}
                        </span>
                      )}
                    </td>

                    {/* Stock on Hand */}
                    <td className="py-3.5 px-4">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editStockOnHand}
                          onChange={(e) => setEditStockOnHand(parseInt(e.target.value) || 0)}
                          className="w-20 bg-slate-950 border border-slate-700 text-xs text-white p-1 rounded"
                        />
                      ) : (
                        <span className="font-medium text-slate-300">{onHand}</span>
                      )}
                    </td>

                    {/* Reserved */}
                    <td className="py-3.5 px-4 text-amber-400 font-medium">
                      {reserved}
                    </td>

                    {/* Available Stock */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[11px] border ${
                          available <= 0
                            ? "bg-red-950 text-red-300 border-red-500/30"
                            : available <= 20
                            ? "bg-amber-950 text-amber-300 border-amber-500/30"
                            : "bg-emerald-950 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {available} {p.unit}s
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSave(p)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                            title="Save changes"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(p)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
                          title="Edit Price & Stock"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
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
