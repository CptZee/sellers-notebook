import { sql } from "drizzle-orm";
import { database } from "./db";
import type { NotebookSnapshot } from "./notebook-types";

const views: Record<string, string> = {
    products: "seller_product_records",
    orders: "seller_order_records",
    expenses: "seller_expense_records",
    suppliers: "seller_supplier_records",
    purchaseOrders: "seller_purchase_records",
    stockAdjustments: "seller_stock_adjustment_records",
    refundRecords: "seller_customer_refund_records",
    payments: "seller_purchase_payment_records",
    supplierRefunds: "seller_supplier_refund_records",
};
/** Only identifiers from this fixed allowlist can enter SQL. Ownership stays parameterized. */
export function recordRows(owner: string, collection: string) {
    const view = views[collection];
    if (!view) throw Error("Invalid record collection.");
    return sql`(select * from ${sql.identifier(view)} where owner_id=${owner})`;
}
/** Full snapshots are reserved for validation and explicit downloads, never table pagination. */
export async function readSavedNotebook(owner: string) {
    const result = await database().execute(
        sql`select seller_notebook_snapshot(${owner}) document,coalesce((select revision from seller_notebooks where owner_id=${owner}),0) revision,(select updated_at from seller_notebooks where owner_id=${owner}) "updatedAt"`,
    );
    return result.rows[0] as unknown as {
        document: NotebookSnapshot;
        revision: number;
        updatedAt: string | null;
    };
}
export async function commitNotebookChanges(
    owner: string,
    name: string,
    revision: number,
    changes: Record<string, unknown>,
) {
    const result = await database().execute(
        sql`select * from seller_commit_changes(${owner},${revision},${name},${JSON.stringify(changes)}::jsonb)`,
    );
    return result.rows[0];
}
