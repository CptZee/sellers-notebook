import type { Supplier, Product } from "./notebook-types";
export function readSupplierCsv(text: string): {
    headers: string[];
    rows: Record<string, string>[];
    mapping: Record<string, string>;
};
export function previewSupplierImport(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
    existing: Pick<Supplier, "name">[],
    products: Product[],
): { suppliers: Supplier[]; duplicates: number; errors: { row: number; message: string }[] };
