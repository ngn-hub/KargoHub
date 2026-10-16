"use client";

import React, { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/utils/currency";
import { placeOrder } from "@/lib/services/orderService";
import { reserveStockAtomic } from "@/lib/services/inventoryService";
import { PaymentMethod } from "@/types";
import {
  X,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Building2,
  Banknote,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import confetti from "canvas-confetti";

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (orderId: string, orderNumber: string) => void;
}

export default function CartModal({ isOpen, onClose, onOrderSuccess }: CartModalProps) {
  const { items, updateQuantity, removeFromCart, clearCart, totalCents } = useCart();
  const { currentClient, currentUser } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Credit Limit Hard Blocking Check (KargoHub.md Section 4 & Acceptance Criteria #7)
  const creditLimitCents = currentClient?.creditLimitCents || 0;
  const isCreditOverLimit =
    paymentMethod === "credit" &&
    (currentClient?.isCreditSuspended || totalCents > creditLimitCents);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setErrorMessage(null);

    // Credit limit validation rule
    if (paymentMethod === "credit") {
      if (currentClient?.isCreditSuspended) {
        setErrorMessage("Credit purchasing has been suspended for this account. Please select Bank Transfer or COD.");
        return;
      }
      if (totalCents > creditLimitCents) {
        setErrorMessage(
          `Order total (${formatCurrency(totalCents)}) exceeds your available credit limit (${formatCurrency(
            creditLimitCents
          )}). Please pay existing invoices or choose another payment method.`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      // 1. Atomic Stock Reservation (Firestore Transaction)
      const reservations = items.map((it) => ({
        productId: it.product.id,
        warehouseId: "wh-central-01",
        quantity: it.quantity
      }));

      const reserveResult = await reserveStockAtomic(reservations);
      if (!reserveResult.success) {
        setErrorMessage(`Checkout Halted: ${reserveResult.message}`);
        setSubmitting(false);
        return;
      }

      // 2. Mint Sequential Order with immutable snapshots
      const orderPayload = {
        clientAccountId: currentClient?.id || "client-metro-supermarket",
        clientCompanyName: currentClient?.companyName || "Client Account",
        placedByUserId: currentUser.id,
        placedByEmail: currentUser.email,
        paymentMethod,
        notes,
        requestedDeliveryDate: deliveryDate,
        items: items.map((it) => ({
          productId: it.product.id,
          skuSnapshot: it.product.sku,
          nameSnapshot: it.product.name,
          unitSnapshot: it.product.unit,
          packSizeSnapshot: it.product.packSize,
          unitPriceSnapshotCents: it.resolvedPrice.unitPriceCents,
          quantity: it.quantity,
          lineTotalCents: it.resolvedPrice.unitPriceCents * it.quantity
        }))
      };

      const result = await placeOrder(orderPayload);

      if (result.success && result.orderId && result.orderNumber) {
        clearCart();
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.4 } });
        onOrderSuccess(result.orderId, result.orderNumber);
        onClose();
      } else {
        setErrorMessage(result.message || "Failed to finalize order.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during checkout.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl border border-blue-200">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Wholesale Checkout Cart</h2>
              <p className="text-xs text-slate-500">
                {items.length} unique line items · Minimum Order Quantity strictly validated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5 shadow-xs">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Line Items List */}
          {items.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Your cart is empty. Browse the wholesale catalog to add items.
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Order Line Items
              </h3>
              {items.map((it) => (
                <div
                  key={it.product.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl gap-3 shadow-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-600">{it.product.sku}</span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        (MOQ: {it.product.moq} {it.product.unit}s)
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 truncate">{it.product.name}</h4>
                    <p className="text-xs text-slate-600 font-medium">
                      {formatCurrency(it.resolvedPrice.unitPriceCents)} /{it.product.unit}
                    </p>
                  </div>

                  {/* Quantity Stepper with MOQ protection */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                      <button
                        onClick={() => updateQuantity(it.product.id, it.quantity - 1)}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                        title={it.quantity <= it.product.moq ? "Cannot reduce below MOQ" : "Decrease"}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-900">
                        {it.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(it.product.id, it.quantity + 1)}
                        className="p-1 text-slate-500 hover:text-slate-900"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="text-sm font-bold text-slate-900 w-20 text-right">
                      {formatCurrency(it.resolvedPrice.unitPriceCents * it.quantity)}
                    </span>

                    <button
                      onClick={() => removeFromCart(it.product.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Payment Terms & Settlement
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Bank Transfer */}
              <button
                type="button"
                onClick={() => setPaymentMethod("transfer")}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  paymentMethod === "transfer"
                    ? "bg-blue-50/80 border-blue-500 text-slate-900 ring-1 ring-blue-500 shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Bank Transfer</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">48h stock reservation hold</div>
                </div>
              </button>

              {/* Cash On Delivery (COD) */}
              <button
                type="button"
                onClick={() => setPaymentMethod("cod")}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  paymentMethod === "cod"
                    ? "bg-emerald-50/80 border-emerald-500 text-slate-900 ring-1 ring-emerald-500 shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Driver</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Cash On Delivery (COD)</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Exact cash collected at dock</div>
                </div>
              </button>

              {/* Credit Terms */}
              <button
                type="button"
                onClick={() => setPaymentMethod("credit")}
                className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  paymentMethod === "credit"
                    ? "bg-purple-50/80 border-purple-500 text-slate-900 ring-1 ring-purple-500 shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                    {currentClient?.creditTerms.toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Account Credit</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Limit: {formatCurrency(creditLimitCents)}
                  </div>
                </div>
              </button>
            </div>

            {/* Informative notice based on selected method */}
            {paymentMethod === "transfer" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-xs">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>48-Hour Reservation Invariant:</strong> Stock is reserved atomically upon placement. If payment receipt is not uploaded and verified by an admin within 48 hours, inventory is automatically returned to available stock.
                </span>
              </div>
            )}

            {paymentMethod === "credit" && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 shadow-xs ${
                  isCreditOverLimit
                    ? "bg-red-50 border border-red-200 text-red-900"
                    : "bg-purple-50 border border-purple-200 text-purple-900"
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-purple-600" />
                <div>
                  <strong>Credit Terms: {currentClient?.creditTerms.toUpperCase()}</strong> · Available Limit: {formatCurrency(creditLimitCents)}.
                  {isCreditOverLimit && (
                    <span className="block mt-1 font-bold text-red-700">
                      Warning: Order total ({formatCurrency(totalCents)}) exceeds available credit! Checkout will be blocked.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Delivery Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Requested Delivery Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs text-slate-900 p-2.5 rounded-xl focus:border-blue-500 focus:outline-none shadow-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Warehouse / Dock Notes
              </label>
              <input
                type="text"
                placeholder="Gate #, forklift dock instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 p-2.5 rounded-xl focus:border-blue-500 focus:outline-none shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Footer with Summary & Checkout Button */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Purchase Amount</span>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(totalCents)}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-300 bg-white hover:bg-slate-100 transition-all shadow-xs"
            >
              Continue Browsing
            </button>
            <button
              onClick={handleCheckout}
              disabled={items.length === 0 || submitting || isCreditOverLimit}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all hover:scale-105"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Reserving Stock...</span>
                </>
              ) : (
                <>
                  <span>Place Order (SO-2026)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
