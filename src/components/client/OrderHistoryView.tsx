"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc } from "firebase/firestore";
import { Order, OrderStatus } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/utils/currency";
import { transitionOrderStatus } from "@/lib/services/orderService";
import {
  FileText,
  Clock,
  CheckCircle2,
  Truck,
  Package,
  AlertCircle,
  XCircle,
  UploadCloud,
  FileCheck,
  Building,
  RotateCcw,
  ChevronRight,
  ShieldAlert,
  Download
} from "lucide-react";

import { getStoredOrders, saveStoredOrders } from "@/lib/services/storeSync";

export default function OrderHistoryView() {
  const { currentClient, currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>(() => {
    return getStoredOrders();
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(() => {
    return getStoredOrders()[0] || null;
  });
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!currentClient?.id) return;
    try {
      const q = query(
        collection(db, "orders"),
        where("clientAccountId", "==", currentClient.id)
      );
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setOrders(list);
          saveStoredOrders(list);
          if (list.length > 0 && !selectedOrder) {
            setSelectedOrder(list[0]);
          }
        }
      }, () => {
        // Fallback to local stored orders
        const local = getStoredOrders().filter((o) => o.clientAccountId === currentClient.id);
        setOrders(local);
        if (local.length > 0 && !selectedOrder) setSelectedOrder(local[0]);
      });
      return () => unsub();
    } catch {
      // offline fallback
    }
  }, [currentClient?.id]);

  // Client self-cancellation (permitted only while in PLACED state per Section 4 Rule 3)
  const handleClientCancel = async (order: Order) => {
    if (order.status !== "PLACED") {
      alert("Self-cancellation is only permitted while order is in PLACED status.");
      return;
    }
    const confirmed = confirm("Are you sure you want to cancel this order? Reserved stock will be released.");
    if (!confirmed) return;

    const res = await transitionOrderStatus({
      orderId: order.id,
      toStatus: "CANCELLED",
      changedByUserId: currentUser.id,
      changedByName: currentUser.email,
      reason: "Client self-cancelled from portal."
    });

    if (res.success) {
      setActionNotice(`Order #${order.orderNumber} successfully cancelled.`);
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Upload Bank Transfer Receipt simulation
  const handleUploadReceipt = async (orderId: string) => {
    if (!receiptUrl.trim()) return;
    setUploadingReceipt(true);

    const res = await transitionOrderStatus({
      orderId,
      toStatus: "PLACED",
      changedByUserId: currentUser.id,
      changedByName: currentUser.email,
      proofImageUrl: receiptUrl.trim(),
      reason: "Payment transfer receipt uploaded by client."
    });

    setUploadingReceipt(false);
    if (res.success) {
      setActionNotice("Receipt submitted! Admin will verify and confirm your order.");
      setReceiptUrl("");
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "PLACED":
        return "bg-amber-500/10 text-amber-300 border-amber-500/30";
      case "CONFIRMED":
        return "bg-blue-500/10 text-blue-300 border-blue-500/30";
      case "PICKING":
      case "PACKED":
        return "bg-purple-500/10 text-purple-300 border-purple-500/30";
      case "SHIPPED":
        return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
      case "DELIVERED":
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
      case "CANCELLED":
        return "bg-red-500/10 text-red-300 border-red-500/30";
      case "ON_HOLD":
        return "bg-orange-500/10 text-orange-300 border-orange-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const timelineSteps: { key: OrderStatus; label: string }[] = [
    { key: "PLACED", label: "Order Placed" },
    { key: "CONFIRMED", label: "Verified & Invoiced" },
    { key: "PICKING", label: "Warehouse Pick" },
    { key: "PACKED", label: "Packed" },
    { key: "SHIPPED", label: "In Transit" },
    { key: "DELIVERED", label: "Delivered & Signed" }
  ];

  return (
    <div className="space-y-6">
      {actionNotice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: Orders List */}
        <div className="w-full lg:w-1/3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">Wholesale Orders ({orders.length})</h3>
            <span className="text-[11px] text-slate-400">{currentClient?.companyName}</span>
          </div>

          {orders.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              No orders placed yet. Place your first wholesale order via the catalog.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
              {orders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-600/10 border-blue-500 shadow-md shadow-blue-500/10"
                        : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold font-mono text-white">
                        #{ord.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(
                          ord.status
                        )}`}
                      >
                        {ord.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{new Date(ord.createdAt).toLocaleDateString()}</span>
                      <span className="font-bold text-white">
                        {formatCurrency(ord.totalAmountCents)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                      <span className="uppercase font-medium">{ord.paymentMethod}</span>
                      {ord.invoiceNumber && (
                        <span className="text-blue-400 font-mono font-medium">
                          {ord.invoiceNumber}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Order Detail & Progression Timeline */}
        <div className="flex-1 w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          {selectedOrder ? (
            <>
              {/* Order Header Summary */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white font-mono">
                      Order #{selectedOrder.orderNumber}
                    </h2>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusColor(
                        selectedOrder.status
                      )}`}
                    >
                      {selectedOrder.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Placed on {new Date(selectedOrder.createdAt).toLocaleString()} · Placed by{" "}
                    {selectedOrder.placedByEmail}
                  </p>
                </div>

                {/* Self-Cancel Action (Only in PLACED status) */}
                {selectedOrder.status === "PLACED" && (
                  <button
                    onClick={() => handleClientCancel(selectedOrder)}
                    className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>Cancel Order</span>
                  </button>
                )}
              </div>

              {/* Sequential Document Registry Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Sales Order ID
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {selectedOrder.orderNumber}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Monotonic Invoice ID
                  </span>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {selectedOrder.invoiceNumber || "Minted upon confirmation"}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Delivery Receipt
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {selectedOrder.deliveryReceiptNumber || "Minted upon delivery"}
                  </span>
                </div>
              </div>

              {/* Visual State Progression Timeline */}
              <div className="py-4 px-2 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 px-2">
                  Order Progression Timeline
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {timelineSteps.map((step, idx) => {
                    const statusOrder: OrderStatus[] = [
                      "PLACED",
                      "CONFIRMED",
                      "PICKING",
                      "PACKED",
                      "SHIPPED",
                      "DELIVERED"
                    ];
                    const currentIndex = statusOrder.indexOf(selectedOrder.status);
                    const isDone = currentIndex >= idx && selectedOrder.status !== "CANCELLED";
                    const isCurrent = selectedOrder.status === step.key;

                    return (
                      <div
                        key={step.key}
                        className={`p-2.5 rounded-lg border text-center transition-all ${
                          isCurrent
                            ? "bg-blue-600/20 border-blue-500 text-white font-bold shadow-md shadow-blue-500/20"
                            : isDone
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                            : "bg-slate-900/40 border-slate-800 text-slate-600"
                        }`}
                      >
                        <div className="text-[10px] uppercase font-semibold mb-1">
                          Step {idx + 1}
                        </div>
                        <div className="text-xs truncate">{step.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bank Transfer Receipt Upload Widget (KargoHub.md Screen 6) */}
              {selectedOrder.paymentMethod === "transfer" && (
                <div className="p-5 bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-500/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-blue-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Bank Transfer Settlement & Receipt Verification
                      </h4>
                    </div>
                    {selectedOrder.paymentStatus === "verified" ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Verified by Admin
                      </span>
                    ) : selectedOrder.proofImageUrl ? (
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Awaiting Admin Approval
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Proof Required (48h Timer Active)
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300">
                    Bank: <strong>KargoHub Treasury Chase</strong> · Account: <strong>8829-4100-3918</strong> · Routing: <strong>021000021</strong>
                  </p>

                  {/* Upload input */}
                  {selectedOrder.paymentStatus !== "verified" && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Paste wire receipt image URL or transaction ref..."
                        value={receiptUrl}
                        onChange={(e) => setReceiptUrl(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => handleUploadReceipt(selectedOrder.id)}
                        disabled={uploadingReceipt || !receiptUrl.trim()}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
                      >
                        <UploadCloud className="w-4 h-4" />
                        <span>Submit Receipt</span>
                      </button>
                    </div>
                  )}

                  {selectedOrder.proofImageUrl && (
                    <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      <span>Receipt Attached: </span>
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
              )}

              {/* Driver Proof of Delivery (if Delivered) */}
              {selectedOrder.status === "DELIVERED" && selectedOrder.driverSignatureUrl && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Proof of Delivery & Digital Signature
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <img
                        src={selectedOrder.driverSignatureUrl}
                        alt="Customer Signature"
                        className="h-14 w-44 object-contain invert"
                      />
                    </div>
                    <div className="text-xs text-slate-300">
                      <div>Driver: Alex Mercer</div>
                      {typeof selectedOrder.codCollectedCents === "number" && (
                        <div>
                          COD Cash Collected: <strong>{formatCurrency(selectedOrder.codCollectedCents)}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-slate-500 text-xs">
              Select an order from the left column to view its timeline and documents.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
