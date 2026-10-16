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
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Master Catalog & Warehouse Stock</h2>
          <p className="text-xs text-slate-500">
            Real-time control over physical inventory on hand and base wholesale prices.
          </p>
        </div>
        <div className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-medium shadow-xs">
          Warehouse: <strong className="text-slate-900">Central Hub (wh-central-01)</strong>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
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
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const inv = inventoryMap[p.id];
                const onHand = inv ? inv.qtyOnHand : 0;
                const reserved = inv ? inv.qtyReserved : 0;
                const available = onHand - reserved;
                const isEditing = editingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* SKU & Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[11px] font-bold text-blue-600">
                        {p.sku}
                      </div>
                      <div className="font-semibold text-slate-900 text-xs mt-0.5 line-clamp-1">
                        {p.name}
                      </div>
                    </td>

                    {/* Unit & Pack Size */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="capitalize">{p.unit}</span> ({p.packSize} pk)
                    </td>

                    {/* MOQ */}
                    <td className="py-3.5 px-4 text-slate-800 font-semibold">
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
                            className="w-20 bg-white border border-slate-300 text-xs text-slate-900 p-1 rounded focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      ) : (
                        <span className="font-bold text-slate-900">
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
                          className="w-20 bg-white border border-slate-300 text-xs text-slate-900 p-1 rounded focus:outline-none focus:border-blue-500"
                        />
                      ) : (
                        <span className="font-medium text-slate-700">{onHand}</span>
                      )}
                    </td>

                    {/* Reserved */}
                    <td className="py-3.5 px-4 text-amber-600 font-semibold">
                      {reserved}
                    </td>

                    {/* Available Stock */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[11px] border ${
                          available <= 0
                            ? "bg-red-50 text-red-700 border-red-200"
                            : available <= 20
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
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
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors"
                            title="Save changes"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(p)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors"
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
