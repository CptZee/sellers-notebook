export type Product = {
    id: string;
    name: string;
    sku: string;
    category: string;
    cost: number;
    price: number;
    stock: number;
    color: string;
    symbol: string;
    reorderPoint?: number;
    targetStock?: number;
};
export type Expense = {
    id: string;
    title: string;
    category: string;
    amount: number;
    date: string;
    channel: "Business" | "Shopee" | "Lazada" | "TikTok Shop" | "Direct";
    notes: string;
};
export type Order = {
    id: string;
    productId: string;
    productName: string;
    customer: string;
    channel: string;
    quantity: number;
    price: number;
    cost: number;
    fee: number;
    packaging: number;
    shipping: number;
    date: string;
    status: "Completed" | "Processing" | "Cancelled";
    sourceOrderId?: string;
    stockApplied?: boolean;
};

export type Branding = {
    businessName: string;
    notebookTitle: string;
    tagline: string;
    icon: "notebook" | "store" | "sprout";
};

export type StockAdjustment = {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    kind: "Restock" | "Damage" | "Correction" | "Supplier return";
    before: number;
    after: number;
    reason: string;
    createdAt: string;
};

export type NotebookSnapshot = {
    products: Product[];
    orders: Order[];
    expenses: Expense[];
    sidebarNote: string;
    branding: Branding | null;
    stockAdjustments: StockAdjustment[];
    refundRecords: RefundRecord[];
    suppliers: Supplier[];
    purchaseOrders: PurchaseOrder[];
};

export type RefundRecord = {
    id: string;
    orderId: string;
    amount: number;
    date: string;
    reason: string;
};

export type Supplier = {
    id: string;
    name: string;
    contact: string;
    email: string;
    phone: string;
    address: string;
    notes: string;
    leadTimeDays: number;
    productIds: string[];
};

export type PurchaseOrder = {
    id: string;
    reference: string;
    supplierId: string;
    supplierName: string;
    createdAt: string;
    expectedDate: string;
    notes: string;
    items: {
        productId: string;
        productName: string;
        sku: string;
        quantity: number;
        unitCost: number;
        receivedQuantity?: number;
    }[];
    status: "Ordered" | "Partially received" | "Received" | "Cancelled";
    receivedAt?: string;
    cancelledAt?: string;
    payments?: PurchasePayment[];
    supplierRefunds?: PurchasePayment[];
    goodsReturns?: PurchaseGoodsReturn[];
    goodsReturnRefunds?: PurchasePayment[];
};

export type PurchasePayment = {
    id: string;
    amount: number;
    date: string;
    method: string;
    reference: string;
    notes: string;
};

export type PurchaseGoodsReturn = {
    id: string;
    date: string;
    reason: string;
    createdAt: string;
    voidedAt?: string;
    items: {
        productId: string;
        productName: string;
        sku: string;
        quantity: number;
        unitCost: number;
        stockAdjustmentId: string;
        voidAdjustmentId?: string;
    }[];
};
