"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { Order, UserProfile, DispatchAssignment } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import { transitionOrderStatus } from "@/lib/services/orderService";
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Send,
  Navigation,
  Check,
  Search,
  Building,
  Layers
} from "lucide-react";
import { getStoredOrders, getStoredUsers, getStoredDispatches, saveStoredDispatches } from "@/lib/services/storeSync";

export default function AdminDispatchManager() {
  const [orders, setOrders] = useState<Order[]>(() => getStoredOrders());
  const [users] = useState<UserProfile[]>(() => getStoredUsers());
  const [dispatches, setDispatches] = useState<DispatchAssignment[]>(() => getStoredDispatches());
  const [notice, setNotice] = useState<string | null>(null);

  // Per-order selected driver & truck mapping
  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});
  const [selectedTrucks, setSelectedTrucks] = useState<Record<string, string>>({});

  // 1. Live subscribe to orders
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "orders"), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
          setOrders(list);
        }
      }, () => setOrders(getStoredOrders()));
      return () => unsub();
    } catch {}
  }, []);

  // Filter available fleet drivers
  const fleetDrivers = users.filter(
    (u) => u.role === "driver" || (u.capabilities && u.capabilities.includes("driver"))
  );

  // Orders staged for dispatch: PACKED status
  const stagedOrders = orders.filter((o) => o.status === "PACKED");
  // Active in-transit orders: SHIPPED status
  const inTransitOrders = orders.filter((o) => o.status === "SHIPPED");

  const handleDispatchOrder = async (order: Order) => {
    const driverId = selectedDrivers[order.id] || fleetDrivers[0]?.id || "usr-driver-01";
    const driver = fleetDrivers.find((d) => d.id === driverId) || fleetDrivers[0];
    const truckId = selectedTrucks[order.id] || "Truck #14 (Heavy Freight)";

    const res = await transitionOrderStatus({
      orderId: order.id,
      toStatus: "SHIPPED",
      changedByUserId: "usr-dispatch-lead",
      changedByName: "Fleet Route Dispatcher",
      reason: `Assigned to ${driver ? driver.name : "Driver"} on ${truckId}`
    });

    if (res.success) {
      const assignment: DispatchAssignment = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientCompanyName: order.clientCompanyName,
        driverId: driver ? driver.id : "usr-driver-01",
        driverName: driver ? driver.name : "Alex Mercer",
        truckId,
        stopSequence: inTransitOrders.length + 1,
        dispatchedAt: new Date().toISOString()
      };

      const updatedDispatches = [assignment, ...dispatches.filter((d) => d.orderId !== order.id)];
      setDispatches(updatedDispatches);
      saveStoredDispatches(updatedDispatches);

      setNotice(`Order #${order.orderNumber} dispatched to ${driver ? driver.name : "Driver"} (${truckId})!`);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Fleet Route Dispatch & Driver Assignment</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage packed warehouse orders onto commercial delivery vehicles, sequence dock stops, and launch driver routes.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold">
            {stagedOrders.length} Staged on Dock
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-200 font-bold">
            {inTransitOrders.length} Out on Routes
          </span>
        </div>
      </div>

      {/* Staged Orders Ready for Vehicle Loading */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-600" />
          <span>Packed Orders Awaiting Vehicle Assignment ({stagedOrders.length})</span>
        </h3>

        {stagedOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-400 shadow-xs">
            No orders currently waiting in PACKED status. Orders packed by the warehouse will appear here automatically.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stagedOrders.map((order) => {
              const defaultDriver = fleetDrivers[0];

              return (
                <div
                  key={order.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          #{order.orderNumber}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          READY ON DOCK
                        </span>
                        {order.invoiceNumber && (
                          <span className="text-[10px] font-mono font-bold text-blue-600">
                            {order.invoiceNumber}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {order.clientCompanyName}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>4800 Industrial Blvd, Bay 4, Logistics City</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 block">
                        {formatCurrency(order.totalAmountCents)}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {order.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* Dispatch Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Assign Fleet Driver
                      </label>
                      <select
                        value={selectedDrivers[order.id] || defaultDriver?.id || ""}
                        onChange={(e) =>
                          setSelectedDrivers((p) => ({ ...p, [order.id]: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                      >
                        {fleetDrivers.map((drv) => (
                          <option key={drv.id} value={drv.id}>
                            {drv.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Vehicle / Truck #
                      </label>
                      <select
                        value={selectedTrucks[order.id] || "Truck #14"}
                        onChange={(e) =>
                          setSelectedTrucks((p) => ({ ...p, [order.id]: e.target.value }))
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                      >
                        <option value="Truck #14 (Heavy Freight)">Truck #14 (Heavy Freight)</option>
                        <option value="Van #02 (Fast Delivery)">Van #02 (Fast Delivery)</option>
                        <option value="Reefer Truck #06 (Cold Storage)">Reefer Truck #06 (Cold Storage)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDispatchOrder(order)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Dispatch to Delivery Driver</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Fleet Routes Out for Delivery */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Truck className="w-4 h-4 text-cyan-600" />
          <span>Active Fleet Deliveries Out on Routes ({inTransitOrders.length})</span>
        </h3>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Order / Invoice</th>
                  <th className="py-3.5 px-4">Wholesale Client</th>
                  <th className="py-3.5 px-4">Assigned Driver & Truck</th>
                  <th className="py-3.5 px-4">Stop Destination</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4 text-right">Route Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inTransitOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      No vehicles currently out on delivery routes.
                    </td>
                  </tr>
                ) : (
                  inTransitOrders.map((ord) => {
                    const disp = dispatches.find((d) => d.orderId === ord.id);

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-bold text-slate-900 block">
                            #{ord.orderNumber}
                          </span>
                          {ord.invoiceNumber && (
                            <span className="text-[10px] font-mono text-blue-600 font-bold">
                              {ord.invoiceNumber}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 text-xs block">
                            {ord.clientCompanyName}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatCurrency(ord.totalAmountCents)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                            <span className="font-semibold text-slate-800">
                              {disp ? disp.driverName : "Alex Mercer"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {disp ? disp.truckId : "Truck #14"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-xs">Bay 4, Logistics City</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {ord.paymentMethod}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1 font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full text-[10px]">
                            <Navigation className="w-3 h-3 text-cyan-600 animate-pulse" />
                            Out for Delivery
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
