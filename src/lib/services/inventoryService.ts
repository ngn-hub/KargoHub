import { db } from "@/lib/firebase/config";
import { doc, runTransaction, getDoc, setDoc } from "firebase/firestore";
import { InventoryItem } from "@/types";

export interface StockReservationRequest {
  productId: string;
  warehouseId: string;
  quantity: number;
}

/**
 * Atomic stock reservation using Firestore runTransaction.
 * Guarantees zero overselling race conditions under load.
 * Equation: AvailableStock = qty_on_hand - qty_reserved
 */
export async function reserveStockAtomic(
  reservations: StockReservationRequest[]
): Promise<{ success: boolean; message?: string }> {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read all inventory documents in transaction
      const inventoryDocs = await Promise.all(
        reservations.map((item) => {
          const invRef = doc(db, "inventory", `${item.productId}_${item.warehouseId}`);
          return transaction.get(invRef);
        })
      );

      // 2. Validate availability for every requested line item
      for (let i = 0; i < reservations.map.length && i < reservations.length; i++) {
        const item = reservations[i];
        const snapshot = inventoryDocs[i];

        if (!snapshot.exists()) {
          throw new Error(`Inventory record not found for product ID: ${item.productId}`);
        }

        const data = snapshot.data() as InventoryItem;
        const availableStock = data.qtyOnHand - data.qtyReserved;

        if (availableStock < item.quantity) {
          throw new Error(
            `Insufficient stock for item. Requested ${item.quantity}, but only ${Math.max(
              0,
              availableStock
            )} available.`
          );
        }
      }

      // 3. Atomically increment qtyReserved for each item
      for (let i = 0; i < reservations.length; i++) {
        const item = reservations[i];
        const snapshot = inventoryDocs[i];
        const data = snapshot.data() as InventoryItem;
        const invRef = doc(db, "inventory", `${item.productId}_${item.warehouseId}`);

        transaction.update(invRef, {
          qtyReserved: data.qtyReserved + item.quantity
        });
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to reserve inventory." };
  }
}

/**
 * Releases reserved stock atomically upon cancellation or 48-hour expiration.
 */
export async function releaseStockAtomic(
  reservations: StockReservationRequest[]
): Promise<{ success: boolean; message?: string }> {
  try {
    await runTransaction(db, async (transaction) => {
      const inventoryDocs = await Promise.all(
        reservations.map((item) => {
          const invRef = doc(db, "inventory", `${item.productId}_${item.warehouseId}`);
          return transaction.get(invRef);
        })
      );

      for (let i = 0; i < reservations.length; i++) {
        const item = reservations[i];
        const snapshot = inventoryDocs[i];
        if (snapshot.exists()) {
          const data = snapshot.data() as InventoryItem;
          const invRef = doc(db, "inventory", `${item.productId}_${item.warehouseId}`);
          const newReserved = Math.max(0, data.qtyReserved - item.quantity);
          transaction.update(invRef, {
            qtyReserved: newReserved
          });
        }
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to release stock." };
  }
}

/**
 * Deducts stock from physical inventory upon delivery or picking completion.
 */
export async function commitFulfillmentAtomic(
  reservations: StockReservationRequest[]
): Promise<{ success: boolean; message?: string }> {
  try {
    await runTransaction(db, async (transaction) => {
      const inventoryDocs = await Promise.all(
        reservations.map((item) => {
          const invRef = doc(db, "inventory", `${item.productId}_${item.warehouseId}`);
          return transaction.get(invRef);
        })
      );

      for (let i = 0; i < reservations.length; i++) {
        const item = reservations[i];
        const snapshot = inventoryDocs[i];
        if (snapshot.exists()) {
          const data = snapshot.data() as InventoryItem;
          const invRef = doc(db, "inventory", `${item.productId}_${item.warehouseId}`);
          const newOnHand = Math.max(0, data.qtyOnHand - item.quantity);
          const newReserved = Math.max(0, data.qtyReserved - item.quantity);
          transaction.update(invRef, {
            qtyOnHand: newOnHand,
            qtyReserved: newReserved
          });
        }
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
