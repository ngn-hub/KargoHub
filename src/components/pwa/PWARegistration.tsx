"use client";

import React, { useEffect, useState } from "react";
import { syncPendingDeliveries, getPendingDeliveries } from "@/lib/services/offlineSyncService";
import { Wifi, WifiOff, RefreshCw, Download, CheckCircle2 } from "lucide-react";

export default function PWARegistration() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    }

    // Set initial online status
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      setPendingCount(getPendingDeliveries().length);
    }

    const handleOnline = async () => {
      setIsOnline(true);
      setSyncToast("Connection restored. Synchronizing offline records...");
      setIsSyncing(true);
      const res = await syncPendingDeliveries();
      setIsSyncing(false);
      setPendingCount(res.remainingCount);
      if (res.syncedCount > 0) {
        setSyncToast(`Successfully synced ${res.syncedCount} delivery signature(s) to cloud!`);
      } else {
        setSyncToast("All cloud data is up to date.");
      }
      setTimeout(() => setSyncToast(null), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPendingCount(getPendingDeliveries().length);
      setSyncToast("Working offline. Deliveries and signatures will be cached safely on device.");
      setTimeout(() => setSyncToast(null), 5000);
    };

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Periodic check for pending offline items
    const interval = setInterval(() => {
      setPendingCount(getPendingDeliveries().length);
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      clearInterval(interval);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      alert("Cannot sync while device is offline. Please reconnect to 4G/WiFi.");
      return;
    }
    setIsSyncing(true);
    const res = await syncPendingDeliveries();
    setIsSyncing(false);
    setPendingCount(res.remainingCount);
    setSyncToast(`Sync complete: ${res.syncedCount} records synced to cloud.`);
    setTimeout(() => setSyncToast(null), 3000);
  };

  return (
    <>
      {/* Floating Status / Offline Bar (Bottom-Right or Top) */}
      {(!isOnline || pendingCount > 0 || canInstall || syncToast) && (
        <aside aria-label="Offline and Install status" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-3 sm:px-0">
          {/* Status Toast */}
          {syncToast && (
            <div className="bg-slate-900 border border-blue-500/40 text-white p-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom duration-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{syncToast}</span>
            </div>
          )}

          {/* Offline / Pending Queue Indicator */}
          {(!isOnline || pendingCount > 0) && (
            <div
              className={`p-3.5 rounded-xl border shadow-xl flex items-center justify-between gap-3 text-xs backdrop-blur-md ${
                !isOnline
                  ? "bg-amber-950/90 border-amber-500/50 text-amber-200"
                  : "bg-blue-950/90 border-blue-500/50 text-blue-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {!isOnline ? (
                  <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                ) : (
                  <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold">
                    {!isOnline ? "Offline Mode Active" : "Online — Cloud Connected"}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {pendingCount > 0
                      ? `${pendingCount} delivery signature(s) queued for sync`
                      : "Ready to record signatures offline"}
                  </div>
                </div>
              </div>

              {isOnline && pendingCount > 0 && (
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1 shrink-0 text-[11px] transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>Sync</span>
                </button>
              )}
            </div>
          )}

          {/* Install PWA Prompt Banner */}
          {canInstall && (
            <div className="bg-slate-900/95 border border-slate-700 p-3.5 rounded-xl shadow-2xl flex items-center justify-between gap-3 text-xs backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="font-bold text-white">Install KargoHub App</div>
                  <div className="text-[11px] text-slate-400">Add to home screen for 1-tap offline use</div>
                </div>
              </div>
              <button
                onClick={handleInstallClick}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-[11px] shrink-0 shadow transition-colors"
              >
                Install
              </button>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
