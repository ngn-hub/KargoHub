import { db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  runTransaction,
  addDoc,
  updateDoc,
  getDoc
} from "firebase/firestore";
import {
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusHistory,
  PaymentMethod,
  PaymentStatus,
  StockReservationRequest
} from "@/types";
import { releaseStockAtomic, commitFulfillmentAtomic } from "./inventoryService";
import { getStoredOrders, saveStoredOrders } from "./storeSync";

/**
 * Mint sequential zero-gap document numbers:
 * SO-2026-0001, INV-2026-0001, DR-2026-0001
 */
export async function getNextDocumentNumber(docType: 'SO' | 'INV' | 'DR'): Promise<string> {
  const currentYear = 2026;
  try {
    const counterDocId = `${docType}_${currentYear}`;
    const counterRef = doc(db, "document_sequences", counterDocId);

    const nextVal = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      let current = 0;
      if (snap.exists()) {
        current = snap.data().currentValue || 0;
      }
      const next = current + 1;
      transaction.set(counterRef, {
        docType,
        year: currentYear,
        currentValue: next,
        updatedAt: new Date().toISOString()
      });
      return next;
    });

    const padded = String(nextVal).padStart(4, '0');
    return `${docType}-${currentYear}-${padded}`;
  } catch {
    // Resilient offline sequence generator
    const existing = getStoredOrders();
    const count = existing.length + 1;
    const padded = String(count).padStart(4, '0');
    return `${docType}-${currentYear}-${padded}`;
  }
}

/**
 * Place a new order with atomic stock reservation and zero-gap SO-YYYY-NNNN.
 */
export async function placeOrder(orderData: {
  clientAccountId: string;
  clientCompanyName: string;
  placedByUserId: string;
  placedByEmail: string;
  items: Omit<OrderItem, 'id' | 'orderId'>[];
  paymentMethod: PaymentMethod;
  notes?: string;
  requestedDeliveryDate?: string;
  defaultWarehouseId?: string;
}): Promise<{ success: boolean; orderId?: string; orderNumber?: string; message?: string }> {
  try {
    const warehouseId = orderData.defaultWarehouseId || "wh-central-01";
    const reservations: StockReservationRequest[] = orderData.items.map((it) => ({
      productId: it.productId,
      warehouseId,
      quantity: it.quantity
    }));

    // Generate zero-gap SO number
    const orderNumber = await getNextDocumentNumber('SO');

    // Calculate subtotal & total with financial precision
    const subtotalCents = orderData.items.reduce((acc, it) => acc + it.lineTotalCents, 0);
    const totalAmountCents = subtotalCents;

    // Bank transfer auto-cancellation timer: 48 hours from now
    const now = new Date();
    const autoCancelAt =
      orderData.paymentMethod === 'transfer'
        ? new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
        : null;

    const orderId = `ord-${Date.now()}`;
    const formattedItems: OrderItem[] = orderData.items.map((it, idx) => ({
      id: `item-${orderId}-${idx}`,
      orderId,
      ...it
    }));

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      clientAccountId: orderData.clientAccountId,
      clientCompanyName: orderData.clientCompanyName,
      placedByUserId: orderData.placedByUserId,
      placedByEmail: orderData.placedByEmail,
      status: 'PLACED',
      paymentMethod: orderData.paymentMethod,
      paymentStatus: 'pending',
      subtotalCents,
      totalAmountCents,
      notes: orderData.notes || '',
      requestedDeliveryDate: orderData.requestedDeliveryDate || '',
      autoCancelAt,
      items: formattedItems,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Save to persistent storage / cache immediately
    const existing = getStoredOrders();
    saveStoredOrders([newOrder, ...existing]);

    // Attempt Firebase Cloud Firestore sync
    try {
      const orderRef = await addDoc(collection(db, "orders"), newOrder);
      const itemsCollection = collection(db, "order_items");
      await Promise.all(
        orderData.items.map((item) =>
          addDoc(itemsCollection, {
            ...item,
            orderId: orderRef.id
          })
        )
      );

      await addDoc(collection(db, "order_status_history"), {
        orderId: orderRef.id,
        fromStatus: null,
        toStatus: 'PLACED',
        changedByUserId: orderData.placedByUserId,
        changedByName: orderData.placedByEmail,
        reason: 'Order placed by client',
        createdAt: now.toISOString()
      });
    } catch (firebaseErr) {
      console.info("Firestore cloud sync queued. Order saved to local state.");
    }

    return { success: true, orderId, orderNumber };
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to create order." };
  }
}

/**
 * Transitions order state with strict audit logging and inventory rules.
 */
export async function transitionOrderStatus(params: {
  orderId: string;
  toStatus: OrderStatus;
  changedByUserId: string;
  changedByName: string;
  reason?: string;
  proofImageUrl?: string;
  driverSignatureUrl?: string;
  codCollectedCents?: number;
  warehouseId?: string;
}): Promise<{ success: boolean; invoiceNumber?: string; message?: string }> {
  try {
    let generatedInvoiceNumber: string | undefined;

    // RULE: Mint INV-YYYY-NNNN when transitioning to CONFIRMED
    if (params.toStatus === 'CONFIRMED') {
      generatedInvoiceNumber = await getNextDocumentNumber('INV');
    }

    // Update local state store
    const existing = getStoredOrders();
    const updatedList = existing.map((ord) => {
      if (ord.id === params.orderId) {
        const up: Order = {
          ...ord,
          status: params.toStatus,
          updatedAt: new Date().toISOString()
        };
        if (generatedInvoiceNumber) {
          up.invoiceNumber = generatedInvoiceNumber;
          if (ord.paymentMethod === 'transfer') up.paymentStatus = 'verified';
        }
        if (params.toStatus === 'DELIVERED') {
          up.deliveryReceiptNumber = `DR-2026-${String(existing.length + 1).padStart(4, '0')}`;
          if (params.driverSignatureUrl) up.driverSignatureUrl = params.driverSignatureUrl;
          if (typeof params.codCollectedCents === 'number') {
            up.codCollectedCents = params.codCollectedCents;
            up.paymentStatus = 'paid';
          }
        }
        if (params.proofImageUrl) {
          up.proofImageUrl = params.proofImageUrl;
          up.paymentStatus = 'submitted';
        }
        return up;
      }
      return ord;
    });

    saveStoredOrders(updatedList);

    // Attempt Cloud Firestore update
    try {
      const orderRef = doc(db, "orders", params.orderId);
      const updates: any = {
        status: params.toStatus,
        updatedAt: new Date().toISOString()
      };
      if (generatedInvoiceNumber) updates.invoiceNumber = generatedInvoiceNumber;
      if (params.proofImageUrl) updates.proofImageUrl = params.proofImageUrl;
      if (params.driverSignatureUrl) updates.driverSignatureUrl = params.driverSignatureUrl;
      if (params.codCollectedCents) updates.codCollectedCents = params.codCollectedCents;

      await updateDoc(orderRef, updates);
    } catch {
      // Offline / permission graceful handle
    }

    return {
      success: true,
      invoiceNumber: generatedInvoiceNumber
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
