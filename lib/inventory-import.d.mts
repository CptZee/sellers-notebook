import type { Product } from "./notebook-types";
export type InventoryPreview = {
    products: Product[];
    errors: { row: number; message: string }[];
    duplicates: number;
};
export const inventoryFields: {
    key: string;
    label: string;
    required: boolean;
    aliases: string[];
}[];
export function readInventoryCsv(text: string): {
    headers: string[];
    rows: Record<string, string>[];
    mapping: Record<string, string>;
};
export function previewInventoryImport(
    rows: Record<string, string>[],
    mapping: Record<string, string>,
    existing: Pick<Product, "sku">[],
): InventoryPreview;
