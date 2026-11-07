import type { Supplier, Product } from "./notebook-types";
export function filterSuppliers(
    suppliers: Supplier[],
    products: Product[],
    search?: string,
): Supplier[];
