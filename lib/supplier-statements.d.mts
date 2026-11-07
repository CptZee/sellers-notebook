import type { Supplier, PurchaseOrder, Branding } from "./notebook-types";
type Amounts = {
    originalTotal: number;
    itemTotal: number;
    paid: number;
    refunded: number;
    netPaid: number;
    balance: number;
    credit: number;
};
export type StatementRow = Amounts & {
    id: string;
    reference: string;
    supplierId: string;
    supplierName: string;
    date: string;
    status: string;
    recordable: number;
};
export function statementSuppliers(
    suppliers: Supplier[],
    orders: PurchaseOrder[],
): { id: string; name: string; archived: boolean }[];
export function supplierStatement(
    orders: PurchaseOrder[],
    filters?: { supplierId?: string; status?: string; search?: string },
): { rows: StatementRow[]; totals: Amounts };
export function supplierStatementCsv(rows: StatementRow[]): string;
export function supplierStatementHtml(
    orders: PurchaseOrder[],
    filters?: { supplierId?: string; status?: string; search?: string },
    suppliers?: Supplier[],
    branding?: Branding | null,
    now?: Date,
): string;
