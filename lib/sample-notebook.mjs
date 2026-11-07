export const sampleStorageKey = "sellers-notebook-sample-v2";
export function createSampleNotebook(
    today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date()),
) {
    const anchor = Date.parse(today + "T12:00:00Z"),
        dateAgo = (days) => new Date(anchor - days * 86400000).toISOString().slice(0, 10);
    const catalog = [
        ["Everyday Canvas Tote", "TOTE", "Bags", 145, 349, "👜", "#eee8dc"],
        ["Ceramic Cloud Mug", "MUG", "Home & living", 110, 289, "☕", "#ece4da"],
        ["Linen Journal", "JRN", "Stationery", 95, 249, "📓", "#e2e9df"],
        ["Amber Soy Candle", "CND", "Home & living", 160, 399, "🕯️", "#f2e1cf"],
        ["Sage Desk Organizer", "ORG", "Home & living", 180, 459, "🗃️", "#dfe8df"],
        ["Minimalist Keyring", "KEY", "Accessories", 45, 149, "🔑", "#eee1df"],
        ["Travel Zip Pouch", "PCH", "Bags", 75, 199, "👝", "#eadde8"],
        ["Weekly Planner", "PLN", "Stationery", 90, 229, "🗓️", "#e8e3cd"],
        ["Cotton Tea Towel", "TWL", "Home & living", 60, 179, "🧺", "#e0e9e8"],
        ["Resin Bookmark", "BKM", "Stationery", 35, 129, "🔖", "#e8dce1"],
        ["Glass Trinket Dish", "DSH", "Accessories", 85, 219, "💍", "#e6e1ed"],
        ["Mini Plant Pot", "POT", "Home & living", 70, 189, "🪴", "#e1e7d7"],
    ];
    const variants = [
        "Natural",
        "Sage",
        "Rose",
        "Slate",
        "Cream",
        "Terracotta",
        "Lilac",
        "Ocean",
        "Sand",
        "Forest",
    ];
    const products = Array.from({ length: 120 }, (_, index) => {
        const [name, code, category, cost, price, symbol, color] = catalog[index % catalog.length],
            variation = Math.floor(index / catalog.length),
            reorderPoint = 5 + (index % 10);
        return {
            id: `sample-product-${String(index + 1).padStart(3, "0")}`,
            name: `${name} · ${variants[variation]}`,
            sku: `${code}-${String(index + 1).padStart(3, "0")}`,
            category,
            cost: cost + variation * 3,
            price: price + variation * 5,
            stock: index % 12 === 0 ? 3 : index % 7 === 0 ? 9 : 30 + ((index * 7) % 70),
            color,
            symbol,
            reorderPoint,
            targetStock: reorderPoint + 15,
        };
    });
    const stockAdjustments = products.map((product, index) => ({
        id: `sample-stock-${String(index + 1).padStart(3, "0")}`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        kind: "Restock",
        before: 0,
        after: product.stock,
        reason: "Sample opening supplier delivery",
        createdAt: dateAgo(75 + (index % 10)) + "T04:00:00.000Z",
    }));
    const channels = ["Shopee", "Lazada", "TikTok Shop", "Direct"],
        buyers = [
            "Jamie Santos",
            "Alex Reyes",
            "Maria Cruz",
            "Sam Garcia",
            "Bea Flores",
            "Nico Tan",
            "Dani Lim",
            "Chris Ramos",
            "Pat Dela Cruz",
            "Lou Mendoza",
            "Rae Lopez",
            "Toni Bautista",
        ];
    const orders = [];
    for (let index = 0; index < products.length; index++)
        for (let batch = 0; batch < 3; batch++) {
            const product = products[index],
                group = Math.floor(index / 2),
                channel = channels[(group + batch) % 4],
                stage = (group + batch) % 10;
            const status = stage < 7 ? "Completed" : stage < 9 ? "Processing" : "Cancelled",
                quantity = index % 12 === 0 ? 1 : 1 + ((index + batch) % 4);
            const historical = channel !== "Direct",
                firstLine = index % 2 === 0;
            orders.push({
                id: `sample-order-${String(index * 3 + batch + 1).padStart(4, "0")}`,
                productId: product.id,
                productName: product.name,
                customer: `${buyers[(group + batch) % buyers.length]} (sample ${group + 1})`,
                channel,
                quantity,
                price: product.price,
                cost: product.cost,
                fee:
                    channel === "Direct"
                        ? 0
                        : channel === "Shopee"
                          ? 8
                          : channel === "Lazada"
                            ? 7
                            : 6,
                packaging: !historical || firstLine ? 15 : 0,
                shipping: historical && firstLine ? 10 : 0,
                date: dateAgo([55, 20, 0][batch] + (group % 10)),
                status,
                stockApplied: !historical,
                ...(historical
                    ? {
                          sourceOrderId: `SAMPLE-${channel === "Shopee" ? "SHP" : channel === "Lazada" ? "LZD" : "TTS"}-${batch + 1}-${String(group + 1).padStart(3, "0")}`,
                      }
                    : {}),
            });
            if (status !== "Cancelled") product.stock -= quantity;
        }
    orders.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    const expenseKinds = [
        ["Advertising", "Social ad campaign", 250],
        ["Software", "Business software subscription", 180],
        ["Rent & utilities", "Workspace day pass & utilities", 650],
        ["Office supplies", "Office supply purchase", 120],
        ["Professional services", "Bookkeeping session", 450],
        ["Other", "Team training materials", 200],
    ];
    const expenses = Array.from({ length: 120 }, (_, index) => {
        const [category, title, base] = expenseKinds[index % expenseKinds.length];
        return {
            id: `sample-expense-${String(index + 1).padStart(3, "0")}`,
            title: `${title} ${index + 1}`,
            category,
            amount: base + (index % 7) * 25,
            date: dateAgo(index % 30),
            channel: index % 5 === 0 ? "Business" : channels[index % 4],
            notes: "Fictional sample expense for exploring reports.",
        };
    });
    const refundRecords = orders
        .filter((order) => order.status === "Completed")
        .slice(0, 120)
        .map((order, index) => ({
            id: `sample-refund-${String(index + 1).padStart(3, "0")}`,
            orderId: order.id,
            amount:
                Math.round(order.price * order.quantity * (index % 3 === 0 ? 0.1 : 0.05) * 100) /
                100,
            date: new Date(
                Math.min(
                    anchor,
                    Date.parse(order.date + "T12:00:00Z") + (2 + (index % 4)) * 86400000,
                ),
            )
                .toISOString()
                .slice(0, 10),
            reason: [
                "Sample partial goodwill refund",
                "Sample price adjustment refund",
                "Sample damaged-item refund",
            ][index % 3],
        }));
    expenses.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    stockAdjustments.sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
    refundRecords.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    const suppliers = Array.from({ length: 100 }, (_, i) => ({
        id: `sample-supplier-${i + 1}`,
        name: `Sample supply studio ${i + 1}`,
        contact: `Sample contact ${i + 1}`,
        email: `studio${i + 1}@example.com`,
        phone: "",
        address: "Fictional sample supplier",
        notes: "Practice supplier; not a real business.",
        leadTimeDays: 2 + (i % 14),
        productIds: products.filter((p, index) => index % 100 === i).map((p) => p.id),
    }));
    const purchaseOrders = suppliers.map((supplier, index) => ({
        id: `sample-purchase-${index + 1}`,
        reference: `SAMPLE-PO-${String(index + 1).padStart(3, "0")}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        createdAt: dateAgo(index % 30) + "T12:00:00.000Z",
        expectedDate: "",
        notes: "Fictional pending purchase. Receive only in this sample workspace.",
        status: "Ordered",
        supplierRefunds: [],
        items: supplier.productIds.map((id) => {
            const product = products.find((p) => p.id === id);
            return {
                productId: id,
                productName: product.name,
                sku: product.sku,
                quantity: 5,
                unitCost: product.cost,
            };
        }),
    }));
    for (const [index, purchase] of purchaseOrders.entries())
        purchase.expectedDate = index % 5 === 0 ? "" : dateAgo(7 - (index % 16));
    for (const [index, purchase] of purchaseOrders.entries())
        purchase.payments = [
            {
                id: `sample-payment-${index + 1}`,
                amount:
                    Math.round(
                        purchase.items.reduce(
                            (sum, item) => sum + Math.round(item.unitCost * 100) * item.quantity,
                            0,
                        ) * 0.25,
                    ) / 100,
                date: purchase.createdAt.slice(0, 10),
                method: "Bank transfer",
                reference: `SAMPLE-PAYMENT-${index + 1}`,
                notes: "Fictional sample deposit; no real payment was made.",
            },
        ];
    return {
        products,
        orders,
        expenses,
        stockAdjustments,
        refundRecords,
        suppliers,
        purchaseOrders,
        sidebarNote:
            "Try filters, order details, refunds, or a restock. Everything in this sample is fictional and stays in this browser.",
        branding: {
            businessName: "Paper & Parcel · Sample Shop",
            notebookTitle: "The sample notebook",
            tagline: "A practice space for your little business.",
            icon: "notebook",
        },
    };
}
