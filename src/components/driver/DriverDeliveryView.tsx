"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Order } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency, parseDollarsToCents } from "@/lib/utils/currency";
import { transitionOrderStatus } from "@/lib/services/orderService";
import {
  Truck,
  MapPin,
  Phone,
  Banknote,
  PenTool,
  CheckCircle2,
  RotateCcw,
  Navigation,
  ShieldCheck,
  Building,
  Wifi,
  WifiOff,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import confetti from "canvas-confetti";

import { getStoredOrders, saveStoredOrders } from "@/lib/services/storeSync";
import {
  enqueueOfflineDelivery,
  getPendingDeliveries,
  syncPendingDeliveries
} from "@/lib/services/offlineSyncService";

export default function DriverDeliveryView() {
  const { currentUser } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const [orders, setOrders] = useState<Order[]>(() => {
    return getStoredOrders().filter((o) => o.status === "SHIPPED");
  });
  const [activeOrder, setActiveOrder] = useState<Order | null>(() => {
    const list = getStoredOrders().filter((o) => o.status === "SHIPPED");
    return list[0] || null;
  });
  const [codAmount, setCodAmount] = useState<string>(() => {
    const list = getStoredOrders().filter((o) => o.status === "SHIPPED");
    return list[0]?.paymentMethod === "cod" ? (list[0].totalAmountCents / 100).toFixed(2) : "";
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  // Canvas ref for digital signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      setPendingQueueCount(getPendingDeliveries().length);
    }

    const handleOnline = async () => {
      setIsOnline(true);
      const res = await syncPendingDeliveries();
      setPendingQueueCount(res.remainingCount);
      if (res.syncedCount > 0) {
        setNotice(`Auto-synced ${res.syncedCount} offline delivery record(s) to cloud!`);
        setTimeout(() => setNotice(null), 4000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingQueueCount(getPendingDeliveries().length);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    try {
      // Orders in transit for drivers (SHIPPED)
      const q = query(collection(db, "orders"), where("status", "==", "SHIPPED"));
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
          setOrders(list);

          if (list.length > 0 && !activeOrder) {
            setActiveOrder(list[0]);
            if (list[0].paymentMethod === "cod") {
              setCodAmount((list[0].totalAmountCents / 100).toFixed(2));
            }
          } else if (activeOrder) {
            const up = list.find((o) => o.id === activeOrder.id);
            if (up) setActiveOrder(up);
          }
        }
      }, () => {
        const local = getStoredOrders().filter((o) => o.status === "SHIPPED");
        setOrders(local);
        if (local.length > 0 && !activeOrder) {
          setActiveOrder(local[0]);
          if (local[0].paymentMethod === "cod") {
            setCodAmount((local[0].totalAmountCents / 100).toFixed(2));
          }
        }
      });

      return () => {
        unsub();
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    } catch {
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [activeOrder?.id]);

  const handleManualSyncNow = async () => {
    if (!isOnline) {
      alert("Device is currently offline. Connect to mobile data or Wi-Fi to sync.");
      return;
    }
    setIsManualSyncing(true);
    const res = await syncPendingDeliveries();
    setIsManualSyncing(false);
    setPendingQueueCount(res.remainingCount);
    setNotice(`Sync complete: ${res.syncedCount} deliveries synced to cloud.`);
    setTimeout(() => setNotice(null), 4000);
  };

  // Canvas drawing handlers (mouse + touch)
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#38bdf8"; // Light sky blue ink
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Complete Delivery Action (KargoHub.md Acceptance Criteria #5) with Offline Fallback
  const handleCompleteDelivery = async () => {
    if (!activeOrder) return;
    if (!hasSignature) {
      alert("Recipient signature is mandatory to confirm delivery.");
      return;
    }

    setCompleting(true);
    const canvas = canvasRef.current;
    const signatureDataUrl = canvas ? canvas.toDataURL("image/png") : undefined;

    const collectedCents =
      activeOrder.paymentMethod === "cod" ? parseDollarsToCents(codAmount) : undefined;

    const isDeviceOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    if (!isDeviceOnline) {
      // Offline fallback: Queue locally
      enqueueOfflineDelivery({
        orderId: activeOrder.id,
        orderNumber: activeOrder.orderNumber,
        deliveredAt: new Date().toISOString(),
        signatureUrl: signatureDataUrl || "",
        codCollectedCents: collectedCents,
        driverUserId: currentUser.id,
        driverName: currentUser.name
      });

      // Update local storage so driver view advances
      const stored = getStoredOrders().map((o) => {
        if (o.id === activeOrder.id) {
          return {
            ...o,
            status: "DELIVERED" as const,
            deliveryReceiptNumber: `DR-2026-${String(o.id).slice(-4)}`,
            driverSignatureUrl: signatureDataUrl,
            codCollectedCents: collectedCents,
            paymentStatus: collectedCents ? ("paid" as const) : o.paymentStatus
          };
        }
        return o;
      });
      saveStoredOrders(stored);

      setOrders((prev) => prev.filter((o) => o.id !== activeOrder.id));
      setActiveOrder(null);
      setPendingQueueCount(getPendingDeliveries().length);
      setCompleting(false);
      clearSignature();

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.5 } });
      setNotice(`Saved OFFLINE on device! Order #${activeOrder.orderNumber} signature cached. Will auto-sync when online.`);
      setTimeout(() => setNotice(null), 5000);
      return;
    }

    // Online execution
    const res = await transitionOrderStatus({
      orderId: activeOrder.id,
      toStatus: "DELIVERED",
      changedByUserId: currentUser.id,
      changedByName: currentUser.name,
      driverSignatureUrl: signatureDataUrl,
      codCollectedCents: collectedCents,
      reason: "Delivered to receiving dock. Customer signature collected."
    });

    setCompleting(false);
    if (res.success) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } });
      setNotice(`Order #${activeOrder.orderNumber} successfully marked as DELIVERED!`);
      clearSignature();
      setOrders((prev) => prev.filter((o) => o.id !== activeOrder.id));
      setActiveOrder(null);
      setTimeout(() => setNotice(null), 4000);
    } else {
      // If network failure during request, fallback to queue
      enqueueOfflineDelivery({
        orderId: activeOrder.id,
        orderNumber: activeOrder.orderNumber,
        deliveredAt: new Date().toISOString(),
        signatureUrl: signatureDataUrl || "",
        codCollectedCents: collectedCents,
        driverUserId: currentUser.id,
        driverName: currentUser.name
      });
      setPendingQueueCount(getPendingDeliveries().length);
      setNotice("Network glitch: delivery signature cached offline on device.");
      clearSignature();
      setOrders((prev) => prev.filter((o) => o.id !== activeOrder.id));
      setActiveOrder(null);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {notice && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-400" />
            <span>Driver Route Manifest</span>
          </h2>
          <p className="text-xs text-slate-400">
            Offline-resilient touch interface for dock receipt, COD collection, and digital signing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Online status indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              isOnline
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : "bg-amber-950/60 border-amber-500/40 text-amber-300 animate-pulse"
            }`}
          >
            {isOnline ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-amber-400" />
            )}
            <span>{isOnline ? "Online Sync Active" : "Offline Mode (Local Cache)"}</span>
          </div>

          {pendingQueueCount > 0 && (
            <button
              onClick={handleManualSyncNow}
              disabled={isManualSyncing || !isOnline}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors shadow"
              title="Sync pending deliveries to Cloud Firestore"
            >
              <RefreshCw className={`w-3 h-3 ${isManualSyncing ? "animate-spin" : ""}`} />
              <span>Sync ({pendingQueueCount})</span>
            </button>
          )}

          <div className="text-xs font-semibold px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {orders.length} Stops
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="py-20 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-semibold text-white">All Route Deliveries Completed!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No orders currently staged in SHIPPED status. As warehouse packs orders, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Deliveries Tab Selection */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Assigned Stops
            </h3>
            {orders.map((ord, idx) => {
              const isSelected = activeOrder?.id === ord.id;
              return (
                <div
                  key={ord.id}
                  onClick={() => {
                    setActiveOrder(ord);
                    if (ord.paymentMethod === "cod") {
                      setCodAmount((ord.totalAmountCents / 100).toFixed(2));
                    }
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-emerald-600/10 border-emerald-500 shadow-md shadow-emerald-500/10"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold font-mono text-white">
                      Stop #{idx + 1}: {ord.orderNumber}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {ord.paymentMethod}
                    </span>
                  </div>
                  <div className="text-xs text-slate-200 font-semibold truncate">
                    {ord.clientCompanyName}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Total: {formatCurrency(ord.totalAmountCents)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Stop Details & Signature Pad */}
          {activeOrder && (
            <div className="md:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
              {/* Stop Info */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">
                      {activeOrder.clientCompanyName}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>4800 Industrial Blvd, Bay 4, Logistics City</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>+1 (555) 349-8812 (Receiving Desk)</span>
                  </div>

                  {/* 1-Tap GPS Launch */}
                  <div className="mt-2.5">
                    <button
                      onClick={() => {
                        const destination = encodeURIComponent(
                          `${activeOrder.clientCompanyName}, 4800 Industrial Blvd, Bay 4, Logistics City`
                        );
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, "_blank");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors shadow-sm"
                    >
                      <Navigation className="w-3 h-3 text-emerald-400" />
                      <span>Launch GPS Directions</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400">Order Amount</span>
                  <div className="text-xl font-bold text-white font-mono">
                    {formatCurrency(activeOrder.totalAmountCents)}
                  </div>
                </div>
              </div>

              {/* COD Cash Collection Section if COD */}
              {activeOrder.paymentMethod === "cod" && (
                <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-emerald-400" />
                      <span>COD Cash Collection Required</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      Target: {formatCurrency(activeOrder.totalAmountCents)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Exact Cash Collected: $</span>
                    <input
                      type="number"
                      step="0.01"
                      value={codAmount}
                      onChange={(e) => setCodAmount(e.target.value)}
                      className="bg-slate-950 border border-emerald-500/40 text-xs text-white p-2 rounded-lg w-32 font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Digital Signature Pad (HTML5 Canvas) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-blue-400" />
                    <span>Receiver Digital Signature</span>
                  </label>
                  <button
                    onClick={clearSignature}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear Pad</span>
                  </button>
                </div>

                {/* Canvas */}
                <div className="border border-slate-700/80 rounded-xl bg-slate-950 overflow-hidden shadow-inner touch-none">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={160}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-40 cursor-crosshair"
                  />
                </div>
                <p className="text-[11px] text-slate-500 text-center italic">
                  Sign using your finger, stylus, or mouse above
                </p>
              </div>

              {/* Confirm & Complete Delivery Button */}
              <button
                onClick={handleCompleteDelivery}
                disabled={!hasSignature || completing}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              >
                {completing ? (
                  <span>Recording Delivery...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Delivery & Mint Receipt (DR-2026)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
