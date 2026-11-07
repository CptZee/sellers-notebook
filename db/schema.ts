import {
    pgTable,
    text,
    integer,
    bigint,
    boolean,
    numeric,
    date,
    timestamp,
    uuid,
    index,
    uniqueIndex,
    primaryKey,
    foreignKey,
    unique,
    check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const notebooks = pgTable("seller_notebooks", {
    owner_id: text("owner_id").primaryKey(),
    display_name: text("display_name").notNull(),
    sidebar_note: text("sidebar_note").notNull().default(""),
    business_name: text("business_name"),
    notebook_title: text("notebook_title"),
    tagline: text("tagline"),
    icon: text("icon"),
    revision: integer("revision").notNull().default(1),
    tour_completed_at: timestamp("tour_completed_at", { withTimezone: true, mode: "string" }),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
        .notNull()
        .defaultNow(),
});
export const storageReservations = pgTable(
    "seller_storage_reservations",
    {
        id: uuid("id").primaryKey(),
        owner_id: text("owner_id")
            .notNull()
            .references(() => notebooks.owner_id, { onDelete: "cascade" }),
        object_key: text("object_key").notNull().unique(),
        bytes: bigint("bytes", { mode: "number" }).notNull(),
        created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
    },
    (t) => [
        index("seller_storage_reservations_owner_idx").on(t.owner_id, t.created_at),
        check("seller_storage_reservation_bytes_check", sql`${t.bytes} between 1 and 5242880`),
    ],
);
// Retained independently of the notebook so interrupted deletion can resume.
export const accountDeletions = pgTable(
    "seller_account_deletions",
    {
        owner_id: text("owner_id").primaryKey(),
        id: uuid("id").notNull().unique(),
        resume_hash: text("resume_hash").notNull(),
        phase: text("phase").notNull().default("files"),
        created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
        updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
    },
    (t) => [
        check(
            "seller_account_deletion_phase",
            sql`${t.phase} in ('files','records','identity','complete')`,
        ),
    ],
);
export const attachments = pgTable(
    "seller_attachments",
    {
        id: uuid("id").primaryKey(),
        owner_id: text("owner_id").notNull(),
        object_key: text("object_key").notNull().unique(),
        filename: text("filename").notNull(),
        product_id: text("product_id"),
        content_type: text("content_type").notNull(),
        size: integer("size").notNull(),
        created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
    },
    (t) => [
        index("seller_attachments_owner_idx").on(t.owner_id),
        index("seller_attachments_product_idx").on(t.owner_id, t.product_id),
    ],
);

export const shopeeConnections = pgTable("seller_shopee_connections", {
    owner_id: text("owner_id").primaryKey(),
    connection_id: uuid("connection_id").notNull(),
    shop_id: text("shop_id").notNull(),
    environment: text("environment").notNull(),
    token_ciphertext: text("token_ciphertext").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    refresh_locked_until: timestamp("refresh_locked_until", { withTimezone: true, mode: "string" }),
    last_fetched_at: timestamp("last_fetched_at", { withTimezone: true, mode: "string" }),
    connected_at: timestamp("connected_at", { withTimezone: true, mode: "string" })
        .notNull()
        .defaultNow(),
});
export const shopeeAuthStates = pgTable(
    "seller_shopee_auth_states",
    {
        state_hash: text("state_hash").primaryKey(),
        owner_id: text("owner_id").notNull(),
        expires_at: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [index("seller_shopee_state_owner_idx").on(table.owner_id)],
);

export const marketplaceConnections = pgTable(
    "seller_marketplace_connections",
    {
        owner_id: text("owner_id").notNull(),
        platform: text("platform").notNull(),
        connection_id: uuid("connection_id").notNull(),
        account_id: text("account_id").notNull(),
        token_ciphertext: text("token_ciphertext").notNull(),
        app_fingerprint: text("app_fingerprint").notNull(),
        expires_at: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
        refresh_locked_until: timestamp("refresh_locked_until", {
            withTimezone: true,
            mode: "string",
        }),
        connected_at: timestamp("connected_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.owner_id, t.platform] })],
);
export const marketplaceAuthStates = pgTable(
    "seller_marketplace_auth_states",
    {
        state_hash: text("state_hash").primaryKey(),
        owner_id: text("owner_id").notNull(),
        platform: text("platform").notNull(),
        app_fingerprint: text("app_fingerprint").notNull(),
        expires_at: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    },
    (t) => [index("seller_marketplace_state_owner_idx").on(t.owner_id)],
);

// Composite owner keys prevent relationships from crossing account boundaries.
const owned = () => ({
    owner_id: text("owner_id")
        .notNull()
        .references(() => notebooks.owner_id, { onDelete: "cascade" }),
});
const identified = () => ({
    ...owned(),
    id: text("id").notNull(),
    sort_order: numeric("sort_order", { mode: "number" }).notNull(),
});
export const products = pgTable(
    "seller_products",
    {
        ...identified(),
        name: text("name").notNull(),
        sku: text("sku").notNull(),
        sku_key: text("sku_key").generatedAlwaysAs(sql`lower(sku)`),
        category: text("category").notNull(),
        cost: numeric("cost", { mode: "number" }).notNull(),
        price: numeric("price", { mode: "number" }).notNull(),
        stock: integer("stock").notNull(),
        color: text("color").notNull(),
        symbol: text("symbol").notNull(),
        reorder_point: integer("reorder_point"),
        target_stock: integer("target_stock"),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.id] }),
        unique("seller_products_owner_sku_unique").on(t.owner_id, t.sku_key),
        index("seller_products_owner_sort_idx").on(t.owner_id, t.sort_order),
        check("seller_products_stock_check", sql`${t.stock} between 0 and 10000000`),
        check("seller_products_money_check", sql`${t.cost}>=0 and ${t.price}>=0`),
    ],
);
export const suppliers = pgTable(
    "seller_suppliers",
    {
        ...identified(),
        name: text("name").notNull(),
        contact: text("contact").notNull(),
        email: text("email").notNull(),
        phone: text("phone").notNull(),
        address: text("address").notNull(),
        notes: text("notes").notNull(),
        lead_time_days: integer("lead_time_days").notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.id] }),
        index("seller_suppliers_owner_name_idx").on(t.owner_id, t.name),
        index("seller_suppliers_owner_sort_idx").on(t.owner_id, t.sort_order),
        check("seller_suppliers_lead_time_check", sql`${t.lead_time_days} between 0 and 3650`),
    ],
);
export const supplierProducts = pgTable(
    "seller_supplier_products",
    {
        ...owned(),
        supplier_id: text("supplier_id").notNull(),
        product_id: text("product_id").notNull(),
        position: integer("position").notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.supplier_id, t.product_id] }),
        foreignKey({
            columns: [t.owner_id, t.supplier_id],
            foreignColumns: [suppliers.owner_id, suppliers.id],
        }).onDelete("cascade"),
        foreignKey({
            columns: [t.owner_id, t.product_id],
            foreignColumns: [products.owner_id, products.id],
        }),
        index("seller_supplier_products_product_idx").on(t.owner_id, t.product_id),
    ],
);
export const orders = pgTable(
    "seller_orders",
    {
        ...identified(),
        product_id: text("product_id").notNull(),
        product_name: text("product_name").notNull(),
        customer: text("customer").notNull(),
        channel: text("channel").notNull(),
        quantity: integer("quantity").notNull(),
        price: numeric("price", { mode: "number" }).notNull(),
        cost: numeric("cost", { mode: "number" }).notNull(),
        fee: numeric("fee", { mode: "number" }).notNull(),
        packaging: numeric("packaging", { mode: "number" }).notNull(),
        shipping: numeric("shipping", { mode: "number" }).notNull(),
        ordered_on: date("ordered_on", { mode: "string" }).notNull(),
        status: text("status").notNull(),
        source_order_id: text("source_order_id"),
        source_order_key: text("source_order_key").generatedAlwaysAs(
            sql`upper(btrim(source_order_id))`,
        ),
        stock_applied: boolean("stock_applied"),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.id] }),
        foreignKey({
            columns: [t.owner_id, t.product_id],
            foreignColumns: [products.owner_id, products.id],
        }),
        index("seller_orders_owner_date_idx").on(t.owner_id, t.ordered_on),
        index("seller_orders_owner_status_date_idx").on(t.owner_id, t.status, t.ordered_on),
        index("seller_orders_owner_source_idx").on(t.owner_id, t.channel, t.source_order_key),
        index("seller_orders_owner_sort_idx").on(t.owner_id, t.sort_order),
        check(
            "seller_orders_status_check",
            sql`${t.status} in ('Processing','Completed','Cancelled')`,
        ),
        check("seller_orders_quantity_check", sql`${t.quantity} between 1 and 10000000`),
        check(
            "seller_orders_money_check",
            sql`${t.price}>=0 and ${t.cost}>=0 and ${t.packaging}>=0 and ${t.shipping}>=0 and ${t.fee}>=0 and ${t.fee}<100`,
        ),
    ],
);
export const expenses = pgTable(
    "seller_expenses",
    {
        ...identified(),
        title: text("title").notNull(),
        category: text("category").notNull(),
        amount: numeric("amount", { mode: "number" }).notNull(),
        spent_on: date("spent_on", { mode: "string" }).notNull(),
        channel: text("channel").notNull(),
        notes: text("notes").notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.id] }),
        index("seller_expenses_owner_date_idx").on(t.owner_id, t.spent_on),
        index("seller_expenses_owner_sort_idx").on(t.owner_id, t.sort_order),
        check(
            "seller_expenses_amount_check",
            sql`${t.amount}>0 and ${t.amount}=round(${t.amount},2)`,
        ),
    ],
);
export const customerRefunds = pgTable(
    "seller_customer_refunds",
    {
        ...identified(),
        order_id: text("order_id").notNull(),
        amount: numeric("amount", { mode: "number" }).notNull(),
        refunded_on: date("refunded_on", { mode: "string" }).notNull(),
        reason: text("reason").notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.id] }),
        foreignKey({
            columns: [t.owner_id, t.order_id],
            foreignColumns: [orders.owner_id, orders.id],
        }),
        index("seller_customer_refunds_order_idx").on(t.owner_id, t.order_id),
        index("seller_customer_refunds_date_idx").on(t.owner_id, t.refunded_on),
        index("seller_customer_refunds_sort_idx").on(t.owner_id, t.sort_order),
        check(
            "seller_customer_refunds_amount_check",
            sql`${t.amount}>0 and ${t.amount}=round(${t.amount},2)`,
        ),
    ],
);
export const purchaseOrders = pgTable(
    "seller_purchase_orders",
    {
        ...identified(),
        reference: text("reference").notNull(),
        supplier_id: text("supplier_id"),
        supplier_snapshot_id: text("supplier_snapshot_id").notNull(),
        supplier_name: text("supplier_name").notNull(),
        created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
        expected_on: date("expected_on", { mode: "string" }),
        notes: text("notes").notNull(),
        status: text("status").notNull(),
        received_at: timestamp("received_at", { withTimezone: true, mode: "string" }),
        cancelled_at: timestamp("cancelled_at", { withTimezone: true, mode: "string" }),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.id] }),
        foreignKey({
            name: "seller_purchases_supplier_fk",
            columns: [t.owner_id, t.supplier_id],
            foreignColumns: [suppliers.owner_id, suppliers.id],
        }).onDelete("set null"),
        index("seller_purchases_owner_supplier_idx").on(t.owner_id, t.supplier_snapshot_id),
        index("seller_purchases_owner_status_date_idx").on(t.owner_id, t.status, t.expected_on),
        index("seller_purchases_owner_sort_idx").on(t.owner_id, t.sort_order),
        check(
            "seller_purchases_status_check",
            sql`${t.status} in ('Ordered','Partially received','Received','Cancelled')`,
        ),
    ],
);
export const purchaseItems = pgTable(
    "seller_purchase_items",
    {
        ...owned(),
        purchase_id: text("purchase_id").notNull(),
        product_id: text("product_id").notNull(),
        position: integer("position").notNull(),
        product_name: text("product_name").notNull(),
        sku: text("sku").notNull(),
        quantity: integer("quantity").notNull(),
        unit_cost: numeric("unit_cost", { mode: "number" }).notNull(),
        received_quantity: integer("received_quantity"),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.purchase_id, t.product_id] }),
        foreignKey({
            columns: [t.owner_id, t.purchase_id],
            foreignColumns: [purchaseOrders.owner_id, purchaseOrders.id],
        }).onDelete("cascade"),
        foreignKey({
            columns: [t.owner_id, t.product_id],
            foreignColumns: [products.owner_id, products.id],
        }),
        index("seller_purchase_items_product_idx").on(t.owner_id, t.product_id),
        check(
            "seller_purchase_items_quantity_check",
            sql`${t.quantity} between 1 and 10000000 and (${t.received_quantity} is null or ${t.received_quantity} between 0 and ${t.quantity}) and ${t.unit_cost}>=0`,
        ),
    ],
);
const financial = () => ({
    ...owned(),
    purchase_id: text("purchase_id").notNull(),
    id: text("id").notNull(),
    position: integer("position").notNull(),
    amount: numeric("amount", { mode: "number" }).notNull(),
    recorded_on: date("recorded_on", { mode: "string" }).notNull(),
    method: text("method").notNull(),
    reference: text("reference").notNull(),
    notes: text("notes").notNull(),
});
export const purchasePayments = pgTable("seller_purchase_payments", financial(), (t) => [
    primaryKey({ columns: [t.owner_id, t.purchase_id, t.id] }),
    foreignKey({
        columns: [t.owner_id, t.purchase_id],
        foreignColumns: [purchaseOrders.owner_id, purchaseOrders.id],
    }).onDelete("cascade"),
    check(
        "seller_purchase_payments_amount_check",
        sql`${t.amount}>0 and ${t.amount}=round(${t.amount},2)`,
    ),
]);
export const supplierRefunds = pgTable("seller_supplier_refunds", financial(), (t) => [
    primaryKey({ columns: [t.owner_id, t.purchase_id, t.id] }),
    foreignKey({
        columns: [t.owner_id, t.purchase_id],
        foreignColumns: [purchaseOrders.owner_id, purchaseOrders.id],
    }).onDelete("cascade"),
    check(
        "seller_supplier_refunds_amount_check",
        sql`${t.amount}>0 and ${t.amount}=round(${t.amount},2)`,
    ),
]);
export const stockAdjustments = pgTable(
    "seller_stock_adjustments",
    {
        ...identified(),
        product_id: text("product_id").notNull(),
        product_name: text("product_name").notNull(),
        sku: text("sku").notNull(),
        kind: text("kind").notNull(),
        before: integer("before").notNull(),
        after: integer("after").notNull(),
        reason: text("reason").notNull(),
        created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
        purchase_id: text("purchase_id"),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.id] }),
        foreignKey({
            columns: [t.owner_id, t.product_id],
            foreignColumns: [products.owner_id, products.id],
        }),
        foreignKey({
            columns: [t.owner_id, t.purchase_id],
            foreignColumns: [purchaseOrders.owner_id, purchaseOrders.id],
        }),
        index("seller_stock_adjustments_product_idx").on(t.owner_id, t.product_id),
        index("seller_stock_adjustments_purchase_idx").on(t.owner_id, t.purchase_id),
        index("seller_stock_adjustments_sort_idx").on(t.owner_id, t.sort_order),
        check(
            "seller_stock_adjustments_quantity_check",
            sql`${t.before} between 0 and 10000000 and ${t.after} between 0 and 10000000 and ${t.before}<>${t.after}`,
        ),
        check(
            "seller_stock_adjustments_kind_check",
            sql`${t.kind} in ('Restock','Damage','Correction','Supplier return')`,
        ),
    ],
);

