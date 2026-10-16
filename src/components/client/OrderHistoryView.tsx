"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Order, OrderStatus } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/utils/currency";
import { transitionOrderStatus } from "@/lib/services/orderService";
import InvoiceDocumentModal from "@/components/documents/InvoiceDocumentModal";
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
  Printer,
  Image,
  Eye,
  Trash2
} from "lucide-react";
import { getStoredOrders, saveStoredOrders } from "@/lib/services/storeSync";
import { compressPaymentSlip } from "@/lib/utils/imageCompressor";

export default function OrderHistoryView() {
  const { currentClient, currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>(() => {
    return getStoredOrders();
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(() => {
    return getStoredOrders()[0] || null;
  });

  // State for Document Modal
  const [activeDocType, setActiveDocType] = useState<"SO" | "INV" | "DR" | null>(null);

  // File upload state & bank reference
  const [receiptImageFile, setReceiptImageFile] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [bankRefInput, setBankRefInput] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [previewZoomImage, setPreviewZoomImage] = useState<string | null>(null);

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
        const local = getStoredOrders().filter((o) => o.clientAccountId === currentClient.id);
        setOrders(local);
        if (local.length > 0 && !selectedOrder) setSelectedOrder(local[0]);
      });
      return () => unsub();
    } catch {
      // offline fallback
    }
  }, [currentClient?.id]);

  // Client self-cancellation
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

  // Handle local file selection for payment proof with canvas compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressed = await compressPaymentSlip(file);
      setReceiptImageFile(compressed);
    } catch (err) {
      console.error("Failed to compress image", err);
    } finally {
      setIsCompressing(false);
    }
  };

  // Submit proof of payment
  const handleSubmitProof = async (orderId: string) => {
    if (!receiptImageFile) return;
    setUploadingReceipt(true);

    const refText = bankRefInput.trim();
    const reasonText = refText
      ? `Wire transfer receipt uploaded. Bank Ref: ${refText}`
      : "Wire transfer payment receipt uploaded by client.";

    const res = await transitionOrderStatus({
      orderId,
      toStatus: "PLACED",
      changedByUserId: currentUser.id,
      changedByName: currentUser.email,
      proofImageUrl: receiptImageFile,
      reason: reasonText
    });

    setUploadingReceipt(false);
    if (res.success) {
      setActionNotice("Receipt submitted! Admin will verify and confirm your order.");
      setReceiptImageFile(null);
      setBankRefInput("");
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

                {/* Top Action Buttons: Print Documents & Self-Cancel */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveDocType("SO")}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                    <span>Print Order</span>
                  </button>

                  {selectedOrder.status === "PLACED" && (
                    <button
                      onClick={() => handleClientCancel(selectedOrder)}
                      className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sequential Document Registry Badges (Click to Print/Download) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Sales Order Button */}
                <div
                  onClick={() => setActiveDocType("SO")}
                  className="p-3.5 bg-slate-950/60 border border-slate-800 hover:border-blue-500/60 rounded-xl cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Sales Order ID
                    </span>
                    <Printer className="w-3 h-3 text-slate-500 group-hover:text-blue-400" />
                  </div>
                  <span className="text-xs font-mono font-bold text-white group-hover:text-blue-300">
                    {selectedOrder.orderNumber}
                  </span>
                  <div className="text-[10px] text-blue-400 mt-1">Click to Print / Save PDF</div>
                </div>

                {/* Tax Invoice Button */}
                <div
                  onClick={() => {
                    if (selectedOrder.invoiceNumber || selectedOrder.status !== "PLACED") {
                      setActiveDocType("INV");
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all ${
                    selectedOrder.invoiceNumber || selectedOrder.status !== "PLACED"
                      ? "bg-slate-950/60 border-slate-800 hover:border-blue-500/60 cursor-pointer group"
                      : "bg-slate-950/30 border-slate-800/40 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Commercial Tax Invoice
                    </span>
                    <Printer className="w-3 h-3 text-slate-500 group-hover:text-blue-400" />
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {selectedOrder.invoiceNumber || "Minted upon confirmation"}
                  </span>
                  <div className="text-[10px] text-blue-400 mt-1">
                    {selectedOrder.invoiceNumber ? "Click to Print / Save PDF" : "Pending Verification"}
                  </div>
                </div>

                {/* Delivery Receipt Button */}
                <div
                  onClick={() => {
                    if (selectedOrder.status === "DELIVERED") {
                      setActiveDocType("DR");
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all ${
                    selectedOrder.status === "DELIVERED"
                      ? "bg-slate-950/60 border-slate-800 hover:border-emerald-500/60 cursor-pointer group"
                      : "bg-slate-950/30 border-slate-800/40 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Signed Delivery Receipt
                    </span>
                    <Printer className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {selectedOrder.deliveryReceiptNumber || "Minted upon delivery"}
                  </span>
                  <div className="text-[10px] text-emerald-400 mt-1">
                    {selectedOrder.status === "DELIVERED" ? "Click to View Signed POD" : "Awaiting Fleet Delivery"}
                  </div>
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

              {/* Enhanced Bank Transfer Receipt Upload & Proof Management (Section 6.1 Screen 6) */}
              {selectedOrder.paymentMethod === "transfer" && (
                <div className="p-5 bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-500/30 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-blue-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Bank Transfer Proof & Verification
                      </h4>
                    </div>
                    {selectedOrder.paymentStatus === "verified" ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Verified by Accounting
                      </span>
                    ) : selectedOrder.proofImageUrl ? (
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Awaiting Admin Approval
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Proof Required (48h Reservation Hold)
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300">
                    Bank: <strong>KargoHub Treasury Chase</strong> · Account: <strong>8829-4100-3918</strong> · Routing: <strong>021000021</strong>
                  </p>

                  {/* Existing Uploaded Proof Preview */}
                  {selectedOrder.proofImageUrl && (
                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => setPreviewZoomImage(selectedOrder.proofImageUrl!)}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer shrink-0 hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={selectedOrder.proofImageUrl}
                            alt="Payment Proof"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1">
                            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Payment Slip Uploaded</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Click thumbnail to inspect full resolution.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setPreviewZoomImage(selectedOrder.proofImageUrl!)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  )}

                  {/* Drag-and-Drop / File Input Widget if not verified */}
                  {selectedOrder.paymentStatus !== "verified" && (
                    <div className="space-y-3 pt-1">
                      <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-5 text-center bg-slate-950/40 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          disabled={isCompressing || uploadingReceipt}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <UploadCloud className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                        <div className="text-xs font-bold text-white">
                          {isCompressing
                            ? "Optimizing and compressing receipt..."
                            : "Click or drag wire transfer screenshot / slip here"}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Supports PNG, JPEG, WebP (Camera photos or banking app screenshots)
                        </p>
                      </div>

                      {/* Staged file preview & Bank Reference input */}
                      {receiptImageFile && (
                        <div className="p-3.5 bg-slate-950/90 border border-blue-500/40 rounded-xl space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={receiptImageFile}
                                alt="Staged Preview"
                                className="w-12 h-12 rounded object-cover border border-slate-700 shadow"
                              />
                              <div className="text-xs">
                                <span className="font-semibold text-white block">Slip Ready</span>
                                <span className="text-[10px] text-emerald-400">Compressed & ready for accounting</span>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setReceiptImageFile(null);
                                setBankRefInput("");
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                              title="Discard"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Reference input */}
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <input
                              type="text"
                              value={bankRefInput}
                              onChange={(e) => setBankRefInput(e.target.value)}
                              placeholder="Transaction Ref / Check # (e.g. TRX-9042)"
                              className="w-full sm:flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={() => handleSubmitProof(selectedOrder.id)}
                              disabled={uploadingReceipt || isCompressing}
                              className="w-full sm:w-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                            >
                              {uploadingReceipt ? "Submitting..." : "Confirm & Send Proof"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Driver Proof of Delivery (if Delivered) */}
              {selectedOrder.status === "DELIVERED" && selectedOrder.driverSignatureUrl && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Proof of Delivery & Digital Signature
                    </h4>
                    <button
                      onClick={() => setActiveDocType("DR")}
                      className="text-xs text-emerald-400 underline font-semibold flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Signed POD</span>
                    </button>
                  </div>
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

      {/* Printable PDF Document Modal */}
      {selectedOrder && activeDocType && (
        <InvoiceDocumentModal
          order={selectedOrder}
          client={currentClient}
          docType={activeDocType}
          isOpen={!!activeDocType}
          onClose={() => setActiveDocType(null)}
        />
      )}

      {/* Full-screen Receipt Zoom Modal */}
      {previewZoomImage && (
        <div
          onClick={() => setPreviewZoomImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer animate-fade-in"
        >
          <div className="relative max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-hidden">
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800 text-xs text-white font-bold">
              <span>Payment Proof High-Res Zoom</span>
              <span className="text-slate-400 font-normal">Click anywhere to close</span>
            </div>
            <img
              src={previewZoomImage}
              alt="Zoomed Payment Slip"
              className="max-h-[75vh] w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
