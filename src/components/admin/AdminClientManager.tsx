"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { ClientAccount, CreditTerms, PriceList } from "@/types";
import { formatCurrency, parseDollarsToCents } from "@/lib/utils/currency";
import {
  Users,
  Building,
  Mail,
  Phone,
  MapPin,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Send,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Tag,
  Search,
  ExternalLink,
  X
} from "lucide-react";
import { DEMO_CLIENTS, DEMO_PRICE_LISTS } from "@/lib/services/seedService";
import { getStoredClients, saveStoredClients } from "@/lib/services/storeSync";

export default function AdminClientManager() {
  const [clients, setClients] = useState<ClientAccount[]>(() => getStoredClients());
  const [priceLists] = useState<PriceList[]>(DEMO_PRICE_LISTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Invite Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [priceTierId, setPriceTierId] = useState<string>("tier-supermarket-prime");
  const [creditTerms, setCreditTerms] = useState<CreditTerms>("net_30");
  const [creditLimitDollars, setCreditLimitDollars] = useState("10000");

  // Post-Invite Link Display State
  const [invitedLinkData, setInvitedLinkData] = useState<{ company: string; link: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // 1. Subscribe to client accounts
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "client_accounts"), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientAccount));
          setClients(list);
          saveStoredClients(list);
        }
      }, () => {
        setClients(getStoredClients());
      });
      return () => unsub();
    } catch {}
  }, []);

  // Handle Send Invite
  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim() || !contactPerson.trim() || !email.trim()) {
      alert("Please enter company name, contact person, and email.");
      return;
    }

    const clientId = `client-${companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
    const inviteCode = `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const limitCents = parseDollarsToCents(creditLimitDollars);

    const newClient: ClientAccount = {
      id: clientId,
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      deliveryAddress: deliveryAddress.trim() || "Commercial Delivery Bay",
      priceTierId,
      creditTerms,
      creditLimitCents: limitCents,
      isCreditSuspended: false,
      createdAt: new Date().toISOString()
    };

    try {
      try {
        await setDoc(doc(db, "client_accounts", clientId), newClient);
      } catch (err) {
        console.warn("Firestore offline client write:", err);
      }

      const updated = [newClient, ...clients.filter((c) => c.id !== clientId)];
      setClients(updated);
      saveStoredClients(updated);

      const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://kargo-hub.vercel.app"}/?invite=${inviteCode}&acc=${clientId}`;
      setInvitedLinkData({
        company: newClient.companyName,
        link: inviteUrl,
        code: inviteCode
      });

      setIsModalOpen(false);
      setCompanyName("");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setDeliveryAddress("");

      setNotice(`Invitation generated for ${newClient.companyName}!`);
      setTimeout(() => setNotice(null), 4000);
    } catch (err: any) {
      alert("Error creating client: " + (err.message || err));
    }
  };

  // Toggle Credit Suspension
  const handleToggleCreditStatus = async (client: ClientAccount) => {
    const updatedStatus = !client.isCreditSuspended;
    try {
      try {
        await setDoc(doc(db, "client_accounts", client.id), {
          ...client,
          isCreditSuspended: updatedStatus
        }, { merge: true });
      } catch {}

      const updatedList = clients.map((c) =>
        c.id === client.id ? { ...c, isCreditSuspended: updatedStatus } : c
      );
      setClients(updatedList);
      saveStoredClients(updatedList);
      setNotice(`${client.companyName} credit terms ${updatedStatus ? "suspended" : "reactivated"}.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert("Failed to toggle status: " + err.message);
    }
  };

  // Copy Link
  const handleCopyLink = () => {
    if (!invitedLinkData) return;
    navigator.clipboard.writeText(invitedLinkData.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredClients = clients.filter(
    (c) =>
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Header and Invite Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Wholesale Client Accounts & Invitations</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Private B2B onboarding: approve client companies, assign price tiers, manage credit limits, and dispatch invitations.
          </p>
        </div>

        <button
          onClick={() => {
            setInvitedLinkData(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/20 flex items-center gap-2 transition-all hover:scale-105 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Invite New Client Business</span>
        </button>
      </div>

      {/* Generated Invite Card (When link is active) */}
      {invitedLinkData && (
        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-xs space-y-3 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-bold text-slate-900">
                Invitation Ready for {invitedLinkData.company}
              </span>
            </div>
            <button
              onClick={() => setInvitedLinkData(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Dismiss
            </button>
          </div>

          <p className="text-xs text-slate-600">
            Share this secure private onboarding link with the client procurement owner. They will set their password and can invite their store staff:
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={invitedLinkData.link}
              className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono text-slate-800 select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied!" : "Copy Link"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search clients by company or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredClients.length}</strong> approved accounts
        </div>
      </div>

      {/* Clients Master Directory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3.5 px-4">Company & Contact</th>
                <th className="py-3.5 px-4">Delivery Dock Location</th>
                <th className="py-3.5 px-4">Assigned Price Tier</th>
                <th className="py-3.5 px-4">Payment Terms</th>
                <th className="py-3.5 px-4">Credit Limit</th>
                <th className="py-3.5 px-4">Credit Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No client accounts match your search.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const tier = priceLists.find((pl) => pl.id === client.priceTierId);

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Company Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Building className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-bold text-slate-900 text-xs">
                            {client.companyName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{client.contactPerson || "Primary Owner"}</span>
                          {client.phone && <span>· {client.phone}</span>}
                        </div>
                      </td>

                      {/* Delivery Dock */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-xs">{client.deliveryAddress || "Standard Dock"}</span>
                        </div>
                      </td>

                      {/* Price Tier */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full text-[10px]">
                          {tier ? tier.name : "Base Wholesale"}
                        </span>
                      </td>

                      {/* Payment Terms */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-700 uppercase bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                          {client.creditTerms === "none" ? "Advance Wire / COD" : client.creditTerms.replace("_", "-")}
                        </span>
                      </td>

                      {/* Credit Limit */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {client.creditLimitCents > 0 ? formatCurrency(client.creditLimitCents) : "$0.00"}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {client.isCreditSuspended ? (
                          <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-[10px]">
                            <ShieldAlert className="w-3 h-3 text-red-600" />
                            Credit Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Good Standing
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleToggleCreditStatus(client)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                            client.isCreditSuspended
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                          }`}
                        >
                          {client.isCreditSuspended ? "Reactivate" : "Suspend Credit"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVITE CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl my-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Onboard & Invite Wholesale Client
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure company tier pricing, payment terms, and generate their secure invite.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Company / Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pacific Artisan Foods Ltd."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. David Vance (Buyer)"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Procurement Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="david@pacificfoods.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Assigned Price Tier
                  </label>
                  <select
                    value={priceTierId}
                    onChange={(e) => setPriceTierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    {priceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={creditTerms}
                    onChange={(e) => setCreditTerms(e.target.value as CreditTerms)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="net_30">Net 30 Days (Pre-Approved)</option>
                    <option value="net_15">Net 15 Days</option>
                    <option value="none">None (Bank Transfer / COD Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Approved Credit Limit ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="10000"
                    value={creditLimitDollars}
                    onChange={(e) => setCreditLimitDollars(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Delivery Dock / Receiving Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 500 Industrial Pkwy, Dock Bay 2"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm shadow-blue-600/20 flex items-center gap-1.5 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Generate Onboarding Invite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
