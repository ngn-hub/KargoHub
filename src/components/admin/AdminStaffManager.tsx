"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { UserProfile, StaffCapability, UserRole } from "@/types";
import {
  Users,
  UserCheck,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Mail,
  Phone,
  Briefcase,
  CheckCircle2,
  X,
  Search,
  Check,
  Settings,
  Lock,
  Building
} from "lucide-react";
import { DEMO_USERS } from "@/lib/services/seedService";
import { getStoredUsers, saveStoredUsers } from "@/lib/services/storeSync";

const ALL_CAPABILITIES: { key: StaffCapability; label: string; desc: string; badgeColor: string }[] = [
  {
    key: "super_admin",
    label: "Super Admin (Owner / GM)",
    desc: "Full system governance, user enrollment, and financial audits",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200"
  },
  {
    key: "finance_billing",
    label: "Finance & Accounts Receivable",
    desc: "Verify wire receipts, mint invoices, set credit limits, monitor aging debts",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200"
  },
  {
    key: "sales_rep",
    label: "Wholesale Sales Agent",
    desc: "Invite client businesses, manage pricing overrides, draft orders on client behalf",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200"
  },
  {
    key: "warehouse_lead",
    label: "Warehouse & Inventory Supervisor",
    desc: "Add catalog items, log inbound supplier restocks, manage bin coordinates",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200"
  },
  {
    key: "fleet_dispatch",
    label: "Fleet Route Dispatcher",
    desc: "Assign packed orders to delivery trucks, sequence delivery stops",
    badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-200"
  },
  {
    key: "driver",
    label: "Delivery Fleet Driver",
    desc: "Deliver orders, collect cash COD, capture client dock finger signatures",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200"
  }
];

