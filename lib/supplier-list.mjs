export function filterSuppliers(suppliers, products, search = "") {
    const query = search.toLowerCase();
    return suppliers
        .filter((s) =>
            [
                s.name,
                s.contact,
                s.email,
                s.phone,
                ...products
                    .filter((p) => s.productIds.includes(p.id))
                    .map((p) => p.name + " " + p.sku),
            ]
                .join(" ")
                .toLowerCase()
                .includes(query),
        )
        .toSorted((a, b) => a.name.localeCompare(b.name));
}
