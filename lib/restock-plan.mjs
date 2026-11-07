export function stockTargets(product) {
    const reorderPoint = product.reorderPoint ?? 10;
    return { reorderPoint, targetStock: product.targetStock ?? Math.max(20, reorderPoint + 1) };
}
export function restockPlan(products) {
    return products
        .flatMap((product) => {
            const targets = stockTargets(product);
            if (product.stock > targets.reorderPoint) return [];
            const quantity = Math.max(0, targets.targetStock - product.stock);
            return [
                {
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    stock: product.stock,
                    ...targets,
                    quantity,
                    unitCost: product.cost,
                    estimatedCost: (Math.round(product.cost * 100) * quantity) / 100,
                },
            ];
        })
        .sort((a, b) => a.stock - b.stock || a.sku.localeCompare(b.sku));
}
