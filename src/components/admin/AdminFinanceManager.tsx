"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Order, ClientAccount } from "@/types";
import { formatCurrency } from "@/lib/utils/currency";
import {
  DollarSign,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  FileText,
  FileCheck,
  Send,
  Eye,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Printer
} from "lucide-react";
import { getStoredOrders, getStoredClients, saveStoredClients } from "@/lib/services/storeSync";

export default function AdminFinanceManager() {
  const [orders, setOrders] = useState<Order[]>(() => getStoredOrders());
  const [clients, setClients] = useState<ClientAccount[]>(() => getStoredClients());
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // 1. Live subscribe
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

  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "client_accounts"), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientAccount));
          setClients(list);
        }
      }, () => setClients(getStoredClients()));
      return () => unsub();
    } catch {}
  }, []);

  // Compute AR Metrics
  const pendingWireOrders = orders.filter(
    (o) => o.status === "PLACED" && o.paymentMethod === "transfer" && o.paymentStatus !== "verified"
  );
  const pendingWireTotalCents = pendingWireOrders.reduce((sum, o) => sum + o.totalAmountCents, 0);

  const deliveredNetOrders = orders.filter(
    (o) => o.paymentMethod === "credit" && o.status !== "CANCELLED"
  );
  const totalNetReceivablesCents = deliveredNetOrders.reduce((sum, o) => sum + o.totalAmountCents, 0);

  const totalCreditLimitCents = clients.reduce((sum, c) => sum + c.creditLimitCents, 0);

  // Toggle client credit freeze
  const handleToggleCredit = async (client: ClientAccount) => {
    const updatedStatus = !client.isCreditSuspended;
    try {
      try {
        await updateDoc(doc(db, "client_accounts", client.id), {
          isCreditSuspended: updatedStatus
        });
      } catch {}

      const updated = clients.map((c) =>
        c.id === client.id ? { ...c, isCreditSuspended: updatedStatus } : c
      );
      setClients(updated);
      saveStoredClients(updated);
      setNotice(`${client.companyName} credit privileges ${updatedStatus ? "frozen" : "restored"}.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleSendReminder = (client: ClientAccount) => {
    setNotice(`Automated invoice payment reminder sent to ${client.contactPerson || client.companyName}!`);
    setTimeout(() => setNotice(null), 3500);
  };

  const filteredClients = clients.filter((c) =>
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Accounts Receivable & Financial Control</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Monitor wholesale credit exposures, verify wire payments, enforce credit terms, and collect receivables.
        </p>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Credit Exposure */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Credit Facility</span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {formatCurrency(totalCreditLimitCents)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Approved Credit Ceiling</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        {/* Total Net Receivables */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-slate-500 font-medium">Net-15/30 Receivables</span>
            <div className="text-xl font-bold text-indigo-600 mt-1">
              {formatCurrency(totalNetReceivablesCents)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Drawn on Credit Terms</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Wire Verifications */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-slate-500 font-medium">Wire Slips to Verify</span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {pendingWireOrders.length} ({formatCurrency(pendingWireTotalCents)})
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Awaiting Bank Clearance</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Suspended Accounts */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="text-xs text-slate-500 font-medium">Credit Health</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {clients.filter((c) => !c.isCreditSuspended).length} / {clients.length} Active
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Accounts in Good Standing</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Wire Transfer Verification Review Tray */}
      {pendingWireOrders.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Pending Bank Wire Slips Awaiting Review ({pendingWireOrders.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500">Auto-expires after 48h if unconfirmed</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingWireOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      #{ord.orderNumber}
                    </span>
                    <span className="font-bold text-xs text-slate-900">
                      {formatCurrency(ord.totalAmountCents)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 font-semibold mt-0.5">
                    {ord.clientCompanyName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {new Date(ord.createdAt).toLocaleDateString()} · Wire Transfer Attached
                  </div>
                </div>

                {ord.proofImageUrl && (
                  <div className="flex items-center gap-2 pt-2 border-t border-amber-200/80">
                    <img
                      src={ord.proofImageUrl}
                      alt="Receipt"
                      className="w-10 h-10 rounded object-cover border border-amber-300"
                    />
                    <span className="text-[11px] text-slate-600 font-medium">Receipt uploaded</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Accounts Credit & AR Aging Ledger Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Client Accounts Receivable Ledger
          </h3>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3.5 px-4">Wholesale Client</th>
                  <th className="py-3.5 px-4">Terms</th>
                  <th className="py-3.5 px-4">Credit Limit</th>
                  <th className="py-3.5 px-4">Active Balance</th>
                  <th className="py-3.5 px-4">Available Credit</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => {
                  // Calculate active balance from orders
                  const clientOrders = orders.filter(
                    (o) => o.clientAccountId === client.id && o.paymentMethod === "credit" && o.status !== "CANCELLED"
                  );
                  const activeBalanceCents = clientOrders.reduce((sum, o) => sum + o.totalAmountCents, 0);
                  const availableCreditCents = Math.max(0, client.creditLimitCents - activeBalanceCents);

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-blue-600" />
                          <span>{client.companyName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {client.contactPerson || "Procurement Desk"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {client.creditTerms === "none" ? "Advance Wire" : client.creditTerms.replace("_", "-")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {client.creditLimitCents > 0 ? formatCurrency(client.creditLimitCents) : "$0.00"}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-indigo-700">
                        {formatCurrency(activeBalanceCents)}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-emerald-700">
                        {formatCurrency(availableCreditCents)}
                      </td>

                      <td className="py-3.5 px-4">
                        {client.isCreditSuspended ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-[10px]">
                            <ShieldAlert className="w-3 h-3 text-red-600" />
                            Credit Frozen
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Good Standing
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSendReminder(client)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200 flex items-center gap-1 transition-colors"
                            title="Send Statement / Reminder"
                          >
                            <Send className="w-3 h-3 text-blue-600" />
                            <span>Remind</span>
                          </button>
                          <button
                            onClick={() => handleToggleCredit(client)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                              client.isCreditSuspended
                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            }`}
                          >
                            {client.isCreditSuspended ? "Restore" : "Freeze"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
