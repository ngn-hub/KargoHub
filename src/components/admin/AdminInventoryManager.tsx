"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { Product, InventoryItem, ProductUnit } from "@/types";
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
  CheckCircle2,
  Trash2,
  Image as ImageIcon,
  UploadCloud,
  Search,
  Filter,
  Eye,
  Tag
} from "lucide-react";
import { DEMO_PRODUCTS } from "@/lib/services/seedService";
import { getInitialInventory, getStoredProducts, saveStoredProducts, getStoredRestocks, saveStoredRestocks } from "@/lib/services/storeSync";
import { compressPaymentSlip } from "@/lib/utils/imageCompressor";
import InboundRestockModal from "./InboundRestockModal";
import { InboundRestockRecord } from "@/types";

const PRESET_CATEGORIES = [
  "Beverages",
  "Dairy & Plant Milk",
  "Pantry & Dry Goods",
  "Bakery & Grains",
  "Packaging & Consumables"
];

const SAMPLE_PRESET_IMAGES = [
  { name: "Coffee Beans", url: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80" },
  { name: "Oat Milk", url: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80" },
  { name: "Olive Oil", url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80" },
  { name: "Organic Flour", url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80" },
  { name: "Mineral Water", url: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80" },
  { name: "Matcha Powder", url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80" }
];

interface ProductFormData {
  id?: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  unit: ProductUnit;
  packSize: number;
  moq: number;
  basePriceDollars: string;
  qtyOnHand: number;
  imageUrl: string;
}

const DEFAULT_FORM: ProductFormData = {
  sku: "",
  name: "",
  category: "Beverages",
  description: "",
  unit: "case",
  packSize: 12,
  moq: 1,
  basePriceDollars: "45.00",
  qtyOnHand: 100,
  imageUrl: ""
};

export default function AdminInventoryManager() {
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [inventoryMap, setInventoryMap] = useState<Record<string, InventoryItem>>(getInitialInventory());
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<ProductFormData>(DEFAULT_FORM);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);

  // Fast inline edit fallback
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStockOnHand, setEditStockOnHand] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleConfirmRestock = async (record: InboundRestockRecord) => {
    const warehouseId = "wh-central-01";
    const currentInv = inventoryMap[record.productId];
    const newOnHand = (currentInv ? currentInv.qtyOnHand : 0) + record.quantityReceived;

    const updatedInv: InventoryItem = {
      productId: record.productId,
      warehouseId,
      warehouseName: "Central Fulfillment Hub (Bay A)",
      qtyOnHand: newOnHand,
      qtyReserved: currentInv ? currentInv.qtyReserved : 0
    };

    try {
      await setDoc(doc(db, "inventory", `${record.productId}_${warehouseId}`), updatedInv, { merge: true });
    } catch {}

    setInventoryMap((prev) => ({
      ...prev,
      [record.productId]: updatedInv
    }));

    const restocks = [record, ...getStoredRestocks()];
    saveStoredRestocks(restocks);

    setNotice(`Intake confirmed: Added +${record.quantityReceived} ${selectedProductUnit(record.productId)} of ${record.productName} (PO: ${record.poNumber})!`);
    setTimeout(() => setNotice(null), 4000);
  };

  const selectedProductUnit = (id: string) => {
    const p = products.find((prod) => prod.id === id);
    return p ? `${p.unit}s` : "units";
  };

  // 1. Live subscribe to products
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "products"), (snap) => {
        if (!snap.empty) {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
          setProducts(items);
          saveStoredProducts(items);
        }
      }, () => {
        const local = getStoredProducts();
        setProducts(local);
      });
      return () => unsub();
    } catch {
      // offline fallback
    }
  }, []);

  // 2. Live subscribe to inventory
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

  // Open Create Modal
  const handleOpenCreate = () => {
    const nextSkuNum = (products.length + 1).toString().padStart(3, "0");
    setFormData({
      ...DEFAULT_FORM,
      sku: `PROD-${nextSkuNum}`
    });
    setModalMode("create");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (product: Product) => {
    const inv = inventoryMap[product.id];
    setFormData({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category || "Beverages",
      description: product.description || "",
      unit: product.unit || "case",
      packSize: product.packSize || 1,
      moq: product.moq || 1,
      basePriceDollars: (product.basePriceCents / 100).toFixed(2),
      qtyOnHand: inv ? inv.qtyOnHand : 100,
      imageUrl: product.imageUrl || ""
    });
    setModalMode("edit");
    setIsModalOpen(true);
  };

  // Image Upload with Client-Side Compression
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressedBase64 = await compressPaymentSlip(file, 640, 640, 0.85);
      setFormData((prev) => ({ ...prev, imageUrl: compressedBase64 }));
    } catch (err) {
      console.error("Image compression error:", err);
      alert("Failed to process image. Please try another file.");
    } finally {
      setIsCompressing(false);
    }
  };

  // Submit Modal (Create or Edit)
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.sku.trim()) {
      alert("Please enter a valid product name and SKU.");
      return;
    }

    const priceCents = parseDollarsToCents(formData.basePriceDollars);
    if (priceCents <= 0) {
      alert("Base price must be greater than zero.");
      return;
    }

    setIsSaving(true);
    try {
      const productId = formData.id || `prod-${formData.sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
      const productPayload: Product = {
        id: productId,
        sku: formData.sku.toUpperCase().trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        unit: formData.unit,
        packSize: Number(formData.packSize) || 1,
        moq: Number(formData.moq) || 1,
        basePriceCents: priceCents,
        imageUrl: formData.imageUrl || SAMPLE_PRESET_IMAGES[0].url,
        createdAt: new Date().toISOString()
      };

      // 1. Save product
      try {
        await setDoc(doc(db, "products", productId), productPayload, { merge: true });
      } catch (err) {
        console.warn("Firestore offline write:", err);
      }

      // 2. Save physical inventory record
      const warehouseId = "wh-central-01";
      const invRecord: InventoryItem = {
        productId,
        warehouseId,
        warehouseName: "Central Fulfillment Hub (Bay A)",
        qtyOnHand: Number(formData.qtyOnHand) || 0,
        qtyReserved: inventoryMap[productId]?.qtyReserved || 0
      };

      try {
        await setDoc(doc(db, "inventory", `${productId}_${warehouseId}`), invRecord, { merge: true });
      } catch (err) {
        console.warn("Firestore offline inventory write:", err);
      }

      // 3. Update local state & localStorage for immediate catalog availability
      const updatedList = modalMode === "create"
        ? [productPayload, ...products.filter((p) => p.id !== productId)]
        : products.map((p) => (p.id === productId ? productPayload : p));

      setProducts(updatedList);
      saveStoredProducts(updatedList);

      setInventoryMap((prev) => ({
        ...prev,
        [productId]: invRecord
      }));

      setIsModalOpen(false);
      setNotice(modalMode === "create" ? `Added "${productPayload.name}" to catalog!` : `Updated "${productPayload.name}".`);
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      alert("Error saving item: " + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete / Archive item
  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to remove "${product.name}" (${product.sku}) from the catalog?`)) {
      return;
    }

    try {
      try {
        await deleteDoc(doc(db, "products", product.id));
      } catch {}

      const updated = products.filter((p) => p.id !== product.id);
      setProducts(updated);
      saveStoredProducts(updated);
      setNotice(`Removed ${product.name} from active catalog.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert("Failed to delete item: " + err.message);
    }
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header with Title and Add Item Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Wholesale Catalog & Inventory Control</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage product specifications, wholesale photography, packaging rules, and physical warehouse stock.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsRestockOpen(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-amber-600/20 flex items-center gap-2 transition-all hover:scale-105"
          >
            <Boxes className="w-4 h-4" />
            <span>Receive Supplier Stock</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/20 flex items-center gap-2 transition-all hover:scale-105"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add New Item</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {["All", ...PRESET_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3.5 px-4">Photo / SKU / Item</th>
                <th className="py-3.5 px-4">Category</th>
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
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                    No items match your search. Click &quot;Add New Item&quot; to create one.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const inv = inventoryMap[p.id];
                  const onHand = inv ? inv.qtyOnHand : 0;
                  const reserved = inv ? inv.qtyReserved : 0;
                  const available = onHand - reserved;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Photo, SKU & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <span className="font-mono text-[11px] font-bold text-blue-600 block">
                              {p.sku}
                            </span>
                            <span className="font-semibold text-slate-900 text-xs mt-0.5 line-clamp-1 block">
                              {p.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {p.category || "Beverages"}
                        </span>
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
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatCurrency(p.basePriceCents)}
                      </td>

                      {/* Stock on Hand */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {onHand}
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
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg border border-slate-200 transition-colors"
                            title="Edit Item Details & Photo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg border border-slate-200 transition-colors"
                            title="Delete / Archive Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative max-w-2xl w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {modalMode === "create" ? "Add New Wholesale Item" : `Edit Item — ${formData.sku}`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Update catalog photography, pricing specifications, and warehouse stock rules.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              {/* Product Photo Upload & Presets */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                  <span>Product Photography</span>
                  <span className="text-[11px] text-slate-400 font-normal">Auto-compressed for fast mobile loading</span>
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Photo Preview Box */}
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 bg-white flex items-center justify-center shrink-0 relative group">
                    {formData.imageUrl ? (
                      <>
                        <img
                          src={formData.imageUrl}
                          alt="Product Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, imageUrl: "" }))}
                          className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 text-white flex items-center justify-center text-xs font-semibold transition-opacity"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2">
                        <ImageIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <span className="text-[9px] text-slate-400 block">No Image</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1 w-full space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileChange}
                      accept="image/*"
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCompressing}
                        className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isCompressing ? "Optimizing..." : "Upload from Device"}</span>
                      </button>

                      <span className="text-xs text-slate-400">or paste URL:</span>
                    </div>

                    <input
                      type="url"
                      placeholder="https://example.com/item.jpg"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData((p) => ({ ...p, imageUrl: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500 placeholder-slate-400"
                    />

                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500">Quick Presets:</span>
                      {SAMPLE_PRESET_IMAGES.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, imageUrl: preset.url }))}
                          className="text-[10px] bg-white border border-slate-200 hover:border-blue-400 text-slate-600 px-2 py-0.5 rounded-full transition-colors"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Specs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Single-Origin Colombian Supremo"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BEV-COF-004"
                    value={formData.sku}
                    onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    {PRESET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Wholesale Unit
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value as ProductUnit }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="case">Case (Box of Units)</option>
                    <option value="box">Box</option>
                    <option value="piece">Piece / Individual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Units per Pack / Case
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.packSize}
                    onChange={(e) => setFormData((p) => ({ ...p, packSize: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Pricing & Stock Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Base Wholesale Price ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={formData.basePriceDollars}
                      onChange={(e) => setFormData((p) => ({ ...p, basePriceDollars: e.target.value }))}
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum Order Qty (MOQ)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.moq}
                    onChange={(e) => setFormData((p) => ({ ...p, moq: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Stock On Hand
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.qtyOnHand}
                    onChange={(e) => setFormData((p) => ({ ...p, qtyOnHand: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Description & Specs
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter roasting date, origin, packaging certifications, storage guidelines..."
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 placeholder-slate-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isCompressing}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/20 flex items-center gap-1.5 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "Saving..." : modalMode === "create" ? "Add to Catalog" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INBOUND SUPPLIER RESTOCK INTAKE MODAL */}
      <InboundRestockModal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        products={products}
        onConfirmRestock={handleConfirmRestock}
      />
    </div>
  );
}
