// Drizzle owns tables; this mapping defines their API serialization and write casts.
const field = (api, column, type = "text", optional = false) => ({ api, column, type, optional });
const specs = [
    {
        key: "products",
        table: "seller_products",
        view: "seller_product_records",
        fields: [
            field("name", "name"),
            field("sku", "sku"),
            field("category", "category"),
            field("cost", "cost", "numeric"),
            field("price", "price", "numeric"),
            field("stock", "stock", "integer"),
            field("color", "color"),
            field("symbol", "symbol"),
            field("reorderPoint", "reorder_point", "integer", true),
            field("targetStock", "target_stock", "integer", true),
        ],
    },
    {
        key: "suppliers",
        table: "seller_suppliers",
        view: "seller_supplier_records",
        fields: [
            ...["name", "contact", "email", "phone", "address", "notes"].map((key) =>
                field(key, key),
            ),
            field("leadTimeDays", "lead_time_days", "integer"),
        ],
        nested: `'productIds',coalesce((select jsonb_agg(product_id order by position) from seller_supplier_products l where l.owner_id=t.owner_id and l.supplier_id=t.id),'[]'::jsonb)`,
    },
    {
        key: "orders",
        table: "seller_orders",
        view: "seller_order_records",
        fields: [
            field("productId", "product_id"),
            field("productName", "product_name"),
            field("customer", "customer"),
            field("channel", "channel"),
            field("quantity", "quantity", "integer"),
            ...["price", "cost", "fee", "packaging", "shipping"].map((key) =>
                field(key, key, "numeric"),
            ),
            field("date", "ordered_on", "date"),
            field("status", "status"),
            field("sourceOrderId", "source_order_id", "text", true),
            field("stockApplied", "stock_applied", "boolean", true),
        ],
    },
    {
        key: "expenses",
        table: "seller_expenses",
        view: "seller_expense_records",
        fields: [
            field("title", "title"),
            field("category", "category"),
            field("amount", "amount", "numeric"),
            field("date", "spent_on", "date"),
            field("channel", "channel"),
            field("notes", "notes"),
        ],
    },
    {
        key: "refundRecords",
        table: "seller_customer_refunds",
        view: "seller_customer_refund_records",
        fields: [
            field("orderId", "order_id"),
            field("amount", "amount", "numeric"),
            field("date", "refunded_on", "date"),
            field("reason", "reason"),
        ],
    },
    {
        key: "purchaseOrders",
        table: "seller_purchase_orders",
        view: "seller_purchase_records",
        fields: [
            field("reference", "reference"),
            field("supplierId", "supplier_snapshot_id"),
            field("supplierName", "supplier_name"),
            field("createdAt", "created_at", "timestamptz"),
            field("expectedDate", "expected_on", "date", true),
            field("notes", "notes"),
            field("status", "status"),
            field("receivedAt", "received_at", "timestamptz", true),
            field("cancelledAt", "cancelled_at", "timestamptz", true),
        ],
        nested: [
            ["items", "seller_purchase_item_records"],
            ["payments", "seller_purchase_payment_records"],
            ["supplierRefunds", "seller_supplier_refund_records"],
        ]
            .map(
                ([key, view]) =>
                    `'${key}',coalesce((select jsonb_agg(value order by ordinality) from ${view} c where c.owner_id=t.owner_id and c.purchase_id=t.id),'[]'::jsonb)`,
            )
            .join(","),
    },
    {
        key: "stockAdjustments",
        table: "seller_stock_adjustments",
        view: "seller_stock_adjustment_records",
        fields: [
            field("productId", "product_id"),
            field("productName", "product_name"),
            field("sku", "sku"),
            field("kind", "kind"),
            field("before", "before", "integer"),
            field("after", "after", "integer"),
            field("reason", "reason"),
            field("createdAt", "created_at", "timestamptz"),
        ],
    },
];
const children = [
    {
        key: "items",
        table: "seller_purchase_items",
        view: "seller_purchase_item_records",
        identity: "product_id",
        fields: [
            field("productId", "product_id"),
            field("productName", "product_name"),
            field("sku", "sku"),
            field("quantity", "quantity", "integer"),
            field("unitCost", "unit_cost", "numeric"),
            field("receivedQuantity", "received_quantity", "integer", true),
        ],
    },
    ...[
        ["payments", "seller_purchase_payments", "seller_purchase_payment_records"],
        ["supplierRefunds", "seller_supplier_refunds", "seller_supplier_refund_records"],
    ].map(([key, table, view]) => ({
        key,
        table,
        view,
        identity: "id",
        fields: [
            field("id", "id"),
            field("amount", "amount", "numeric"),
            field("date", "recorded_on", "date"),
            field("method", "method"),
            field("reference", "reference"),
            field("notes", "notes"),
        ],
    })),
];
module.exports = { specs, children };