export default function AdminStaffManager() {
  const [users, setUsers] = useState<UserProfile[]>(() => getStoredUsers());
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("Commercial & Sales");
  const [selectedCaps, setSelectedCaps] = useState<StaffCapability[]>(["sales_rep"]);

  // 1. Live subscribe
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, "users"), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
          setUsers(list);
          saveStoredUsers(list);
        }
      }, () => {
        setUsers(getStoredUsers());
      });
      return () => unsub();
    } catch {}
  }, []);

  const handleOpenCreate = () => {
    setName("");
    setEmail("");
    setPhone("");
    setDepartment("Commercial & Sales");
    setSelectedCaps(["sales_rep"]);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setSelectedUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || "");
    setDepartment(user.department || "Operations");
    setSelectedCaps(user.capabilities || ["sales_rep"]);
    setModalMode("edit");
    setIsModalOpen(true);
  };

  const toggleCapability = (cap: StaffCapability) => {
    if (selectedCaps.includes(cap)) {
      if (selectedCaps.length === 1) {
        alert("Each staff member must have at least one assigned capability.");
        return;
      }
      setSelectedCaps(selectedCaps.filter((c) => c !== cap));
    } else {
      setSelectedCaps([...selectedCaps, cap]);
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      alert("Name and email are required.");
      return;
    }

    const userId = modalMode === "create" ? `usr-${Date.now().toString().slice(-6)}` : selectedUserId!;
    
    // Primary role mapping for legacy compatibility
    let primaryRole: UserRole = "admin";
    if (selectedCaps.includes("super_admin")) primaryRole = "admin";
    else if (selectedCaps.includes("sales_rep")) primaryRole = "sales_rep";
    else if (selectedCaps.includes("warehouse_lead")) primaryRole = "warehouse";
    else if (selectedCaps.includes("driver")) primaryRole = "driver";

    const userPayload: UserProfile = {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      department: department.trim(),
      role: primaryRole,
      capabilities: selectedCaps,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    try {
      try {
        await setDoc(doc(db, "users", userId), userPayload, { merge: true });
      } catch (err) {
        console.warn("Firestore offline staff write:", err);
      }

      const updated = modalMode === "create"
        ? [userPayload, ...users.filter((u) => u.id !== userId)]
        : users.map((u) => (u.id === userId ? userPayload : u));

      setUsers(updated);
      saveStoredUsers(updated);

      setIsModalOpen(false);
      setNotice(modalMode === "create" ? `Enrolled internal staff member ${userPayload.name}!` : `Updated permissions for ${userPayload.name}.`);
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      alert("Failed to save staff member: " + err.message);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const updatedStatus = !user.isActive;
    try {
      try {
        await setDoc(doc(db, "users", user.id), { isActive: updatedStatus }, { merge: true });
      } catch {}

      const updated = users.map((u) => (u.id === user.id ? { ...u, isActive: updatedStatus } : u));
      setUsers(updated);
      saveStoredUsers(updated);
      setNotice(`${user.name} access ${updatedStatus ? "activated" : "suspended"}.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSearch;
  });

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
          <h2 className="text-xl font-bold text-slate-900">Internal Staff & Multi-Role Permissions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define organizational hierarchy, enroll internal personnel, and assign multi-role capabilities.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/20 flex items-center gap-2 transition-all hover:scale-105 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Enroll New Employee</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff by name, email, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredUsers.length}</strong> staff accounts
        </div>
      </div>

      {/* Staff Directory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3.5 px-4">Staff Member & Email</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Assigned Operational Capabilities</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No staff records match your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const caps = u.capabilities || [u.role as StaffCapability];

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          <span>{u.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{u.email}</span>
                          {u.phone && <span className="text-slate-400">· {u.phone}</span>}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {u.department || "General Operations"}
                        </span>
                      </td>

                      {/* Capabilities Matrix Badges */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {caps.map((cap) => {
                            const found = ALL_CAPABILITIES.find((c) => c.key === cap);
                            return (
                              <span
                                key={cap}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  found ? found.badgeColor : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {found ? found.label.split(" (")[0] : cap}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Active Staff
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full text-[10px]">
                            <ShieldAlert className="w-3 h-3 text-red-600" />
                            Access Suspended
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-semibold rounded-lg border border-slate-200 transition-colors"
                          >
                            Edit Roles
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors ${
                              u.isActive
                                ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {u.isActive ? "Suspend" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ENROLL / EDIT STAFF MODAL WITH MULTI-ROLE CAPABILITY CHECKBOXES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative max-w-xl w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {modalMode === "create" ? "Enroll Internal Staff Member" : "Configure Staff Multi-Role Capabilities"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Control exact functional permissions per person across departments.
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

            <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Employee Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Eleanor Vance"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="eleanor@kargohub.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Direct Phone / Extension
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 901-2244"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Primary Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
                  >
                    <option value="Executive Management">Executive Management</option>
                    <option value="Finance & Accounts Receivable">Finance & Accounts Receivable</option>
                    <option value="Commercial Sales & Accounts">Commercial Sales & Accounts</option>
                    <option value="Fulfillment & Inbound Logistics">Fulfillment & Inbound Logistics</option>
                    <option value="Fleet Delivery Logistics">Fleet Delivery Logistics</option>
                  </select>
                </div>
              </div>

              {/* Multi-Role Capability Checkbox Matrix */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                    Assigned Operational Capabilities (Check all that apply)
                  </label>
                  <span className="text-[10px] text-slate-400">Multi-role enabled</span>
                </div>

                <div className="space-y-2">
                  {ALL_CAPABILITIES.map((cap) => {
                    const isChecked = selectedCaps.includes(cap.key);
                    return (
                      <div
                        key={cap.key}
                        onClick={() => toggleCapability(cap.key)}
                        className={`p-2.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                          isChecked
                            ? "bg-white border-blue-500 shadow-xs"
                            : "bg-white/60 border-slate-200 hover:border-slate-300 opacity-80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                            <span>{cap.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                            {cap.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                  <Check className="w-3.5 h-3.5" />
                  <span>{modalMode === "create" ? "Enroll Staff" : "Update Capabilities"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
