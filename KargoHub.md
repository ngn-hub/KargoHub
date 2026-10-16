# **B2B Wholesale Ordering Platform — Product Specification v1.3**

**Prepared:** October 2026 · **Status:** Engineering-Ready Baseline · **Phase 1 (MVP) scope**

## **1\. Overview**

A private B2B ordering platform for a distributor/warehouse and its approved retail/wholesale clients. Clients browse a catalog with client-specific pricing, place orders, track status, and reorder in one tap. The owner manages products, per-client pricing, order fulfillment, payments, and documents from an admin panel. Delivered as an installable responsive web app (PWA) with offline resilience for mobile and desktop. No public registration.

## **2\. Roles & Permissions**

| Role | Access & Scope |
| :---- | :---- |
| Client Owner | Place/approve orders, view all account orders, manage staff users, download statements. |
| Client Staff | View catalog/prices/orders; place orders (configurable by Client Owner). |
| Admin (owner) | Full system control: catalog, overrides, fulfillment, receipt verification, reports, settings. |
| Sales Rep | Draft/submit orders on behalf of assigned clients, manage client accounts, create quotes. |
| Warehouse | Access Pick/Pack lists; report packing shortfalls; transition status to PACKED / SHIPPED. |
| Driver | View assigned shipments, record COD cash collections, capture digital signature offline/online, transition status to DELIVERED. |

## **3\. Phase 1 Scope**

**IN:**

* Invited client accounts with multi-user access (Owner vs. Staff).  
* Product catalog with tiered pricing resolution (Client Override → Price List Tier → Base Price).  
* Real-time inventory check with atomic reservation at order placement.  
* Cart and checkout with Minimum Order Quantity (MOQ) validation per line item.  
* Supported payment workflows: Bank Transfer (receipt upload with manual verification), COD, and Credit Terms (pre-approved clients).  
* State-machine-driven stock reservation with race-condition-safe 48h auto-cancellation for unverified bank transfer orders.  
* Order status lifecycle tracking with an immutable audit log.  
* One-tap reorder duplicating past order line items against current active prices.  
* Server-side PDF generation (Puppeteer) for Order Confirmations, Invoices, and Signed Delivery Receipts.  
* Responsive Admin Panel for inventory, pricing, order processing, and payment reviews.  
* Notification dispatch (transactional email and WhatsApp/SMS gateway).  
* Device PIN quick-login (4–6 digits) with 30-day bi-factor re-authentication.  
* Offline-ready driver mode (IndexedDB signature & COD queue with background auto-sync).

**OUT (Scheduled for Subsequent Phases):**

* Interactive credit ledger statement allocation UI (Phase 2).  
* Quotation workflow and price negotiation engine (Phase 2).  
* Integrated payment gateway (Phase 2).  
* Analytics, advanced reports, and scheduled price list effective dates (Phase 2).  
* Recurring standing orders, multi-warehouse routing, and backorders (Phase 3).

## **4\. Core Business Rules & System Invariants**

### **Order Lifecycle State Machine**

\[DRAFT\]   
   │  
   ▼  
\[PLACED\] ───────────────(48h Unpaid / Shortfall / Manual Cancel)───────────────► \[CANCELLED\]  
   │                                                                                  ▲  
   ▼ (Admin/System Confirmed)                                                         │  
\[CONFIRMED\] ────────────(Admin Cancel with Reason Only)────────────────────────────────┤  
   │                                                                                  │  
   ▼                                                                                  │  
\[PICKING\] ──────────────(Damaged/Missing Physical Stock)─────► \[ON\_HOLD\] ────────────┘  
   │  
   ▼  
\[PACKED\]  
   │  
   ▼  
\[SHIPPED\]  
   │  
   ▼ (Driver Signature \+ COD if applicable)  
\[DELIVERED\]  
   │  
   ▼  
\[COMPLETED\]

> 1. **Atomic Inventory Reservation:**

   * Stock is reserved immediately when an order transitions to PLACED.  
   * Availability is defined as: $AvailableStock=qty\_on\_hand-qty\_reserved$.  
   * Reservation MUST occur via atomic database row updates or strict transactional isolation (SELECT ... FOR UPDATE) to prevent overselling race conditions.  
