"use client";

import React, { useState } from "react";
import { Product, InboundRestockRecord } from "@/types";
import {
  Boxes,
  Truck,
  Check,
  X,
  FileText,
  Building,
  PlusCircle,
  Calendar,
  AlertCircle
} from "lucide-react";

interface InboundRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onConfirmRestock: (record: InboundRestockRecord) => Promise<void>;
}

export default function InboundRestockModal({
  isOpen,
  onClose,
  products,
  onConfirmRestock
}: InboundRestockModalProps) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [quantity, setQuantity] = useState("50");
  const [supplierName, setSupplierName] = useState("");
  const [poNumber, setPoNumber] = useState(`PO-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [batchNumber, setBatchNumber] = useState(`LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`);
  const [warehouseLocation, setWarehouseLocation] = useState("Central Hub - Bay 2 Intake");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      alert("Please enter a valid received quantity.");
      return;
    }
    if (!supplierName.trim()) {
      alert("Please enter the supplier / vendor name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const restockRecord: InboundRestockRecord = {
        id: `rst-${Date.now()}`,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        quantityReceived: qty,
        supplierName: supplierName.trim(),
        poNumber: poNumber.trim(),
        batchNumber: batchNumber.trim(),
        receivedByUserName: "Warehouse Intake Lead",
        warehouseLocation,
        createdAt: new Date().toISOString()
      };

      await onConfirmRestock(restockRecord);
      onClose();
    } catch (err: any) {
      alert("Error logging restock: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl my-8 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Receive Inbound Supplier Restock
              </h3>
              <p className="text-[11px] text-slate-500">
                Log physical delivery intake against a Purchase Order to increment available stock.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Product Select */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Select Received SKU / Product *
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-amber-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name} ({p.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Name & PO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Supplier / Manufacturer Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Colombian Highlands Direct"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Purchase Order (PO) #
              </label>
              <input
                type="text"
                required
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Quantity & Batch Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Quantity Received ({selectedProduct?.unit || "units"}) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Batch / Lot Identifier
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Warehouse Bay */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Receiving Dock & Shelf Staging Bay
            </label>
            <input
              type="text"
              value={warehouseLocation}
              onChange={(e) => setWarehouseLocation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm shadow-amber-600/20 flex items-center gap-1.5 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Updating Inventory..." : "Confirm Intake & Increment Stock"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
