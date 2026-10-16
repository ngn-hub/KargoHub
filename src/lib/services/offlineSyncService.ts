/**
 * Offline Sync Queue Service for Drivers and Warehouse
 * Captures deliveries, recipient signatures, and COD payments locally in localStorage
 * when cell connectivity drops, and auto-syncs to Cloud Firestore once back online.
 */

import { transitionOrderStatus } from "./orderService";

export interface PendingDelivery {
  orderId: string;
  orderNumber: string;
  deliveredAt: string;
  signatureUrl: string;
  codCollectedCents?: number;
  driverUserId: string;
  driverName: string;
}

const STORAGE_KEY = "kargohub_offline_driver_queue";

export function getPendingDeliveries(): PendingDelivery[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePendingDeliveries(deliveries: PendingDelivery[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deliveries));
  } catch (err) {
    console.error("Failed to persist offline deliveries", err);
  }
}

export function enqueueOfflineDelivery(delivery: PendingDelivery) {
  const current = getPendingDeliveries();
  // Filter out any duplicate for this order
  const filtered = current.filter((d) => d.orderId !== delivery.orderId);
  filtered.push(delivery);
  savePendingDeliveries(filtered);
}

export function removeOfflineDelivery(orderId: string) {
  const current = getPendingDeliveries();
  savePendingDeliveries(current.filter((d) => d.orderId !== orderId));
}

/**
 * Sync all pending offline deliveries to Firestore
 */
export async function syncPendingDeliveries(): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  const queue = getPendingDeliveries();
  if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 };

  let syncedCount = 0;
  const remaining: PendingDelivery[] = [];

  for (const item of queue) {
    try {
      const res = await transitionOrderStatus({
        orderId: item.orderId,
        toStatus: "DELIVERED",
        changedByUserId: item.driverUserId,
        changedByName: item.driverName,
        driverSignatureUrl: item.signatureUrl,
        codCollectedCents: item.codCollectedCents,
        reason: `Delivery completed offline at ${new Date(item.deliveredAt).toLocaleTimeString()} and synced to cloud.`
      });

      if (res.success) {
        syncedCount++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  savePendingDeliveries(remaining);
  return { syncedCount, remainingCount: remaining.length };
}