> 2. **Order Auto-Expiry (Bank Transfers):**

   * Bank transfer orders set an expiration timestamp (auto\_cancel\_at \= created\_at \+ 48 hours).  
   * An automated background worker evaluates candidate cancellations within a row lock.  
   * If payment\_status is still pending at expiration, the order moves to CANCELLED, qty\_reserved is atomically decremented, and alerts are dispatched to the client and admin.  
   * If an admin is actively verifying a receipt or if payment\_status is submitted/verified, the cancellation worker aborts.  
   * COD and Credit orders bypass the 48h expiration timer.  
> 3. **Cancellation & Shortfalls:**

   * Clients may self-cancel orders only while in the PLACED state.  
   * Once CONFIRMED, only Admins may cancel, requiring a mandatory logged justification.  
   * Phase 1 prohibits partial shipments. If physical pick/pack discovers damaged or missing inventory, the order transitions to ON\_HOLD. The shortfall quantity is reconciled via an explicit inventory adjustment log, preventing phantom inventory.  
> 4. **Pricing Resolution & Snapshots:**

   * Product unit price resolves via the strict precedence:  
     1. Client Custom Override (client\_price\_overrides)  
     2. Assigned Tier Price (price\_list\_items)  
     3. Base Product Price (products.base\_price)  
   * All line prices, SKU identifiers, descriptions, unit types, and pack configurations are permanently snapshotted into order\_items at checkout. Subsequent price modifications do not affect past orders.  
> 5. **Financial Precision:**  
   * All currency values are stored as fixed-point numbers (NUMERIC(12, 2)). Floating-point math is strictly prohibited in application logic and database schemas.  
> 6. **Sequential Document Numbering:**

   * Document identifiers follow the format SO-YYYY-NNNN, INV-YYYY-NNNN, and DR-YYYY-NNNN.  
   * To guarantee zero gaps from database rollbacks, INV-YYYY-NNNN numbers are minted only upon transition to CONFIRMED or paid using an atomic PostgreSQL sequence table.

## **5\. Relational Data Architecture (PostgreSQL)**

