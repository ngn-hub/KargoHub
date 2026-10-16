"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Order, OrderStatus } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { transitionOrderStatus } from "@/lib/services/orderService";
import {
  ClipboardList,
  CheckCircle2,
  Package,
  Truck,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckSquare,
  Square
} from "lucide-react";

import { getStoredOrders, saveStoredOrders } from "@/lib/services/storeSync";

export default function WarehouseView() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>(() => {
    return getStoredOrders().filter((o) => ["CONFIRMED", "PICKING", "PACKED", "PLACED"].includes(o.status));
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(() => {
    const list = getStoredOrders().filter((o) => ["CONFIRMED", "PICKING", "PACKED", "PLACED"].includes(o.status));
    return list[0] || null;
  });
  const [pickedItems, setPickedItems] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = query(
        collection(db, "orders"),
        where("status", "in", ["CONFIRMED", "PICKING", "PACKED"])
      );
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
          list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(list);

          if (list.length > 0 && !selectedOrder) {
            setSelectedOrder(list[0]);
          } else if (selectedOrder) {
            const up = list.find((o) => o.id === selectedOrder.id);
            if (up) setSelectedOrder(up);
          }
        }
      }, () => {
        const local = getStoredOrders().filter((o) => ["CONFIRMED", "PICKING", "PACKED", "PLACED"].includes(o.status));
        setOrders(local);
        if (local.length > 0 && !selectedOrder) setSelectedOrder(local[0]);
      });
      return () => unsub();
    } catch {
      // offline fallback
    }
  }, [selectedOrder?.id]);

  const togglePickItem = (key: string) => {
    setPickedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStartPicking = async (order: Order) => {
    const res = await transitionOrderStatus({
      orderId: order.id,
      toStatus: "PICKING",
      changedByUserId: currentUser.id,
      changedByName: currentUser.name,
      reason: "Warehouse initiated physical picking."
    });
    if (res.success) {
      setNotice(`Started picking order #${order.orderNumber}.`);
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const handleMarkPacked = async (order: Order) => {
    const res = await transitionOrderStatus({
      orderId: order.id,
      toStatus: "PACKED",
      changedByUserId: currentUser.id,
      changedByName: currentUser.name,
      reason: "All line items picked, verified, and packed into pallets."
    });
    if (res.success) {
      setNotice(`Order #${order.orderNumber} packed and staged for dispatch.`);
      setTimeout(() => setNotice(null), 3000);
    }
  };

  const handleDispatchToDriver = async (order: Order) => {
    const res = await transitionOrderStatus({
      orderId: order.id,
      toStatus: "SHIPPED",
      changedByUserId: currentUser.id,
      changedByName: currentUser.name,
      reason: "Loaded onto delivery truck. Dispatched to fleet driver."
    });
    if (res.success) {
      setNotice(`Order #${order.orderNumber} handed over to driver.`);
      setTimeout(() => setNotice(null), 3000);
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
          <h2 className="text-lg font-bold text-slate-900">Warehouse Pick & Pack Fulfillment</h2>
          <p className="text-xs text-slate-500">
            Fulfill confirmed orders, record item checklists, and stage pallets for driver dispatch.
          </p>
        </div>
        <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
          Queue: {orders.length} Active Orders
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: Orders Queue */}
        <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-200">
            Fulfillment Queue
          </h3>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No orders waiting in warehouse queue.
            </div>
          ) : (
            <div className="space-y-2.5">
              {orders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-amber-50/70 border-amber-500 shadow-sm shadow-amber-500/10"
                        : "bg-slate-50/60 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        #{ord.orderNumber}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {ord.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 font-medium truncate">
                      {ord.clientCompanyName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>Delivery: {ord.requestedDeliveryDate || "Standard"}</span>
                      <span className="font-mono text-blue-600 font-semibold">{ord.invoiceNumber}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Picking Checklist & Dispatch Controls */}
        <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
          {selectedOrder ? (
            <>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    Picking List for Order #{selectedOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Client: <strong className="text-slate-800">{selectedOrder.clientCompanyName}</strong> · Location: Central Warehouse (Bay 4)
                  </p>
                </div>

                {/* Stage progression action */}
                <div>
                  {selectedOrder.status === "CONFIRMED" && (
                    <button
                      onClick={() => handleStartPicking(selectedOrder)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-amber-600/20 transition-all"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>Start Physical Picking</span>
                    </button>
                  )}

                  {selectedOrder.status === "PICKING" && (
                    <button
                      onClick={() => handleMarkPacked(selectedOrder)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-purple-600/20 transition-all"
                    >
                      <Package className="w-4 h-4" />
                      <span>Complete & Mark Packed</span>
                    </button>
                  )}

                  {selectedOrder.status === "PACKED" && (
                    <button
                      onClick={() => handleDispatchToDriver(selectedOrder)}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-cyan-600/20 transition-all"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Hand Off to Driver</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Picking Line Items Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Physical Bin & Shelf Checklist
                </h4>

                <div className="space-y-2">
                  {/* Default demo lines or order items */}
                  {[
                    { sku: "BEV-COF-001", name: "Artisan Colombian Supremo Whole Bean Coffee", loc: "Aisle 3 - Shelf B2", qty: "4 cases" },
                    { sku: "BEV-MILK-002", name: "Barista Edition Organic Oat Milk (1L)", loc: "Aisle 1 - Bay Cool-1", qty: "6 cases" },
                    { sku: "DRY-OIL-003", name: "Cold-Pressed Extra Virgin Olive Oil (5L Tin)", loc: "Aisle 4 - Shelf C1", qty: "2 cases" }
                  ].map((item, idx) => {
                    const isPicked = pickedItems[item.sku];
                    return (
                      <div
                        key={item.sku}
                        onClick={() => togglePickItem(item.sku)}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isPicked
                            ? "bg-emerald-50/80 border-emerald-300 text-emerald-900"
                            : "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isPicked ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-blue-600">{item.sku}</span>
                              <span className="text-[11px] text-amber-800 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                {item.loc}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-slate-900 mt-0.5">{item.name}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 block">{item.qty}</span>
                          <span className="text-[10px] text-slate-500">
                            {isPicked ? "Picked & Verified" : "Pending Pick"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Warehouse Staging Notes */}
              {selectedOrder.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                  <span className="font-bold text-slate-900 block mb-0.5">Client Shipping Instructions:</span>
                  {selectedOrder.notes}
                </div>
              )}
            </>
          ) : (
            <div className="py-24 text-center text-slate-400 text-xs">
              Select an order from the queue to start picking.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
