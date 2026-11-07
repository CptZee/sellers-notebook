import type { Product, Order } from "./notebook-types";
export type Mapping = Record<string, string>;
export type ImportOptions = {
    fee: number;
    packaging: number;
    shipping: number;
    dateFormat: "ISO" | "DMY" | "MDY";
};
export type ImportPreview = {
    orders: Order[];
    errors: { row: number; message: string }[];
    duplicates: number;
};
export const importFields: { key: string; label: string; required: boolean; aliases: string[] }[];
export function readShopeeCsv(text: string): {
    headers: string[];
    rows: Record<string, string>[];
    mapping: Mapping;
};
export function previewShopeeImport(
    rows: Record<string, string>[],
    mapping: Mapping,
    products: Product[],
    existingOrders: Pick<Order, "id" | "channel" | "sourceOrderId">[],
    options: ImportOptions,
    platform?: "Shopee" | "Lazada" | "TikTok Shop",
): Promise<ImportPreview>;
