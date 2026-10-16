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
  ClipboardList
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
        return { label: "Admin Owner", bg: "bg-purple-900/60 text-purple-200 border-purple-500/40", icon: ShieldCheck };
      case "warehouse":
        return { label: "Warehouse Lead", bg: "bg-amber-900/60 text-amber-200 border-amber-500/40", icon: Warehouse };
      case "driver":
        return { label: "Fleet Driver", bg: "bg-emerald-900/60 text-emerald-200 border-emerald-500/40", icon: Truck };
      case "client_owner":
        return { label: "Client Owner", bg: "bg-blue-900/60 text-blue-200 border-blue-500/40", icon: Store };
      case "client_staff":
        return { label: "Client Staff", bg: "bg-cyan-900/60 text-cyan-200 border-cyan-500/40", icon: UserCheck };
      default:
        return { label: role, bg: "bg-slate-800 text-slate-300 border-slate-700", icon: UserCheck };
    }
  };

  const currentBadge = getRoleBadge(currentUser.role);
  const RoleIcon = currentBadge.icon;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      {/* Top Banner Notice if seeded */}
      {seedNotice && (
        <div className="bg-emerald-600/90 text-white text-xs py-1.5 px-4 text-center font-medium animate-pulse">
          {seedNotice}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  KargoHub
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  B2B Wholesale
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[200px] sm:max-w-none">
                {currentClient ? `${currentClient.companyName} (${currentClient.creditTerms.toUpperCase()})` : "Distributor Central Hub"}
              </p>
            </div>
          </div>

          {/* Navigation Tabs based on Role */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
            {/* Client Tabs */}
            {(currentUser.role === "client_owner" || currentUser.role === "client_staff") && (
              <>
                <button
                  onClick={() => setActiveTab("catalog")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "catalog"
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  Wholesale Catalog
                </button>
                <button
                  onClick={() => setActiveTab("my-orders")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "my-orders"
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
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
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "admin-orders"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  Fulfillment Hub
                </button>
                <button
                  onClick={() => setActiveTab("admin-inventory")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "admin-inventory"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  Catalog & Inventory
                </button>
                <button
                  onClick={() => setActiveTab("admin-pricing")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "admin-pricing"
                      ? "bg-purple-600 text-white shadow-sm shadow-purple-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
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
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === "warehouse"
                    ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                Pick & Pack Operations
              </button>
            )}

            {/* Driver Tab */}
            {currentUser.role === "driver" && (
              <button
                onClick={() => setActiveTab("driver")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === "driver"
                    ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                Route Delivery App
              </button>
            )}
          </nav>

          {/* Right Action Controls: Persona Switcher, Cart, Seed DB */}
          <div className="flex items-center gap-2.5">
            {/* Quick Demo Database Seeder */}
            <button
              onClick={handleSeed}
              disabled={seeding}
              title="Populate demo catalog, inventory and pricing tiers"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? "animate-spin text-blue-400" : "text-slate-400"}`} />
              <span className="hidden sm:inline">Reset / Seed Data</span>
            </button>

            {/* Persona Switcher Dropdown */}
            <div className="relative">
              <select
                aria-label="Switch Persona"
                value={currentUser.id}
                onChange={(e) => switchUser(e.target.value)}
                className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs text-slate-200 py-1.5 pl-3 pr-7 rounded-lg cursor-pointer font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.role.toUpperCase()}: {u.name.split(" ")[0]} ({u.role.replace("_", " ")})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            {/* Role Badge Indicator */}
            <div className={`hidden lg:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${currentBadge.bg}`}>
              <RoleIcon className="w-3.5 h-3.5" />
              <span>{currentBadge.label}</span>
            </div>

            {/* Cart Trigger (for client roles) */}
            {(currentUser.role === "client_owner" || currentUser.role === "client_staff") && (
              <button
                onClick={onOpenCart}
                className="relative flex items-center justify-center p-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 transition-all hover:scale-105"
                title="View Wholesale Cart"
              >
                <ShoppingCart className="w-4 h-4" />
                {totalItemsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-bounce">
                    {totalItemsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800 text-xs">
          {(currentUser.role === "client_owner" || currentUser.role === "client_staff") && (
            <>
              <button
                onClick={() => setActiveTab("catalog")}
                className={`py-1 px-3 rounded ${activeTab === "catalog" ? "text-blue-400 font-bold" : "text-slate-400"}`}
              >
                Catalog
              </button>
              <button
                onClick={() => setActiveTab("my-orders")}
                className={`py-1 px-3 rounded ${activeTab === "my-orders" ? "text-blue-400 font-bold" : "text-slate-400"}`}
              >
                Orders & Reorder
              </button>
            </>
          )}
          {currentUser.role === "admin" && (
            <>
              <button
                onClick={() => setActiveTab("admin-orders")}
                className={`py-1 px-3 rounded ${activeTab === "admin-orders" ? "text-purple-400 font-bold" : "text-slate-400"}`}
              >
                Fulfillment
              </button>
              <button
                onClick={() => setActiveTab("admin-inventory")}
                className={`py-1 px-3 rounded ${activeTab === "admin-inventory" ? "text-purple-400 font-bold" : "text-slate-400"}`}
              >
                Inventory
              </button>
              <button
                onClick={() => setActiveTab("admin-pricing")}
                className={`py-1 px-3 rounded ${activeTab === "admin-pricing" ? "text-purple-400 font-bold" : "text-slate-400"}`}
              >
                Tiers
              </button>
            </>
          )}
          {currentUser.role === "warehouse" && (
            <button
              onClick={() => setActiveTab("warehouse")}
              className="text-amber-400 font-bold py-1 px-3"
            >
              Picking & Packing
            </button>
          )}
          {currentUser.role === "driver" && (
            <button
              onClick={() => setActiveTab("driver")}
              className="text-emerald-400 font-bold py-1 px-3"
            >
              Driver Delivery
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
