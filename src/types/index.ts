export type UserRole =
  | 'admin'
  | 'sales_rep'
  | 'warehouse'
  | 'driver'
  | 'client_owner'
  | 'client_staff';

export type CreditTerms = 'none' | 'net_15' | 'net_30';

export type StaffCapability =
  | 'super_admin'
  | 'finance_billing'
  | 'sales_rep'
  | 'warehouse_lead'
  | 'fleet_dispatch'
  | 'driver';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  capabilities?: StaffCapability[];
  department?: string;
  phone?: string;
  clientAccountId?: string;
  pinHash?: string;
  pinLastAuthAt?: string;
  isActive: boolean;
  createdAt: string;
}

export interface InboundRestockRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantityReceived: number;
  supplierName: string;
  poNumber: string;
  batchNumber?: string;
  receivedByUserName: string;
  warehouseLocation: string;
  createdAt: string;
}

export interface DispatchAssignment {
  orderId: string;
  orderNumber: string;
  clientCompanyName: string;
  driverId: string;
  driverName: string;
  truckId: string;
  stopSequence: number;
  dispatchedAt: string;
}

export interface ClientAccount {
  id: string;
  companyName: string;
  priceTierId?: string; // Links to price_lists.id
  creditLimitCents: number; // Stored in cents (e.g. $5000.00 = 500000)
  creditTerms: CreditTerms;
  isCreditSuspended: boolean;
  contactPerson?: string;
  phone?: string;
  deliveryAddress?: string;
  createdAt: string;
}

export type ProductUnit = 'piece' | 'case' | 'box';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: ProductUnit;
  packSize: number; // e.g. 12 pieces per case
  moq: number; // Minimum Order Quantity
  basePriceCents: number; // Standard price in integer cents
  category: string;
  imageUrl?: string;
  deletedAt?: string | null;
  createdAt: string;
}

export interface PriceList {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface PriceListItem {
  id: string;
  priceListId: string;
  productId: string;
  priceCents: number;
}

export interface ClientPriceOverride {
  id: string;
  clientAccountId: string;
  productId: string;
  customPriceCents: number;
}

export interface InventoryItem {
  productId: string;
  warehouseId: string;
  warehouseName?: string;
  qtyOnHand: number;
  qtyReserved: number;
}

export type OrderStatus =
  | 'DRAFT'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PICKING'
  | 'ON_HOLD'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentMethod = 'transfer' | 'cod' | 'credit';

export type PaymentStatus = 'pending' | 'submitted' | 'verified' | 'paid';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  skuSnapshot: string;
  nameSnapshot: string;
  unitSnapshot: ProductUnit;
  packSizeSnapshot: number;
  unitPriceSnapshotCents: number; // Snapshotted at checkout
  quantity: number;
  lineTotalCents: number;
}

export interface Order {
  id: string;
  orderNumber: string; // SO-YYYY-NNNN
  invoiceNumber?: string; // INV-YYYY-NNNN minted at CONFIRMED
  deliveryReceiptNumber?: string; // DR-YYYY-NNNN minted at DELIVERED
  clientAccountId: string;
  clientCompanyName: string;
  placedByUserId: string;
  placedByEmail: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  totalAmountCents: number;
  notes?: string;
  requestedDeliveryDate?: string;
  autoCancelAt?: string | null; // 48h timer for unverified bank transfers
  proofImageUrl?: string;
  driverSignatureUrl?: string;
  codCollectedCents?: number;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedByUserId: string;
  changedByName: string;
  reason?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  amountCents: number;
  method: PaymentMethod;
  proofImageUrl?: string;
  verifiedByUserId?: string;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  orderId: string;
  docType: 'SO' | 'INV' | 'DR';
  docNumber: string;
  pdfUrl?: string;
  signatureUrl?: string;
  createdAt: string;
}

export interface StockReservationRequest {
  productId: string;
  warehouseId: string;
  quantity: number;
}

