"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import ProductCatalog from "@/components/client/ProductCatalog";
import OrderHistoryView from "@/components/client/OrderHistoryView";
import CartModal from "@/components/client/CartModal";
import AdminFulfillmentHub from "@/components/admin/AdminFulfillmentHub";
import AdminInventoryManager from "@/components/admin/AdminInventoryManager";
import AdminPricingMatrix from "@/components/admin/AdminPricingMatrix";
import AdminClientManager from "@/components/admin/AdminClientManager";
import AdminFinanceManager from "@/components/admin/AdminFinanceManager";
import AdminDispatchManager from "@/components/admin/AdminDispatchManager";
import AdminStaffManager from "@/components/admin/AdminStaffManager";
import WarehouseView from "@/components/warehouse/WarehouseView";
import DriverDeliveryView from "@/components/driver/DriverDeliveryView";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { seedInitialDatabase } from "@/lib/services/seedService";
import { Sparkles, Shield, Store, Truck, Warehouse as WarehouseIcon, ShoppingCart, ChevronRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatCurrency } from "@/lib/utils/currency";

export default function HomePage() {
  const { currentUser, currentClient } = useAuth();
  const { totalItemsCount, totalCents } = useCart();
  const [activeTab, setActiveTab] = useState<string>("catalog");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Synchronize default tab when role switches
  useEffect(() => {
    if (currentUser.role === "admin") {
      setActiveTab("admin-orders");
    } else if (currentUser.role === "warehouse") {
      setActiveTab("warehouse");
    } else if (currentUser.role === "driver") {
      setActiveTab("driver");
    } else {
      setActiveTab("catalog");
    }
  }, [currentUser.role]);

  // Check if database needs seeding on first ever boot
  useEffect(() => {
    async function checkDatabase() {
      try {
        const q = query(collection(db, "products"), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
          console.log("Empty database detected. Auto-seeding initial KargoHub data...");
          await seedInitialDatabase();
        }
      } catch (err) {
        console.warn("Firestore access notice:", err);
      } finally {
        setInitialCheckDone(true);
      }
    }
    checkDatabase();
  }, []);

  const handleOrderSuccess = (orderId: string, orderNumber: string) => {
    setActiveTab("my-orders");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Main Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Role Context Bar */}
      <div className="bg-white border-b border-slate-200/80 py-2.5 px-4 sm:px-8 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>
            Active Persona: <strong className="text-slate-900 font-semibold">{currentUser.name}</strong>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Role: <strong className="text-blue-600 uppercase font-semibold">{currentUser.role.replace("_", " ")}</strong>
          </span>
          {currentClient && (
            <>
              <span className="text-slate-300">|</span>
              <span>
                Account: <strong className="text-slate-900 font-semibold">{currentClient.companyName}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Terms: <strong className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">{currentClient.creditTerms}</strong>
              </span>
            </>
          )}
        </div>

        <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-2">
          <span>Switch roles in the top-right dropdown to test fulfillment lifecycle end-to-end.</span>
        </div>
      </div>

      {/* Main Body View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "catalog" && <ProductCatalog />}
        {activeTab === "my-orders" && <OrderHistoryView />}
        {activeTab === "admin-orders" && <AdminFulfillmentHub />}
        {activeTab === "admin-inventory" && <AdminInventoryManager />}
        {activeTab === "admin-pricing" && <AdminPricingMatrix />}
        {activeTab === "admin-clients" && <AdminClientManager />}
        {activeTab === "admin-finance" && <AdminFinanceManager />}
        {activeTab === "admin-dispatch" && <AdminDispatchManager />}
        {activeTab === "admin-staff" && <AdminStaffManager />}
        {activeTab === "warehouse" && <WarehouseView />}
        {activeTab === "driver" && <DriverDeliveryView />}
      </main>

      {/* Cart & Checkout Modal Drawer */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Floating Bottom Cart Bar for Mobile Clients */}
      {(currentUser.role === "client_owner" || currentUser.role === "client_staff") &&
        activeTab === "catalog" &&
        totalItemsCount > 0 &&
        !isCartOpen && (
          <aside
            aria-label="Mobile cart checkout"
            className="sm:hidden fixed bottom-4 left-4 right-4 z-40 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-3 rounded-2xl shadow-2xl shadow-blue-500/30 border border-blue-400/40 flex items-center justify-between text-white animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold leading-tight">
                  {totalItemsCount} {totalItemsCount === 1 ? "Case" : "Cases"} Selected
                </div>
                <div className="text-[11px] text-blue-100 font-mono font-medium">
                  Subtotal: {formatCurrency(totalCents)}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="px-3.5 py-2 bg-white text-blue-700 font-bold text-xs rounded-xl shadow hover:bg-blue-50 transition-colors flex items-center gap-1 shrink-0"
            >
              <span>View Cart</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </aside>
        )}

      {/* Global Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 tracking-tight">KargoHub</span>
            <span>&copy; 2026 B2B Wholesale Ordering Platform</span>
          </div>
          <div className="text-slate-500 text-[11px]">
            Engineered with Next.js, Firebase Auth & Firestore Atomic Concurrency
          </div>
        </div>
      </footer>
    </div>
  );
}
