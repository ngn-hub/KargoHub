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
import WarehouseView from "@/components/warehouse/WarehouseView";
import DriverDeliveryView from "@/components/driver/DriverDeliveryView";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { seedInitialDatabase } from "@/lib/services/seedService";
import { Sparkles, Shield, Store, Truck, Warehouse as WarehouseIcon } from "lucide-react";

export default function HomePage() {
  const { currentUser, currentClient } = useAuth();
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Main Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Role Context Bar */}
      <div className="bg-slate-900/40 border-b border-slate-800/60 py-2.5 px-4 sm:px-8 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-400">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>
            Active Persona: <strong className="text-white">{currentUser.name}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Role: <strong className="text-blue-400 uppercase">{currentUser.role.replace("_", " ")}</strong>
          </span>
          {currentClient && (
            <>
              <span className="text-slate-600">|</span>
              <span>
                Account: <strong className="text-white">{currentClient.companyName}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Terms: <strong className="text-amber-400 uppercase">{currentClient.creditTerms}</strong>
              </span>
            </>
          )}
        </div>

        <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-2">
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
        {activeTab === "warehouse" && <WarehouseView />}
        {activeTab === "driver" && <DriverDeliveryView />}
      </main>

      {/* Cart & Checkout Modal Drawer */}
      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-tight">KargoHub</span>
            <span>&copy; 2026 B2B Wholesale Ordering Platform</span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Engineered with Next.js, Firebase Auth & Firestore Atomic Concurrency
          </div>
        </div>
      </footer>
    </div>
  );
}