export const purchaseGoodsReturns = pgTable(
    "seller_purchase_goods_returns",
    {
        ...owned(),
        purchase_id: text("purchase_id").notNull(),
        id: text("id").notNull(),
        position: integer("position").notNull(),
        returned_on: date("returned_on", { mode: "string" }).notNull(),
        reason: text("reason").notNull(),
        created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
        voided_at: timestamp("voided_at", { withTimezone: true, mode: "string" }),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.purchase_id, t.id] }),
        foreignKey({
            name: "seller_goods_return_purchase_fk",
            columns: [t.owner_id, t.purchase_id],
            foreignColumns: [purchaseOrders.owner_id, purchaseOrders.id],
        }).onDelete("cascade"),
    ],
);
export const purchaseGoodsReturnItems = pgTable(
    "seller_purchase_goods_return_items",
    {
        ...owned(),
        purchase_id: text("purchase_id").notNull(),
        return_id: text("return_id").notNull(),
        product_id: text("product_id").notNull(),
        position: integer("position").notNull(),
        product_name: text("product_name").notNull(),
        sku: text("sku").notNull(),
        quantity: integer("quantity").notNull(),
        unit_cost: numeric("unit_cost", { mode: "number" }).notNull(),
        stock_adjustment_id: text("stock_adjustment_id").notNull(),
        void_adjustment_id: text("void_adjustment_id"),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.purchase_id, t.return_id, t.product_id] }),
        foreignKey({
            name: "seller_goods_return_items_header_fk",
            columns: [t.owner_id, t.purchase_id, t.return_id],
            foreignColumns: [
                purchaseGoodsReturns.owner_id,
                purchaseGoodsReturns.purchase_id,
                purchaseGoodsReturns.id,
            ],
        }).onDelete("cascade"),
        foreignKey({
            name: "seller_goods_return_items_purchase_line_fk",
            columns: [t.owner_id, t.purchase_id, t.product_id],
            foreignColumns: [
                purchaseItems.owner_id,
                purchaseItems.purchase_id,
                purchaseItems.product_id,
            ],
        }),
        foreignKey({
            name: "seller_goods_return_items_stock_fk",
            columns: [t.owner_id, t.stock_adjustment_id],
            foreignColumns: [stockAdjustments.owner_id, stockAdjustments.id],
        }),
        foreignKey({
            name: "seller_goods_return_items_void_fk",
            columns: [t.owner_id, t.void_adjustment_id],
            foreignColumns: [stockAdjustments.owner_id, stockAdjustments.id],
        }),
        unique("seller_goods_return_stock_unique").on(t.owner_id, t.stock_adjustment_id),
        unique("seller_goods_return_void_unique").on(t.owner_id, t.void_adjustment_id),
        check(
            "seller_goods_return_items_bounds",
            sql`${t.quantity} between 1 and 10000000 and ${t.unit_cost} between 0 and 100000000 and ${t.unit_cost}=round(${t.unit_cost},2)`,
        ),
    ],
);
export const goodsReturnRefunds = pgTable("seller_goods_return_refunds", financial(), (t) => [
    primaryKey({ columns: [t.owner_id, t.purchase_id, t.id] }),
    foreignKey({
        name: "seller_goods_return_purchase_fk",
        columns: [t.owner_id, t.purchase_id],
        foreignColumns: [purchaseOrders.owner_id, purchaseOrders.id],
    }).onDelete("cascade"),
    check(
        "seller_goods_return_refunds_amount",
        sql`${t.amount}>0 and ${t.amount}=round(${t.amount},2)`,
    ),
]);

