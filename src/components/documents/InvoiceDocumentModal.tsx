"use client";

import React, { useRef } from "react";
import { Order, ClientAccount } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import {
  Printer,
  X,
  Package,
  Building,
  CheckCircle2,
  Calendar,
  CreditCard,
  Download,
  ShieldCheck
} from "lucide-react";

interface InvoiceDocumentModalProps {
  order: Order;
  client?: ClientAccount | null;
  docType: "SO" | "INV" | "DR";
  isOpen: boolean;
  onClose: () => void;
}

export default function InvoiceDocumentModal({
  order,
  client,
  docType,
  isOpen,
  onClose
}: InvoiceDocumentModalProps) {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const getDocTitle = () => {
    switch (docType) {
      case "SO":
        return { title: "SALES ORDER CONFIRMATION", docNum: order.orderNumber, badge: "Order Placed" };
      case "INV":
        return {
          title: "COMMERCIAL TAX INVOICE",
          docNum: order.invoiceNumber || order.orderNumber,
          badge: order.paymentStatus === "paid" ? "PAID IN FULL" : "PAYMENT DUE"
        };
      case "DR":
        return {
          title: "SIGNED DELIVERY RECEIPT",
          docNum: order.deliveryReceiptNumber || `DR-${order.orderNumber.replace("SO-", "")}`,
          badge: "DELIVERED & VERIFIED"
        };
    }
  };

  const docInfo = getDocTitle();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Container: Print style rules applied */}
      <div className="relative w-full max-w-3xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col print:m-0 print:w-full print:max-w-none print:shadow-none print:rounded-none">
        {/* Top Control Bar (Hidden during printing) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold font-mono tracking-wider">
              {docInfo.docNum}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-all hover:scale-105"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div ref={printAreaRef} className="p-8 sm:p-10 space-y-6 bg-white text-slate-900 print:p-6 font-sans">
          {/* Header Row: Company Info & Document Type */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                  KH
                </div>
                <span className="font-extrabold text-xl tracking-tight text-slate-950">
                  KargoHub Wholesale Ltd
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                National Distribution Center · Bay 12, Logistics City<br />
                Tax ID / VAT: <strong>US-88392019-B2B</strong> · orders@kargohub.com
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 block mb-0.5">
                Official Document
              </span>
              <h1 className="text-lg font-black tracking-tight text-slate-950">
                {docInfo.title}
              </h1>
              <div className="font-mono text-xs font-bold text-slate-700 mt-0.5">
                {docInfo.docNum}
              </div>
              <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {docInfo.badge}
              </span>
            </div>
          </div>

          {/* Metadata Row: Bill To & Order Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                Billed & Shipped To:
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                {order.clientCompanyName}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {client?.deliveryAddress || "4800 Industrial Blvd, Bay 4, Logistics City"}<br />
                Contact: {client?.contactPerson || order.placedByEmail}<br />
                Phone: {client?.phone || "+1 (555) 349-8812"}
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                <span className="text-slate-500">Document Date:</span>
                <span className="font-semibold text-slate-900">
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-900 uppercase">
                  {order.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-slate-200/60">
                <span className="text-slate-500">Requested Delivery:</span>
                <span className="font-semibold text-slate-900">
                  {order.requestedDeliveryDate || "Immediate Warehouse Dispatch"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500">Fulfillment Status:</span>
                <span className="font-bold text-blue-700 uppercase">
                  {order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-hidden border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-center">Unit / Pack</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item) => (
                    <tr key={item.id} className="text-slate-800">
                      <td className="py-3 px-3 font-mono font-bold text-slate-600 text-[11px]">
                        {item.skuSnapshot}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">
                        {item.nameSnapshot}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600 capitalize">
                        {item.unitSnapshot} ({item.packSizeSnapshot} pk)
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">
                        {formatCurrency(item.unitPriceSnapshotCents)}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(item.lineTotalCents)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Bulk wholesale order lines attached
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pt-2">
            {/* Payment & Bank Remittance Instructions */}
            <div className="text-xs text-slate-500 max-w-sm space-y-1">
              <span className="font-bold uppercase text-[10px] text-slate-700 block">
                Remittance & Banking Details:
              </span>
              <p className="text-[11px] leading-relaxed">
                Bank: <strong>KargoHub Treasury Chase Bank</strong><br />
                Routing Number: <strong>021000021</strong> · Account: <strong>8829-4100-3918</strong><br />
                Reference: <strong>{docInfo.docNum}</strong>
              </p>
            </div>

            {/* Total Math */}
            <div className="w-full sm:w-64 space-y-1.5 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(order.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Estimated Freight & Tax:</span>
                <span className="font-semibold">{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-950 pt-2 border-t border-slate-200">
                <span>Total Due:</span>
                <span className="text-blue-700">{formatCurrency(order.totalAmountCents)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Receipt Signature Section (For DR or Delivered status) */}
          {(docType === "DR" || order.status === "DELIVERED") && (
            <div className="mt-6 pt-4 border-t-2 border-dashed border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Received by Dock Manager:
                </span>
                <div className="h-16 border border-slate-200 rounded-lg p-2 bg-slate-50 flex items-center justify-center">
                  {order.driverSignatureUrl ? (
                    <img
                      src={order.driverSignatureUrl}
                      alt="Customer Signature"
                      className="h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      Physical signature captured on driver tablet
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Signee: Dock Supervisor</span>
                  <span>Timestamp: {new Date(order.updatedAt).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                  Delivered by Fleet Route Driver:
                </span>
                <div className="h-16 border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col justify-center text-xs">
                  <div className="font-bold text-slate-900">Alex Mercer (Fleet ID: DRV-08)</div>
                  <div className="text-[11px] text-slate-500">KargoHub Dedicated Logistics Fleet</div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 text-right">
                  Vehicle: Commercial Freight Truck #14
                </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-100">
            Thank you for your business. For wholesale support, contact orders@kargohub.com or call +1 (800) 555-KARGO.
          </div>
        </div>
      </div>
    </div>
  );
}
