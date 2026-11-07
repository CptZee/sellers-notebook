export function stockChange(product, kind, quantity, reason) {
    if (
        !product ||
        !["Restock", "Damage", "Correction"].includes(kind) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 0 ||
        quantity > 10000000 ||
        typeof reason !== "string" ||
        !reason.trim() ||
        reason.trim().length > 200
    )
        throw Error("Choose a product, whole quantity, and reason of up to 200 characters.");
    const after =
        kind === "Restock"
            ? product.stock + quantity
            : kind === "Damage"
              ? product.stock - quantity
              : quantity;
    if (after < 0 || after > 10000000 || after === product.stock)
        throw Error("The new stock must be different and between 0 and 10,000,000.");
    return {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        kind,
        before: product.stock,
        after,
        reason: reason.trim(),
        createdAt: new Date().toISOString(),
    };
}