// Account-level integration settings; connection IDs are snapshots so a new shop
// authorization never inherits an old shop's opt-in or unreviewed batch.
export const marketplaceSyncSettings = pgTable(
    "seller_marketplace_sync_settings",
    {
        owner_id: text("owner_id").notNull(),
        platform: text("platform").notNull(),
        connection_id: uuid("connection_id").notNull(),
        enabled: boolean("enabled").notNull().default(false),
        interval_minutes: integer("interval_minutes").notNull().default(360),
        lookback_days: integer("lookback_days").notNull().default(2),
        shop_cipher: text("shop_cipher"),
        next_run_at: timestamp("next_run_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
        updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.platform] }),
        index("seller_sync_settings_due_idx").on(t.enabled, t.next_run_at),
        check(
            "seller_sync_settings_bounds",
            sql`${t.platform} in ('lazada','tiktok') and ${t.interval_minutes} in (60,360,1440) and ${t.lookback_days} between 1 and 7`,
        ),
    ],
);
export const marketplaceSyncRuns = pgTable(
    "seller_marketplace_sync_runs",
    {
        owner_id: text("owner_id").notNull(),
        id: uuid("id").notNull().defaultRandom(),
        platform: text("platform").notNull(),
        connection_id: uuid("connection_id").notNull(),
        shop_cipher: text("shop_cipher"),
        status: text("status").notNull().default("queued"),
        attempts: integer("attempts").notNull().default(0),
        from_date: date("from_date", { mode: "string" }).notNull(),
        to_date: date("to_date", { mode: "string" }).notNull(),
        available_at: timestamp("available_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
        created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
            .notNull()
            .defaultNow(),
        finished_at: timestamp("finished_at", { withTimezone: true, mode: "string" }),
        lease_token: uuid("lease_token"),
        lease_until: timestamp("lease_until", { withTimezone: true, mode: "string" }),
        rows_count: integer("rows_count").notNull().default(0),
        error_message: text("error_message"),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.id] }),
        foreignKey({
            columns: [t.owner_id, t.platform],
            foreignColumns: [marketplaceSyncSettings.owner_id, marketplaceSyncSettings.platform],
        }).onDelete("cascade"),
        index("seller_sync_runs_owner_idx").on(t.owner_id, t.platform, t.created_at, t.id),
        index("seller_sync_runs_claim_idx").on(t.status, t.available_at),
        uniqueIndex("seller_sync_runs_active_unique")
            .on(t.owner_id, t.platform)
            .where(sql`${t.status} in ('queued','retrying','running')`),
        check(
            "seller_sync_runs_bounds",
            sql`${t.status} in ('queued','retrying','running','ready','failed','cancelled') and ${t.attempts} between 0 and 3 and ${t.rows_count} between 0 and 1000 and ${t.from_date}<=${t.to_date}`,
        ),
    ],
);
export const marketplaceSyncRows = pgTable(
    "seller_marketplace_sync_rows",
    {
        owner_id: text("owner_id").notNull(),
        run_id: uuid("run_id").notNull(),
        position: integer("position").notNull(),
        source_order_id: text("source_order_id").notNull(),
        sku: text("sku").notNull(),
        quantity: integer("quantity").notNull(),
        unit_price: numeric("unit_price", { mode: "number" }).notNull(),
        ordered_on: date("ordered_on", { mode: "string" }).notNull(),
        status: text("status").notNull(),
        buyer: text("buyer").notNull(),
        currency: text("currency").notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.owner_id, t.run_id, t.position] }),
        foreignKey({
            columns: [t.owner_id, t.run_id],
            foreignColumns: [marketplaceSyncRuns.owner_id, marketplaceSyncRuns.id],
        }).onDelete("cascade"),
        check(
            "seller_sync_rows_bounds",
            sql`${t.position} between 0 and 999 and ${t.quantity} between 1 and 10000000 and ${t.unit_price} between 0 and 100000000 and ${t.currency}='PHP'`,
        ),
    ],
);
