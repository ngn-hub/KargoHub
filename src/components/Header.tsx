"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import {
  Package,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Warehouse,
  Store,
  RefreshCw,
  UserCheck,
  ChevronDown,
  Sparkles,
  ClipboardList,
  Clock
} from "lucide-react";
import { seedInitialDatabase } from "@/lib/services/seedService";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCart: () => void;
}

export default function Header({ activeTab, setActiveTab, onOpenCart }: HeaderProps) {
  const { currentUser, currentClient, allUsers, switchUser } = useAuth();
  const { totalItemsCount } = useCart();
  const [seeding, setSeeding] = useState(false);
  const [seedNotice, setSeedNotice] = useState<string | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    const res = await seedInitialDatabase();
    setSeeding(false);
    if (res.success) {
      setSeedNotice("Database initialized with demo data!");
      setTimeout(() => setSeedNotice(null), 4000);
      window.location.reload();
    } else {
      setSeedNotice("Error: " + res.message);
      setTimeout(() => setSeedNotice(null), 4000);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return { label: "Admin Owner", bg: "bg-purple-50 text-purple-700 border-purple-200", icon: ShieldCheck };
      case "warehouse":
        return { label: "Warehouse Lead", bg: "bg-amber-50 text-amber-700 border-amber-200", icon: Warehouse };
      case "driver":
        return { label: "Fleet Driver", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Truck };
      case "client_owner":
        return { label: "Client Owner", bg: "bg-blue-50 text-blue-700 border-blue-200", icon: Store };
      case "client_staff":
        return { label: "Client Staff", bg: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: UserCheck };
      default:
        return { label: role, bg: "bg-slate-100 text-slate-700 border-slate-200", icon: UserCheck };
    }
  };

  const currentBadge = getRoleBadge(currentUser.role);
  const RoleIcon = currentBadge.icon;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      {/* Top Banner Notice if seeded */}
      {seedNotice && (
        <div className="bg-emerald-600 text-white text-xs py-1.5 px-4 text-center font-medium shadow-xs">
          {seedNotice}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md shadow-blue-500/20">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  KargoHub
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  B2B Wholesale
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-[180px] sm:max-w-none">
                {currentClient ? `${currentClient.companyName} (${currentClient.creditTerms.toUpperCase()})` : "Distributor Central Hub"}
              </p>
            </div>
          </div>

          {/* Navigation Tabs based on Role */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            {/* Client Tabs */}
            {(currentUser.role === "client_owner" || currentUser.role === "client_staff") && (
              <>
                <button
                  onClick={() => setActiveTab("catalog")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "catalog"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  Wholesale Catalog
                </button>
                <button
                  onClick={() => setActiveTab("my-orders")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "my-orders"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  Order History & Reorder
                </button>
              </>
            )}

            {/* Admin Tabs */}
            {currentUser.role === "admin" && (
              <>
                <button
                  onClick={() => setActiveTab("admin-orders")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "admin-orders"
                      ? "bg-white text-purple-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  Fulfillment Hub
                </button>
                <button
                  onClick={() => setActiveTab("admin-inventory")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "admin-inventory"
                      ? "bg-white text-purple-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  Catalog & Inventory
                </button>
                <button
                  onClick={() => setActiveTab("admin-pricing")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === "admin-pricing"
                      ? "bg-white text-purple-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  Tier Pricing Matrix
                </button>
              </>
            )}

            {/* Warehouse Tab */}
            {currentUser.role === "warehouse" && (
              <button
                onClick={() => setActiveTab("warehouse")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "warehouse"
                    ? "bg-white text-amber-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                Pick & Pack Operations
              </button>
            )}

            {/* Driver Tab */}
            {currentUser.role === "driver" && (
              <button
                onClick={() => setActiveTab("driver")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "driver"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                Route Delivery App
              </button>
            )}
          </nav>

          {/* Right Action Controls: Cart, Persona Switcher, Seed DB */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Cart Trigger (for client roles - prioritized) */}
            {(currentUser.role === "client_owner" || currentUser.role === "client_staff") && (
              <button
                onClick={onOpenCart}
                className="relative flex items-center justify-center p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition-all shrink-0"
                title="View Wholesale Cart"
              >
                <ShoppingCart className="w-4 h-4" />
                {totalItemsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-amber-400 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                    {totalItemsCount}
                  </span>
                )}
              </button>
            )}

            {/* Persona Switcher Dropdown */}
            <div className="relative">
              <select
                aria-label="Switch Persona"
                value={currentUser.id}
                onChange={(e) => switchUser(e.target.value)}
                className="appearance-none bg-white border border-slate-300 hover:border-slate-400 text-[11px] sm:text-xs text-slate-800 py-1.5 pl-2.5 pr-6 rounded-xl cursor-pointer font-semibold max-w-[125px] sm:max-w-[195px] truncate focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs transition-colors"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name.split(" ")[0]} ({u.role.replace("_", " ")})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-2.5 pointer-events-none" />
            </div>

            {/* Quick Demo Database Seeder */}
            <button
              onClick={handleSeed}
              disabled={seeding}
              title="Populate demo catalog, inventory and pricing tiers"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all shadow-xs shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? "animate-spin text-blue-600" : "text-slate-500"}`} />
              <span className="hidden md:inline">Reset Data</span>
            </button>

            {/* Role Badge Indicator */}
            <div className={`hidden lg:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl border ${currentBadge.bg}`}>
              <RoleIcon className="w-3.5 h-3.5" />
              <span>{currentBadge.label}</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-200 text-xs">
          {(currentUser.role === "client_owner" || currentUser.role === "client_staff") && (
            <>
              <button
                onClick={() => setActiveTab("catalog")}
                className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === "catalog" ? "bg-blue-50 text-blue-700 font-bold border border-blue-200" : "text-slate-600"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Catalog</span>
              </button>
              <button
                onClick={() => setActiveTab("my-orders")}
                className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all ${
                  activeTab === "my-orders" ? "bg-blue-50 text-blue-700 font-bold border border-blue-200" : "text-slate-600"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Orders</span>
              </button>
              <button
                onClick={onOpenCart}
                className="py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-blue-700 font-bold bg-blue-50 border border-blue-200"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
                <span>Cart ({totalItemsCount})</span>
              </button>
            </>
          )}
          {currentUser.role === "admin" && (
            <>
              <button
                onClick={() => setActiveTab("admin-orders")}
                className={`py-1 px-3 rounded-lg font-semibold ${activeTab === "admin-orders" ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold" : "text-slate-600"}`}
              >
                Fulfillment
              </button>
              <button
                onClick={() => setActiveTab("admin-inventory")}
                className={`py-1 px-3 rounded-lg font-semibold ${activeTab === "admin-inventory" ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold" : "text-slate-600"}`}
              >
                Inventory
              </button>
              <button
                onClick={() => setActiveTab("admin-pricing")}
                className={`py-1 px-3 rounded-lg font-semibold ${activeTab === "admin-pricing" ? "bg-purple-50 text-purple-700 border border-purple-200 font-bold" : "text-slate-600"}`}
              >
                Tiers
              </button>
            </>
          )}
          {currentUser.role === "warehouse" && (
            <button
              onClick={() => setActiveTab("warehouse")}
              className="text-amber-700 bg-amber-50 border border-amber-200 font-bold py-1 px-3 rounded-lg"
            >
              Picking & Packing
            </button>
          )}
          {currentUser.role === "driver" && (
            <button
              onClick={() => setActiveTab("driver")}
              className="text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold py-1 px-3 rounded-lg"
            >
              Driver Delivery
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