SQL  
\-- Client account definitions  
CREATE TABLE client\_accounts (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    company\_name VARCHAR(255) NOT NULL,  
    price\_tier\_id UUID REFERENCES price\_lists(id),  
    credit\_limit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,  
    credit\_terms VARCHAR(32) NOT NULL DEFAULT 'none', \-- 'none', 'net\_15', 'net\_30'  
    is\_credit\_suspended BOOLEAN NOT NULL DEFAULT FALSE,  
    deleted\_at TIMESTAMPTZ NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Users and authorization  
CREATE TABLE users (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    email VARCHAR(255) NOT NULL UNIQUE,  
    password\_hash VARCHAR(255) NOT NULL,  
    role VARCHAR(32) NOT NULL, \-- 'admin', 'sales\_rep', 'warehouse', 'driver', 'client\_owner', 'client\_staff'  
    client\_account\_id UUID REFERENCES client\_accounts(id),  
    pin\_hash VARCHAR(255) NULL,  
    pin\_last\_auth\_at TIMESTAMPTZ NULL,  
    is\_active BOOLEAN NOT NULL DEFAULT TRUE,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Catalog definitions  
CREATE TABLE products (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    sku VARCHAR(64) NOT NULL UNIQUE,  
    name VARCHAR(255) NOT NULL,  
    description TEXT,  
    unit VARCHAR(32) NOT NULL, \-- 'piece', 'case', 'box'  
    pack\_size INT NOT NULL DEFAULT 1,  
    moq INT NOT NULL DEFAULT 1,  
    base\_price NUMERIC(12, 2) NOT NULL,  
    deleted\_at TIMESTAMPTZ NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Dynamic Tier Pricing  
CREATE TABLE price\_lists (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    name VARCHAR(100) NOT NULL UNIQUE,  
    description TEXT,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

CREATE TABLE price\_list\_items (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    price\_list\_id UUID NOT NULL REFERENCES price\_lists(id) ON DELETE CASCADE,  
    product\_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,  
    price NUMERIC(12, 2) NOT NULL,  
    UNIQUE(price\_list\_id, product\_id)  
);

CREATE TABLE client\_price\_overrides (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    client\_account\_id UUID NOT NULL REFERENCES client\_accounts(id) ON DELETE CASCADE,  
    product\_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,  
    custom\_price NUMERIC(12, 2) NOT NULL,  
    UNIQUE(client\_account\_id, product\_id)  
);

\-- Concurrency-Safe Inventory Model  
CREATE TABLE inventory (  
    product\_id UUID NOT NULL REFERENCES products(id),  
    warehouse\_id UUID NOT NULL,  
    qty\_on\_hand INT NOT NULL DEFAULT 0 CHECK (qty\_on\_hand \>= 0),  
    qty\_reserved INT NOT NULL DEFAULT 0 CHECK (qty\_reserved \>= 0),  
    PRIMARY KEY (product\_id, warehouse\_id),  
    CONSTRAINT chk\_stock\_sanity CHECK (qty\_reserved \<= qty\_on\_hand)  
);

\-- Orders Core  
CREATE TABLE orders (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    order\_number VARCHAR(32) NOT NULL UNIQUE,  
    client\_account\_id UUID NOT NULL REFERENCES client\_accounts(id),  
    placed\_by\_user\_id UUID NOT NULL REFERENCES users(id),  
    status VARCHAR(32) NOT NULL DEFAULT 'PLACED',  
    payment\_method VARCHAR(32) NOT NULL, \-- 'transfer', 'cod', 'credit'  
    payment\_status VARCHAR(32) NOT NULL DEFAULT 'pending', \-- 'pending', 'submitted', 'verified', 'paid'  
    subtotal NUMERIC(12, 2) NOT NULL,  
    total\_amount NUMERIC(12, 2) NOT NULL,  
    notes TEXT,  
    auto\_cancel\_at TIMESTAMPTZ NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  
    updated\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Immutable Snapshots  
CREATE TABLE order\_items (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    order\_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,  
    product\_id UUID NOT NULL REFERENCES products(id),  
    sku\_snapshot VARCHAR(64) NOT NULL,  
    name\_snapshot VARCHAR(255) NOT NULL,  
    unit\_snapshot VARCHAR(32) NOT NULL,  
    pack\_size\_snapshot INT NOT NULL,  
    unit\_price\_snapshot NUMERIC(12, 2) NOT NULL,  
    quantity INT NOT NULL CHECK (quantity \> 0),  
    line\_total NUMERIC(12, 2) NOT NULL  
);

\-- Audit Tracking  
CREATE TABLE order\_status\_history (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    order\_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,  
    from\_status VARCHAR(32),  
    to\_status VARCHAR(32) NOT NULL,  
    changed\_by\_user\_id UUID REFERENCES users(id),  
    reason TEXT,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Payments and Evidence  
CREATE TABLE payments (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    order\_id UUID NOT NULL REFERENCES orders(id),  
    amount NUMERIC(12, 2) NOT NULL,  
    method VARCHAR(32) NOT NULL,  
    proof\_image\_url TEXT,  
    verified\_by\_user\_id UUID REFERENCES users(id),  
    verified\_at TIMESTAMPTZ NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Document Registry  
CREATE TABLE document\_sequences (  
    doc\_type VARCHAR(16) NOT NULL, \-- 'SO', 'INV', 'DR'  
    year INT NOT NULL,  
    current\_value INT NOT NULL DEFAULT 0,  
    PRIMARY KEY (doc\_type, year)  
);

CREATE TABLE documents (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    order\_id UUID NOT NULL REFERENCES orders(id),  
    doc\_type VARCHAR(16) NOT NULL,  
    doc\_number VARCHAR(32) NOT NULL UNIQUE,  
    pdf\_url TEXT NOT NULL,  
    signature\_url TEXT NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

## **6\. Screens & Interfaces**

### **Client PWA (8 Screens)**

> 1. **Login:** Email/password entry with an optional prompt to configure a quick 4–6 digit local PIN.  
> 2. **Home Dashboard:** Quick-reorder banner referencing the last completed order; cards showing active open order statuses.  
> 3. **Product Catalog:** Grouped list with real-time resolved client pricing, calculated stock availability badges, and MOQ indicators.  
> 4. **Product Detail:** Full specifications, packaging rules, tiered volume notices, and an add-to-cart stepper.  
> 5. **Cart & Checkout:** Line item adjustments, real-time MOQ validation, payment method selector (Bank Transfer, COD, Credit), delivery date requests, and checkout notes.  
> 6. **Order Placement Success:** Immediate confirmation display with company bank details and an authenticated drag-and-drop receipt upload widget.  
> 7. **Order Detail & Timeline:** Visual status progression tracker, signed and generated PDF download links, and a self-cancel button (restricted to PLACED status).  
> 8. **Order History & Account:** List of historical orders with CSV statement downloads, address managers, credit limit status metrics, and device security PIN management.

### **Admin Panel (7 Screens)**

> 1. **Executive Dashboard:** Live metrics for daily order volume, pending receipt verifications, low-stock warnings, and credit accounts requiring attention.  
> 2. **Order Fulfillment Hub:** Filterable master order list; modal workflow to verify payment receipts, record packing shortfalls, transition statuses, and view immutable audit trails.  
> 3. **Client Account Manager:** Directory of accounts; configurations for assigned price lists, client-specific override rules, credit limits, and user invitations.  
> 4. **Product & Inventory Manager:** Master catalog management, MOQ configurations, base pricing, and direct adjustments for warehouse stock on hand.  
> 5. **Price Tier Manager:** Matrix editor for managing grouped price tiers and assigning tiered pricing structures.  
> 6. **Platform Settings:** Configuration for company branding, contact details, PDF template styling, and sequential numbering sequences.  
> 7. **Reports:** (Phase 2 placeholder).

### **Warehouse & Driver Interface (3 Screens)**

> 1. **Warehouse Picking List:** SKU, location, quantity requested, and dynamic stock check confirmation.  
> 2. **Packing & Dispatch:** Shortfall reporting interface and packing completion transition trigger.  
> 3. **Driver Delivery App:** Optimized mobile touch interface: displays destination address, captures exact COD cash amounts, collects digital finger signatures with full offline caching via IndexedDB, and automatically marks orders as DELIVERED.

## **7\. Recommended Technical Stack**

* **Frontend & PWA:** Next.js (React), Tailwind CSS, Service Workers with Workbox (offline caching for assets and driver requests), HTML5 Canvas for signature collection.  
* **API & Backend:** Node.js with NestJS (TypeScript) or Django REST Framework (Python). NestJS is recommended for shared type validation (Zod) across both the Next.js frontend and the API server.  
* **Database:** PostgreSQL (v15+) with strict foreign keys, atomic row locks (FOR UPDATE), check constraints, and indexed audit logs.  
* **Document Processing:** Headless Chromium via Puppeteer for deterministic HTML-to-PDF invoice rendering.  
* **Task Scheduling & Asynchronous Jobs:** Redis \+ BullMQ (or Celery) for the 48-hour payment expiration timer, stock auto-releases, and transactional webhook notifications.  
* **Object Storage:** S3-compatible object store (MinIO, Cloudflare R2, or AWS S3) with pre-signed URLs for receipt uploads and generated PDF storage.  
* **Communication Gateway:** SendGrid/Postmark (Email) and Twilio (WhatsApp/SMS transactional alerts).

## **8\. Non-Functional & Security Requirements**

> 1. **Authentication & Session Lifecycle:**

   * JWT session management stored in HttpOnly, SameSite=Strict cookies.  
   * 30-minute idle session timeout.  
   * Device PIN quick-login allowed via an encrypted local device token, requiring full bi-factor password re-authentication every 30 days.  
> 2. **Role-Based Access Control (RBAC):**

   * Enforced by server-side guards across all REST endpoints.  
   * Client access tokens are strictly scoped to their respective client\_account\_id.  
> 3. **Data Integrity & Traceability:**

   * All state transitions and price adjustments are recorded in append-only audit tables with associated user IDs, timestamps, and reason codes.  
   * Tables for products and client accounts use soft-deletion patterns (deleted\_at) to preserve relational integrity with past orders.  
> 4. **Offline Resilience for Field Drivers:**  
   * Drivers operate via an offline-first service worker. Signatures and delivery updates are written to IndexedDB and synchronized in an idempotent queue upon network reconnection.  
> 5. **Backups & Disaster Recovery:**

   * Point-in-time recovery (PITR) enabled on PostgreSQL with automated daily snapshots.  
   * S3 cross-region replication configured for uploaded payment receipts and generated PDF archives.

## **9\. Acceptance Criteria (Definition of Done)**

> 1. **Quick Reorder:** An authenticated client can view their last completed order and successfully place a duplicate order in $\leq 3$ screen interactions.  
> 2. **Pricing Isolation:** When Client A (Tier 1\) and Client B (Tier 2 with custom overrides) view the same product SKU simultaneously, each sees their correct resolved pricing without cache leakage.  
> 3. **Zero Overselling Under Load:** When 1 unit of stock remains, concurrent simultaneous checkouts by two separate clients result in exactly one successful order; the competing checkout fails gracefully with an out-of-stock warning.  
> 4. **Payment Verification & Document Creation:** Admin approval of an uploaded bank transfer receipt transitions the order to CONFIRMED and creates an immutable invoice PDF with a monotonically increasing sequential number.  
> 5. **Driver Completion Flow:** The driver delivery interface records a physical signature and COD cash collection in $\leq 3$ taps, updating the order to DELIVERED and paid.  
> 6. **Deterministic 48h Expiration:** A bank-transfer order without payment receipt verification auto-cancels precisely at 48 hours, immediately releasing its reserved inventory back to available stock.  
> 7. **Credit Limit Hard Blocking:** A client whose pending balance plus current cart total exceeds their defined credit limit is blocked at checkout with a descriptive reconciliation message.  
> 8. **Audit Trail Completeness:** Every status change, line adjustment, and receipt verification creates an immutable, timestamped record in the status history table.

# **PHASE 2 — Specification (Credit, Quotes & Gateways)**

## **P2.1 Scope**

**IN:**

* Complete credit terms management engine (credit limits, aging analysis, repayment allocation).  
* Quotation workflow (Sales Rep creation → Client negotiation → One-tap order conversion).  
* Payment Gateway integration (Stripe / Local provider for debit/credit cards and e-wallets).  
* Administrative reporting and business analytics suite.  
* Price list scheduling using time-activated effective dates.  
* Multi-split and partial payment processing.  
* Client automated "Back in Stock" alerts.  
* Advanced product categorization and elastic text search.

**OUT (Scheduled for Subsequent Phases):**

* Multi-warehouse routing, recurring subscription orders, and backorders (Phase 3).

## **P2.2 Business Rules**

> 1. **Credit Terms & Ledger:**

   * Credit terms (net\_15, net\_30, net\_60) determine charge maturity: $DueDate=DeliveryDate+Terms$.  
   * Repayments are logged as ledger credits and allocated using an automated First-In, First-Out (FIFO) oldest-charge-first method or via explicit admin matching.

Outstanding Balance is derived dynamically:

$$Balance=\sum\limits_{}^{}(Charges)-\sum\limits_{}^{}(Payments)$$

* 

  * Checkout validation rule: If $Balance+NewOrderTotal>CreditLimit$, checkout is halted. The client must choose an alternate payment method or clear open invoices.  
  * Accounts with overdue charges trigger automated reminder emails at 3 days before maturity, on the due date, and at 7 days past due. Admins retain the ability to suspend credit purchasing independently without deactivating the client account.  
> 2. **Quotation Conversion Lifecycle:**

>    \[DRAFT\] ──► \[SENT\] ──► \[ACCEPTED\] ──► \[AUTO-CONVERT TO PLACED ORDER\]  
>                  │  
>                  ├──► \[DECLINED\]  
>                  └──► \[EXPIRED\]

   * Sales reps assemble quotes specifying client targets, line pricing, and validity periods.  
   * Clients accept via single-tap in-app approval. This atomically generates a PLACED order locking the quoted prices and referencing quote\_id.  
> 3. **Online Gateway Settlement:**

   * Webhooks serve as the authoritative settlement confirmation for credit card/e-wallet transactions.  
   * Orders move immediately to paid and CONFIRMED upon webhook verification. Abandoned payments retain inventory under the standard 48-hour cancellation timer.  
> 4. **Split & Partial Payments:**

   * Orders support multiple payment records against a single balance.  
   * The 48-hour auto-cancellation rule applies strictly to the unpaid balance remainder.  
> 5. **Price List Scheduling:**

   * Price tiers support future dates (effective\_from).  
   * The pricing resolution engine queries the latest effective record where effective\_from \<= NOW().

## **P2.3 Schema Additions**

SQL  
\-- Credit Ledger Core  
CREATE TABLE credit\_ledger (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    client\_account\_id UUID NOT NULL REFERENCES client\_accounts(id),  
    order\_id UUID NULL REFERENCES orders(id),  
    entry\_type VARCHAR(16) NOT NULL, \-- 'CHARGE', 'PAYMENT'  
    amount NUMERIC(12, 2) NOT NULL,  
    due\_date DATE NULL,  
    allocated\_charge\_ids UUID\[\] NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);  
CREATE INDEX idx\_credit\_ledger\_client ON credit\_ledger(client\_account\_id, created\_at);

\-- Quotes Subsystem  
CREATE TABLE quotes (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    quote\_number VARCHAR(32) NOT NULL UNIQUE,  
    client\_account\_id UUID NOT NULL REFERENCES client\_accounts(id),  
    created\_by\_user\_id UUID NOT NULL REFERENCES users(id),  
    status VARCHAR(32) NOT NULL DEFAULT 'draft', \-- 'draft', 'sent', 'accepted', 'declined', 'expired'  
    subtotal NUMERIC(12, 2) NOT NULL,  
    total\_amount NUMERIC(12, 2) NOT NULL,  
    valid\_until TIMESTAMPTZ NOT NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

CREATE TABLE quote\_items (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    quote\_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,  
    product\_id UUID NOT NULL REFERENCES products(id),  
    unit\_price NUMERIC(12, 2) NOT NULL,  
    quantity INT NOT NULL CHECK (quantity \> 0),  
    line\_total NUMERIC(12, 2) NOT NULL  
);

\-- Gateway & Partial Fields  
ALTER TABLE payments ADD COLUMN gateway\_ref VARCHAR(255) NULL;  
ALTER TABLE payments ADD COLUMN gateway\_fee NUMERIC(12, 2) DEFAULT 0.00;

\-- Orders Extension  
ALTER TABLE orders ADD COLUMN quote\_id UUID NULL REFERENCES quotes(id);  
ALTER TABLE orders ADD COLUMN payment\_progress NUMERIC(5, 2) DEFAULT 0.00;

\-- Price Scheduling Extension  
ALTER TABLE price\_lists ADD COLUMN effective\_from TIMESTAMPTZ NOT NULL DEFAULT NOW();  
ALTER TABLE price\_list\_items ADD COLUMN effective\_from TIMESTAMPTZ NOT NULL DEFAULT NOW();

## **P2.4 Phase 2 Screens**

* **Client:** Credit account management dashboard (real-time balance, credit limit, aging bucket cards, statement export); quotation view with one-tap conversion button; partial payment tracking progress indicators.  
* **Admin:** Credit aging management console (0–30, 31–60, 61–90, 90+ days overdue analysis); debt repayment matching interface; price list activation scheduler; quote builder; analytics dashboards.  
* **Driver:** Split-settlement delivery screen supporting partial cash collection and automated remaining balance deferrals.

## **P2.5 Phase 2 Acceptance Criteria**

> 1. **Credit Balance Transparency:** Clients can view live balances, aging categories, and download PDF account statements.  
> 2. **Hard Limit Enforcement:** Checkout halts with an over-limit notification if an order exceeds credit limits, offering immediate alternative payment options.  
> 3. **Atomic Quote Conversion:** Client approval converts an active quote into a PLACED order, locking quoted pricing without discrepancies.  
> 4. **Automated Gateway Reconciliation:** Payment webhooks transition orders to paid and CONFIRMED without manual admin intervention.  
> 5. **Scheduled Pricing Rollovers:** Price list updates scheduled for midnight activate automatically across the catalog without changing totals on existing orders.

# **PHASE 3 — Specification (Enterprise Scale & Logistics)**

## **P3.1 Scope**

**IN:**

* Standing recurring order automations.  
* Multi-warehouse routing and inventory tracking.  
* Partial fulfillment and automated line-item backordering.  
* Bi-directional ERP / Accounting sync (stock inbound, orders outbound).  
* Advanced promotional rules and coupon validation engine.  
* Client self-service analytics portal.

## **P3.2 Business Rules**

> 1. **Recurring Standing Orders:**

   * Clients create replenishment schedules (weekly, biweekly, monthly).  
   * Orders generate in PLACED status 24 hours prior to fulfillment.  
   * If a recurring order fails credit limits or inventory checks, it transitions to ON\_HOLD and alerts both the client and account manager without dropping silently.  
> 2. **Multi-Warehouse Routing & Stock Allocation:**

   * Fulfillment resolves by warehouse proximity, inventory availability, and order consolidation rules.  
   * When split fulfillment is active, orders divide into multiple distinct warehouse shipments.  
> 3. **Line-Item Shortfalls & Backorders:**

   * Order lines carry discrete tracking states: pending, fulfilled, backordered, cancelled.  
   * Shortfalls at picking convert remaining line items into backorders while shipping available quantities.  
   * Invoices and Delivery Receipts generate per discrete shipment. Credit maturity timelines begin upon the final shipment's delivery date.  
> 4. **ERP Synchronization Boundaries:**

   * The external ERP is the system of record for inventory levels and master product metadata.  
   * The B2B Platform is the system of record for order status, signature captures, and checkouts.  
   * Sync conflicts follow unidirectional rules: Inbound to Platform for catalog/stock; Outbound to ERP for orders and fulfillment updates.

## **P3.3 Schema Additions**

SQL  
\-- Recurring Orders  
CREATE TABLE order\_templates (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    client\_account\_id UUID NOT NULL REFERENCES client\_accounts(id),  
    schedule\_cron VARCHAR(64) NOT NULL,  
    is\_paused BOOLEAN NOT NULL DEFAULT FALSE,  
    next\_run\_at TIMESTAMPTZ NOT NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

CREATE TABLE order\_template\_items (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    template\_id UUID NOT NULL REFERENCES order\_templates(id) ON DELETE CASCADE,  
    product\_id UUID NOT NULL REFERENCES products(id),  
    quantity INT NOT NULL CHECK (quantity \> 0)  
);

\-- Shipments and Line Splitting  
CREATE TABLE shipments (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    order\_id UUID NOT NULL REFERENCES orders(id),  
    warehouse\_id UUID NOT NULL,  
    tracking\_number VARCHAR(100),  
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', \-- 'PENDING', 'PACKED', 'SHIPPED', 'DELIVERED'  
    dispatched\_at TIMESTAMPTZ NULL,  
    delivered\_at TIMESTAMPTZ NULL  
);

ALTER TABLE order\_items ADD COLUMN shipment\_id UUID NULL REFERENCES shipments(id);  
ALTER TABLE order\_items ADD COLUMN line\_status VARCHAR(32) NOT NULL DEFAULT 'pending';

\-- Warehouse Movements  
CREATE TABLE inventory\_movements (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    product\_id UUID NOT NULL REFERENCES products(id),  
    from\_warehouse\_id UUID REFERENCES inventory(warehouse\_id),  
    to\_warehouse\_id UUID REFERENCES inventory(warehouse\_id),  
    quantity INT NOT NULL,  
    movement\_type VARCHAR(32) NOT NULL, \-- 'TRANSFER', 'ADJUSTMENT', 'FULFILLMENT', 'RESTOCK'  
    reference\_id UUID NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

\-- Promotions  
CREATE TABLE promotions (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    code VARCHAR(64) NOT NULL UNIQUE,  
    discount\_type VARCHAR(16) NOT NULL, \-- 'PERCENT', 'FIXED'  
    discount\_value NUMERIC(12, 2) NOT NULL,  
    is\_stackable BOOLEAN NOT NULL DEFAULT FALSE,  
    starts\_at TIMESTAMPTZ NOT NULL,  
    ends\_at TIMESTAMPTZ NOT NULL,  
    created\_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  
);

## **P3.4 Phase 3 Acceptance Criteria**

> 1. **Scheduled Run Execution:** A standing monthly template automatically creates an order; clients can skip an upcoming scheduled delivery without cancelling the recurring subscription.  
> 2. **Multi-Warehouse Fulfillment Splitting:** An order requiring stock across two warehouses produces two independent shipments and delivery receipts while maintaining unified client tracking.  
> 3. **Backorder Generation:** Picking shortfalls convert remaining line quantities into linked backorders, generating correct proportional invoices for shipped stock.  
> 4. **Resilient ERP Sync:** Nightly ERP synchronizations update inventory quantities without overwriting active cart reservations or modifying historic orders. Failed synchronization passes record structured errors and notify system administrators.

# **PHASE 4+ — Future Concepts (Unscheduled Parking Lot)**

* Predictive restocking algorithms and client reorder recommendations.  
* Tiered loyalty points, rebates, and annual buyer reward engines.  
* Multi-tenant vendor marketplace conversion.  
* Native packaging for iOS and Android store listings (App Store / Play Store).  
* Barcode/QR scanning hardware integration for warehouse pick and pack operations.  
* Dynamic route planning and fleet vehicle optimization for delivery drivers.  
* Catalog segmentation supporting private client-exclusive products.  
* Multi-currency transactions and localized international language interfaces.