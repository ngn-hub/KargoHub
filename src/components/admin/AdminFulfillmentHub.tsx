"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, orderBy, doc, getDocs, where } from "firebase/firestore";
import { Order, OrderStatus, OrderStatusHistory } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/utils/currency";
import { transitionOrderStatus } from "@/lib/services/orderService";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Truck,
  Package,
  XCircle,
  Eye,
  Filter,
  DollarSign,
  History,
  TrendingUp,
  Building,
  Check,
  Ban
} from "lucide-react";

import { getStoredOrders, saveStoredOrders } from "@/lib/services/storeSync";

export default function AdminFulfillmentHub() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>(() => getStoredOrders());
  const [filterTab, setFilterTab] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(() => getStoredOrders()[1] || null);
  const [auditLogs, setAuditLogs] = useState<OrderStatusHistory[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  // 1. Live subscribe to all orders
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "orders"), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(list);
          saveStoredOrders(list);

          if (selectedOrder) {
            const updated = list.find((o) => o.id === selectedOrder.id);
            if (updated) setSelectedOrder(updated);
          }
        }
      }, () => {
        const local = getStoredOrders();
        setOrders(local);
        if (local.length > 0 && !selectedOrder) setSelectedOrder(local[0]);
      });
      return () => unsub();
    } catch {
      // offline fallback
    }
  }, [selectedOrder?.id]);

  // 2. Load audit history for selected order
  useEffect(() => {
    if (!selectedOrder?.id) return;
    const q = query(
      collection(db, "order_status_history"),
      where("orderId", "==", selectedOrder.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderStatusHistory));
      logs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setAuditLogs(logs);
    });
    return () => unsub();
  }, [selectedOrder?.id]);

  // Admin Verification & Transition handler
  const handleVerifyAndConfirm = async (order: Order) => {
    const res = await transitionOrderStatus({
      orderId: order.id,
      toStatus: "CONFIRMED",
      changedByUserId: currentUser.id,
      changedByName: currentUser.name,
      reason: "Admin verified wire payment receipt. Invoice minted."
    });

    if (res.success) {
      setActionNotice(`Order #${order.orderNumber} confirmed! Minted ${res.invoiceNumber}.`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleAdvanceStatus = async (order: Order, nextStatus: OrderStatus) => {
    const res = await transitionOrderStatus({
      orderId: order.id,
      toStatus: nextStatus,
      changedByUserId: currentUser.id,
      changedByName: currentUser.name,
      reason: `Admin moved order to ${nextStatus}`
    });

    if (res.success) {
      setActionNotice(`Order status advanced to ${nextStatus}.`);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const handleAdminCancel = async () => {
    if (!selectedOrder || !cancelReason.trim()) return;

    const res = await transitionOrderStatus({
      orderId: selectedOrder.id,
      toStatus: "CANCELLED",
      changedByUserId: currentUser.id,
      changedByName: currentUser.name,
      reason: `Admin Cancellation: ${cancelReason.trim()}`
    });

    setShowCancelModal(false);
    setCancelReason("");
    if (res.success) {
      setActionNotice(`Order #${selectedOrder.orderNumber} cancelled and stock released.`);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Executive Metrics
  const totalVolumeCents = orders.reduce((sum, o) => sum + o.totalAmountCents, 0);
  const pendingReceiptsCount = orders.filter(
    (o) => o.status === "PLACED" && o.paymentMethod === "transfer" && o.paymentStatus !== "verified"
  ).length;
  const activePickingCount = orders.filter(
    (o) => o.status === "CONFIRMED" || o.status === "PICKING" || o.status === "PACKED"
  ).length;
  const inTransitCount = orders.filter((o) => o.status === "SHIPPED").length;

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (filterTab === "pending_verification") {
      return o.status === "PLACED" && o.paymentStatus !== "verified";
    }
    if (filterTab === "active_fulfillment") {
      return o.status === "CONFIRMED" || o.status === "PICKING" || o.status === "PACKED";
    }
    if (filterTab === "in_transit") {
      return o.status === "SHIPPED";
    }
    if (filterTab === "delivered") {
      return o.status === "DELIVERED" || o.status === "COMPLETED";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {actionNotice && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* EXECUTIVE KPI METRIC CARDS (KargoHub.md Section 6.2 Screen 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Total Order Volume</span>
            <div className="text-xl font-bold text-white mt-1">
              {formatCurrency(totalVolumeCents)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">{orders.length} lifetime orders</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Receipts to Verify</span>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {pendingReceiptsCount}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Unconfirmed Bank Transfers</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Warehouse Fulfillment</span>
            <div className="text-xl font-bold text-purple-400 mt-1">
              {activePickingCount}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Picking & Packing Active</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">In-Transit Fleet</span>
            <div className="text-xl font-bold text-cyan-400 mt-1">
              {inTransitCount}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Out for Driver Delivery</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: "all", label: `All Orders (${orders.length})` },
          { key: "pending_verification", label: `Pending Verification (${pendingReceiptsCount})` },
          { key: "active_fulfillment", label: `Warehouse Queue (${activePickingCount})` },
          { key: "in_transit", label: `In Transit (${inTransitCount})` },
          { key: "delivered", label: "Completed Deliveries" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
              filterTab === tab.key
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Fulfillment Grid: Order Master List & Detail Panel */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: Master Orders Table */}
        <div className="w-full lg:w-3/5 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Orders Queue ({filteredOrders.length})
            </h3>
            <span className="text-xs text-slate-400">Click row to inspect audit trail</span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-[70vh] overflow-y-auto">
            {filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No orders match this filter.
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`p-4 cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                      isSelected ? "bg-purple-950/30 border-l-4 border-purple-500" : "hover:bg-slate-850"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-white">
                          #{ord.orderNumber}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {ord.paymentMethod}
                        </span>
                        {ord.invoiceNumber && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            {ord.invoiceNumber}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-slate-200 truncate">
                        {ord.clientCompanyName}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {new Date(ord.createdAt).toLocaleDateString()} · {formatCurrency(ord.totalAmountCents)}
                      </p>
                    </div>

                    {/* Status & Quick Action */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          ord.status === "CONFIRMED"
                            ? "bg-blue-900/60 text-blue-200 border-blue-500/40"
                            : ord.status === "DELIVERED"
                            ? "bg-emerald-900/60 text-emerald-200 border-emerald-500/40"
                            : ord.status === "CANCELLED"
                            ? "bg-red-900/60 text-red-200 border-red-500/40"
                            : "bg-amber-900/60 text-amber-200 border-amber-500/40"
                        }`}
                      >
                        {ord.status}
                      </span>

                      {/* Quick Verify Button on row */}
                      {ord.status === "PLACED" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerifyAndConfirm(ord);
                          }}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold rounded-lg shadow-sm flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Confirm</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Order Detail, Verification & Audit History */}
        <div className="flex-1 w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-5">
          {selectedOrder ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white font-mono">
                    Order #{selectedOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Client: <strong>{selectedOrder.clientCompanyName}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedOrder.status !== "CANCELLED" && selectedOrder.status !== "DELIVERED" && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Admin Cancel</span>
                    </button>
                  )}
                </div>
              </div>

              {/* State Transition Actions */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Fulfillment Actions
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === "PLACED" && (
                    <button
                      onClick={() => handleVerifyAndConfirm(selectedOrder)}
                      className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify Receipt & Mint Invoice (INV)</span>
                    </button>
                  )}

                  {selectedOrder.status === "CONFIRMED" && (
                    <button
                      onClick={() => handleAdvanceStatus(selectedOrder, "PICKING")}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                    >
                      <Package className="w-4 h-4" />
                      <span>Dispatch to Warehouse Picking</span>
                    </button>
                  )}

                  {selectedOrder.status === "PICKING" && (
                    <button
                      onClick={() => handleAdvanceStatus(selectedOrder, "PACKED")}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Package className="w-4 h-4" />
                      <span>Mark All Lines Packed</span>
                    </button>
                  )}

                  {selectedOrder.status === "PACKED" && (
                    <button
                      onClick={() => handleAdvanceStatus(selectedOrder, "SHIPPED")}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <Truck className="w-4 h-4" />
                      <span>Dispatch to Delivery Driver</span>
                    </button>
                  )}
                </div>

                {/* Bank transfer receipt inspect if submitted */}
                {selectedOrder.proofImageUrl && (
                  <div className="pt-2 text-xs text-slate-300 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span>Client Uploaded Receipt:</span>
                    <a
                      href={selectedOrder.proofImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 underline font-mono truncate max-w-xs"
                    >
                      {selectedOrder.proofImageUrl}
                    </a>
                  </div>
                )}
              </div>

              {/* Immutable Audit Log Trail (KargoHub.md Rule 4 & Section 5) */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <History className="w-4 h-4 text-purple-400" />
                  <span>Immutable Audit Trail ({auditLogs.length} Events)</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {auditLogs.length === 0 ? (
                    <div className="text-slate-500 text-xs py-2">No audit logs recorded yet.</div>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-slate-900/80 border border-slate-800/80 rounded-lg text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                          <span className="font-semibold text-slate-200">
                            {log.changedByName || "System"}
                          </span>
                          <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-white font-medium">
                          Status &rarr; <span className="font-bold text-blue-300">{log.toStatus}</span>
                        </div>
                        {log.reason && (
                          <div className="text-[11px] text-slate-400 mt-0.5 italic">
                            &quot;{log.reason}&quot;
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-slate-500 text-xs">
              Select an order from the master list to process fulfillment and view audit logs.
            </div>
          )}
        </div>
      </div>

      {/* Admin Cancellation Reason Modal */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Cancel Order #{selectedOrder.orderNumber}</span>
            </h3>
            <p className="text-xs text-slate-300">
              Per KargoHub Section 4 Rule 3, Admin cancellations require a mandatory logged justification. Reserved inventory will be atomically released.
            </p>
            <textarea
              placeholder="Enter mandatory reason for cancellation (e.g. client requested, credit check failure)..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
              <button
                onClick={handleAdminCancel}
                disabled={!cancelReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
