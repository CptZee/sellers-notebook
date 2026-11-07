"use client";
import { SiteFooter } from "./site-footer";
import { Stat } from "./stat";
import { NotebookPageOverview } from "./notebook-page-overview";

import { purchaseCommand } from "../lib/purchase-command.mjs";
import { applyNotebookPatch } from "../lib/notebook-patch.mjs";
import { validDocument } from "../lib/notebook-validation.mjs";

import { CloudRestock } from "./cloud-restock";
import { confirmAction, ConfirmDialog } from "./confirm-dialog";

import { EntryModal } from "./entry-modal";
import { QuickCreate, type QuickCreateKind, type QuickCreateRequest } from "./quick-create";
import { CollapsibleCard } from "./collapsible-card";

import dynamic from "next/dynamic";

import { Pagination } from "./pagination";

import { usePagination } from "../lib/use-pagination";

import { useEffect, useState, useRef } from "react";

import {
    LayoutDashboard,
    Package,
    ShoppingBag,
    Calculator,
    ArrowUpRight,
    ArrowDownRight,
    ArrowRight,
    Plus,
    Search,
    ChevronDown,
    X,
    Download,
    Sprout,
    MoreHorizontal,
    Check,
    AlertCircle,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    NotebookPen,
    LogOut,
    Cloud,
    UserRound,
    ReceiptText,
    Truck,
} from "lucide-react";

import { reschedulePurchase, deliveryCounts } from "../lib/delivery-reminders.mjs";
import {
    addPurchasePayment,
    purchasePaymentProgress,
    addSupplierRefund,
    removePurchasePayment,
    eligibleFinancialPurchases,
} from "../lib/purchase-payments.mjs";
import { receivePurchase, purchaseProgress } from "../lib/purchases.mjs";
const QuickFinancialEntry = dynamic(
    () => import("./quick-financial-entry").then((module) => module.QuickFinancialEntry),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening payment records…
            </p>
        ),
    },
);
const PurchaseOrders = dynamic(
    () => import("./purchase-orders").then((module) => module.PurchaseOrders),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening purchases…
            </p>
        ),
    },
);
import { pricing, orderTotals } from "../lib/finance.mjs";

import { createSampleNotebook } from "../lib/sample-notebook.mjs";

import { useNotebook } from "../lib/use-notebook";

import { authClient } from "../lib/auth/client";

import { LiveNotebook } from "./live-notebook";

const NotebookAttachments = dynamic(
    () => import("./notebook-attachments").then((module) => module.NotebookAttachments),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening this page…
            </p>
        ),
    },
);

import type {
    Product,
    Order,
    Expense,
    StockAdjustment,
    PurchasePayment,
} from "../lib/notebook-types";

const DeliveryReminders = dynamic(
    () => import("./delivery-reminders").then((module) => module.DeliveryReminders),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening delivery reminders…
            </p>
        ),
    },
);
const SupplierStatements = dynamic(
    () => import("./supplier-statements").then((module) => module.SupplierStatements),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening statements…
            </p>
        ),
    },
);
const SupplierManager = dynamic(
    () => import("./supplier-manager").then((module) => module.SupplierManager),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening suppliers…
            </p>
        ),
    },
);

const ExpenseLedger = dynamic(
    () => import("./expense-ledger").then((module) => module.ExpenseLedger),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening this page…
            </p>
        ),
    },
);

import { transitionOrders, filterOrderList } from "../lib/order-management.mjs";

import { reportRange, inReportRange, revenueBuckets } from "../lib/reporting.mjs";

import { createRefund, refundTotal } from "../lib/refunds.mjs";

import { profitSummary } from "../lib/expenses.mjs";

const RestockPlan = dynamic(() => import("./restock-plan").then((module) => module.RestockPlan), {
    loading: () => (
        <p
            className="panel-loading"
            role="status"
        >
            Opening this page…
        </p>
    ),
});

import type { Supplier } from "../lib/notebook-types";
import { SaleEntry } from "./sale-entry";
import { CloudPurchases } from "./cloud-purchases";
import { CloudFinancialEntry } from "./cloud-financial-entry";
import { CloudOrderDetails } from "./cloud-order-details";
import { RefundHistory } from "./refund-history";
import { CloudSuppliers } from "./cloud-suppliers";
import { CloudExpenses } from "./cloud-expenses";
import { CloudOrders, type OrderPaging } from "./cloud-orders";
import { canonicalJson } from "../lib/notebook-patch.mjs";
import { CloudInventory } from "./cloud-inventory";
import { downloadNotebookFile } from "../lib/download-notebook";
import { useBusinessReport } from "../lib/use-business-report";
import { restockPurchaseDraft } from "../lib/restock-purchase.mjs";
import { stockTargets } from "../lib/restock-plan.mjs";

const StockAdjustments = dynamic(
    () => import("./stock-adjustments").then((module) => module.StockAdjustments),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening this page…
            </p>
        ),
    },
);

const InventoryImport = dynamic(
    () => import("./inventory-import").then((module) => module.InventoryImport),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening this page…
            </p>
        ),
    },
);

const ShopeeImport = dynamic(
    () => import("./shopee-import").then((module) => module.ShopeeImport),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening this page…
            </p>
        ),
    },
);

import { type ShopeeFetched } from "./shopee-connection";

const OrderDetails = dynamic(
    () => import("./order-details").then((module) => module.OrderDetails),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening this page…
            </p>
        ),
    },
);

const NotebookBackup = dynamic(
    () => import("./notebook-backup").then((module) => module.NotebookBackup),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening this page…
            </p>
        ),
    },
);

const AccountSettings = dynamic(
    () => import("./account-settings").then((module) => module.AccountSettings),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening this page…
            </p>
        ),
    },
);

import { BrandingMark } from "./branding-settings";

import { ThemeSwitch } from "./theme-switch";
import { NotebookTour } from "./notebook-tour";
import { CursorToggle } from "./cursor-toggle";
import { MarketplaceConnections } from "./marketplace-connections";

const money = (n: number) =>
    new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n);

const tabs = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Inventory", icon: Package },
    { name: "Orders", icon: ShoppingBag },
    { name: "Expenses", icon: ReceiptText },
    { name: "Suppliers", icon: Truck },
    { name: "Pricing calculator", icon: Calculator },
];

const channelClass = (c: string) =>
    c === "Shopee" ? "orange" : c === "Lazada" ? "purple" : c === "TikTok Shop" ? "dark" : "green";

const sampleNotebook = createSampleNotebook();

export default function Home() {
    const [page, setPage] = useState("Overview");
    const [stockEntryRequest, setStockEntryRequest] = useState(0);

    const notebook = useNotebook<Product, Order>(sampleNotebook);

    const {
        products,
        setProducts,
        orders,
        setOrders,
        expenses: businessExpenses,
        setExpenses,
        sidebarNote,
        setSidebarNote,
        branding,
        setBranding,
        stockAdjustments,
        setStockAdjustments,
        refundRecords,
        setRefundRecords,
        suppliers,
        setSuppliers,
        purchaseOrders,
        setPurchaseOrders,
        ready,
        user,
        mode,
        status,
        issue: storageIssue,
    } = notebook;

    const [attachmentProduct, setAttachmentProduct] = useState("");

    const [inventoryImportOpen, setInventoryImportOpen] = useState(false);

    const [financialKind, setFinancialKind] = useState<"payment" | "supplier-refund" | null>(null);
    const [statementRequest, setStatementRequest] = useState<{
        id: string;
        sequence: number;
    } | null>(null);
    const [deliveryOpenRequest, setDeliveryOpenRequest] = useState(0),
        [purchaseFocusRequest, setPurchaseFocusRequest] = useState<{
            id: string;
            action: "view" | "receive";
            sequence: number;
        } | null>(null);
    const purchaseFocusSequence = useRef(0);
    const quickSequence = useRef(0);
    const [quickRequest, setQuickRequest] = useState<QuickCreateRequest | null>(null);
    const [accountOpen, setAccountOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [shopeeFetched, setShopeeFetched] = useState<ShopeeFetched | null>(null);

    useEffect(() => {
        if (!ready) return;
        document.title = branding
            ? `${branding.notebookTitle} — ${branding.businessName}`
            : "Seller’s Notebook — Your business, beautifully kept";
        return () => {
            document.title = "Seller’s Notebook — Your business, beautifully kept";
        };
    }, [branding, ready]);

    const initials = user
        ? user.name
              .split(/\s+/)
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()
        : "SN";

    const workspaceName =
        branding?.notebookTitle ||
        (mode === "cloud" ? `${user?.name.split(" ")[0] || "My"}’s notebook` : "Sample notebook");

    const [detailOrder, setDetailOrder] = useState<string | null>(null);

    const [orderStatus, setOrderStatus] = useState("All statuses"),
        [orderSort, setOrderSort] = useState("newest");

    const [search, setSearch] = useState("");
    const [period, setPeriod] = useState("30");
    const [channel, setChannel] = useState("All channels");
    const [modal, setModal] = useState<"product" | "order" | null>(null);
    const [editing, setEditing] = useState<Product | null>(null);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [mobile, setMobile] = useState(false);

    const [sidebarHidden, setSidebarHidden] = useState(false);
    const [isNarrow, setIsNarrow] = useState(false);

    const sidebarOpen = isNarrow ? mobile : !sidebarHidden;

    const closeSidebar = () => {
        if (isNarrow) setMobile(false);
        else setSidebarHidden(true);
        document.getElementById("sidebar-toggle")?.focus();
    };

    useEffect(() => {
        const query = window.matchMedia("(max-width: 760px)");
        const sync = () => {
            setIsNarrow(query.matches);
            setMobile(false);
        };
        sync();
        query.addEventListener("change", sync);
        try {
            setSidebarHidden(localStorage.getItem("sellerdesk-sidebar-hidden") === "true");
        } catch {}
        return () => query.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        if (ready)
            try {
                localStorage.setItem("sellerdesk-sidebar-hidden", String(sidebarHidden));
            } catch {}
    }, [sidebarHidden, ready]);

    useEffect(() => {
        if (!mobile) return;
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setMobile(false);
                document.getElementById("sidebar-toggle")?.focus();
            }
        };
        window.addEventListener("keydown", escape);
        return () => window.removeEventListener("keydown", escape);
    }, [mobile]);

    const [calc, setCalc] = useState({
        cost: 150,
        packaging: 15,
        shipping: 0,
        fee: 8,
        margin: 30,
        tax: 0,
    });

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(""), 3500);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const low = products.filter((p) => p.stock <= stockTargets(p).reorderPoint);

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

    const [customFrom, setCustomFrom] = useState(today.slice(0, 7) + "-01"),
        [customTo, setCustomTo] = useState(today);

    const localRange = reportRange(
        period,
        today,
        [
            ...orders.map((o) => o.date),
            ...businessExpenses.map((e) => e.date),
            ...refundRecords.map((refund) => refund.date),
        ],
        customFrom,
        customTo,
    );

    const serverReport = useBusinessReport({
        enabled:
            mode === "cloud" &&
            (page === "Overview" || page === "Orders" || page === "Expenses") &&
            ready &&
            !notebook.hasUnsaved &&
            !storageIssue &&
            !localRange.error,
        userId: user?.id,
        revision: notebook.revision,
        period,
        channel,
        from: customFrom,
        to: customTo,
    });
    const reportPending = mode === "cloud" && !serverReport.data;
    const range = serverReport.data?.range || localRange;
    const filtered = orders.filter(
        (o) =>
            inReportRange(o.date, range) && (channel === "All channels" || o.channel === channel),
    );
    const paid = mode === "cloud" ? [] : filtered.filter((o) => o.status === "Completed");

    const filteredExpenses = businessExpenses.filter(
        (expense) =>
            inReportRange(expense.date, range) &&
            (channel === "All channels" || expense.channel === channel),
    );

    const filteredRefunds =
        mode === "cloud"
            ? []
            : refundRecords.filter(
                  (refund) =>
                      inReportRange(refund.date, range) &&
                      (channel === "All channels" ||
                          orders.find((order) => order.id === refund.orderId)?.channel === channel),
              );

    const refunds =
        mode === "cloud" ? serverReport.data?.refunds || 0 : refundTotal(filteredRefunds);

    const summary =
        mode === "cloud"
            ? serverReport.data?.summary || {
                  revenue: 0,
                  orderCosts: 0,
                  orderProfit: 0,
                  overhead: 0,
                  netProfit: 0,
              }
            : profitSummary(filtered, filteredExpenses, filteredRefunds);
    const reportCounts =
        mode === "cloud"
            ? serverReport.data?.counts || { all: 0, received: 0, processing: 0, completed: 0 }
            : {
                  all: filtered.length,
                  received: filtered.filter((o) => o.status !== "Cancelled").length,
                  processing: filtered.filter((o) => o.status === "Processing").length,
                  completed: paid.length,
              };
    const reportInventory =
        mode === "cloud"
            ? serverReport.data?.inventory || { value: 0, units: 0, products: 0 }
            : {
                  value: products.reduce((sum, p) => sum + p.stock * p.cost, 0),
                  units: products.reduce((sum, p) => sum + p.stock, 0),
                  products: products.length,
              };
    const channelValue = (name: string) =>
        mode === "cloud"
            ? serverReport.data?.channels[name] || 0
            : paid
                  .filter((o) => o.channel === name)
                  .reduce((sum, o) => sum + orderTotals(o).revenue, 0);
    const recentReportOrders =
        mode === "cloud" ? serverReport.data?.recentOrders || [] : filtered.slice(0, 5);
    const reportLow = mode === "cloud" ? serverReport.data?.lowProducts || [] : low.slice(0, 3),
        reportLowCount = mode === "cloud" ? serverReport.data?.lowCount || 0 : low.length;

    const revenue = summary.revenue;

    async function saveExpense(expense: Expense, expected: Expense | null = null) {
        if (mode === "cloud" && !notebook.hydrated) {
            await notebook.saveRecord("expenses", expense, expected);
            notify("Expense saved");
            return;
        }
        setExpenses((old) =>
            old.some((item) => item.id === expense.id)
                ? old.map((item) => (item.id === expense.id ? expense : item))
                : [expense, ...old],
        );
        notify("Expense recorded. Saving your notebook…");
    }

    function recordRefund(input: {
        orderId: string;
        amount: number;
        date: string;
        reason: string;
    }) {
        if (!ready || notebook.hasUnsaved || storageIssue)
            throw Error("Wait for current changes to finish saving.");
        const record = createRefund(orders, refundRecords, input);
        setRefundRecords((old) => [record, ...old]);
        notify("Issued refund recorded. Stock is unchanged.");
    }

    function removeRefund(id: string) {
        setRefundRecords((old) => old.filter((record) => record.id !== id));
        notify("Refund record removed. No payment or stock was changed.");
    }

    async function deleteExpense(id: string, expected?: Expense) {
        if (mode === "cloud" && !notebook.hydrated) {
            if (!expected) throw Error("Reopen this expense before deleting it.");
            await notebook.saveRecord("expenses", null, expected);
            notify("Expense removed");
            return;
        }
        setExpenses((old) => old.filter((expense) => expense.id !== id));
        notify("Expense removed. Saving your notebook…");
    }

    const go = (name: string) => {
        setPurchaseFocusRequest(null);
        setDeliveryOpenRequest(0);
        setStatementRequest(null);
        setQuickRequest(null);
        setPage(name);
        setSearch("");
        setMobile(false);
    };

    const productDraftId = useRef("");
    const open = async (kind: "product" | "order", p?: Product) => {
        if (!ready) return;
        try {
            let current: Product | null = null;
            if (kind === "order" && mode === "cloud" && !notebook.hydrated) {
                setModal("order");
                setError("");
                return;
            }
            if (kind === "product" && mode === "cloud" && !notebook.hydrated) {
                const lookup = await notebook.readRecord<Product>("products", p?.id || "");
                current = lookup.record;
                if (!p && lookup.count >= 3000) throw Error("Product limit reached.");
            } else {
                const document = await notebook.ensureHydrated();
                current = p
                    ? (document.products as Product[]).find((item) => item.id === p.id) || null
                    : null;
            }
            if (p && !current)
                throw Error("This product was removed. Refresh inventory and try again.");
            productDraftId.current = crypto.randomUUID();
            setModal(kind);
            setEditing(current || null);
            setError("");
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not open this entry.");
        }
    };
    const quickCreate = async (kind: QuickCreateKind) => {
        if (!ready || notebook.hasUnsaved || storageIssue) return;
        go(
            kind === "product"
                ? "Inventory"
                : kind === "order"
                  ? "Orders"
                  : kind === "expense"
                    ? "Expenses"
                    : "Suppliers",
        );
        try {
            if (
                kind !== "product" &&
                kind !== "expense" &&
                kind !== "order" &&
                kind !== "supplier" &&
                (mode !== "cloud" || notebook.hydrated)
            )
                await notebook.ensureHydrated();
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not open this entry.");
            return;
        }
        if (kind === "payment" || kind === "supplier-refund") {
            setFinancialKind(kind);
            return;
        }
        if (kind === "product" || kind === "order") {
            open(kind);
            return;
        }
        setQuickRequest({ kind, sequence: ++quickSequence.current });
    };

    const notify = (message: string) => setToast(message);
    const prepareSupplier = async (supplier?: Supplier) => {
        if (mode === "cloud" && !notebook.hydrated) {
            const lookup = await notebook.readRecord<Supplier>("suppliers", supplier?.id || "");
            if (!supplier && lookup.count >= 1000) throw Error("Supplier limit reached.");
            return lookup.record;
        }
        const document = await notebook.ensureHydrated();
        if (!supplier) return null;
        const current = (document.suppliers || []).find((item) => item.id === supplier.id);
        if (!current) throw Error("This supplier was removed. Refresh the list.");
        return current;
    };
    const prepareSupplierDelete = async (supplier: Supplier) => {
        const document = await notebook.ensureHydrated(),
            current = (document.suppliers || []).find((item) => item.id === supplier.id);
        if (canonicalJson(current) !== canonicalJson(supplier))
            throw Error("This supplier changed. Review the latest entry before deleting.");
        return document.suppliers || [];
    };
    const cloudView =
        mode === "cloud" && user
            ? {
                  userId: user.id,
                  revision: notebook.revision,
                  hydrated: notebook.hydrated,
                  blocked: !ready || notebook.hasUnsaved || !!storageIssue,
                  counts: notebook.hydrated
                      ? {
                            ...notebook.counts,
                            purchaseOrders: purchaseOrders.length,
                            stockAdjustments: stockAdjustments.length,
                            refundRecords: refundRecords.length,
                        }
                      : notebook.counts,
              }
            : undefined;
    const preparePurchase = async (id?: string) => {
        const expected = notebook.revision,
            document = await notebook.ensureHydrated();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (mode === "cloud" && notebook.getRevision() !== expected)
            throw Error("Records changed. Review the latest purchase and try again.");
        if (!id) return null;
        const order = (document.purchaseOrders || []).find((item) => item.id === id);
        if (!order) throw Error("This purchase was removed. Refresh the list.");
        return order;
    };
    const supplierStatement = async (id: string) =>
        setStatementRequest((previous) => ({ id, sequence: (previous?.sequence || 0) + 1 }));
    const prepareExpense = async (expense?: Expense) => {
        if (mode === "cloud" && !notebook.hydrated) {
            const lookup = await notebook.readRecord<Expense>("expenses", expense?.id || "");
            if (!expense && lookup.count >= 10000) throw Error("Expense limit reached.");
            return lookup.record;
        }
        const document = await notebook.ensureHydrated();
        if (!expense) return null;
        const current = (document.expenses || []).find((item) => item.id === expense.id);
        if (!current) throw Error("This expense was removed. Refresh the list.");
        return current;
    };
    const prepareExpenseDelete = async (expense: Expense) => {
        const current = await prepareExpense(expense);
        if (canonicalJson(current) !== canonicalJson(expense))
            throw Error("This expense changed. Review the latest entry before deleting.");
    };
    const ordersImport = async () => {
        try {
            if (mode !== "cloud" || notebook.hydrated) await notebook.ensureHydrated();
            setImportOpen((value) => !value);
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not open order import.");
        }
    };
    const orderDetails = async (order: Order) => {
        if (mode === "cloud" && !notebook.hydrated) {
            setDetailOrder(order.id);
            return;
        }
        try {
            const document = await notebook.ensureHydrated();
            if (!(document.orders as Order[]).some((item) => item.id === order.id))
                throw Error("This order was removed. Refresh the list.");
            setDetailOrder(order.id);
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not open this order.");
        }
    };
    const orderAction = async (selected: Order[], action: "Completed" | "Cancelled") => {
        if (!ready || notebook.hasUnsaved || storageIssue) return false;
        try {
            if (mode === "cloud" && !notebook.hydrated) {
                await notebook.saveOrder({
                    kind: "transition",
                    id: crypto.randomUUID(),
                    input: { action },
                    expected: selected,
                });
                setToast(
                    `${selected.length} order line${selected.length === 1 ? "" : "s"} ${action.toLowerCase()}. ${action === "Cancelled" ? "Only reserved manual stock was restored." : "Stock is unchanged."}`,
                );
                return true;
            }
            const document = await notebook.ensureHydrated(),
                current = document.orders as Order[];
            if (
                selected.some(
                    (order) =>
                        canonicalJson(current.find((item) => item.id === order.id)) !==
                        canonicalJson(order),
                )
            )
                throw Error(
                    "Some selected orders changed. Review the latest list and select them again.",
                );
            const result = transitionOrders(
                current,
                document.products as Product[],
                selected.map((order) => order.id),
                action,
            );
            setOrders(result.orders);
            setProducts(result.products);
            setToast(
                `${result.count} order line${result.count === 1 ? "" : "s"} ${action.toLowerCase()}. ${action === "Cancelled" ? "Only reserved manual stock was restored." : "Stock is unchanged."}`,
            );
            return true;
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not update these orders.");
            return false;
        }
    };
    const inventoryImport = async () => {
        try {
            if (mode !== "cloud" || notebook.hydrated) await notebook.ensureHydrated();
            setInventoryImportOpen((value) => !value);
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not open inventory import.");
        }
    };
    const inventoryTool = async (selector: string, productId?: string) => {
        try {
            if (
                selector !== ".stock-adjustments" &&
                selector !== "#product-attachments" &&
                selector !== ".restock-plan"
            )
                await notebook.ensureHydrated();
            if (productId) setAttachmentProduct(productId);
            setTimeout(() => {
                const panel = document.querySelector<HTMLDetailsElement>(selector);
                if (panel) {
                    panel.open = true;
                    panel.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 0);
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not open inventory tools.");
        }
    };
    const exportSaved = async (kind: string, filters: Record<string, string> = {}) => {
        if (!user || notebook.hasUnsaved || storageIssue) return;
        try {
            await downloadNotebookFile(
                "/api/notebook/export?" +
                    new URLSearchParams({
                        kind,
                        revision: String(notebook.revision),
                        period,
                        channel,
                        from: customFrom,
                        to: customTo,
                        ...filters,
                    }),
                user.id,
            );
        } catch (e) {
            setToast(e instanceof Error ? e.message : "Could not export these records.");
        }
    };

    useEffect(() => {
        const query = new URLSearchParams(location.search);
        const marketplace = query.get("marketplace");
        if (marketplace) {
            setPage("Orders");
            setToast(
                marketplace.endsWith("-connected")
                    ? "Account authorized. Direct order sync for this platform is coming soon."
                    : "Authorization did not finish. Please try connecting again.",
            );
            query.delete("marketplace");
            history.replaceState(
                null,
                "",
                location.pathname + (query.size ? "?" + query.toString() : ""),
            );
        }
        const result = query.get("shopee");
        if (result) {
            setPage("Orders");
            setToast(
                result === "connected"
                    ? "Shopee shop connected. You can now fetch orders for review."
                    : "Shopee authorization did not finish. Please try connecting again.",
            );
            query.delete("shopee");
            history.replaceState(
                null,
                "",
                location.pathname + (query.size ? "?" + query.toString() : ""),
            );
        }
    }, []);

    async function save(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        const num = (k: string) => Number(d.get(k));

        if (modal === "product") {
            const name = String(d.get("name")).trim(),
                sku = String(d.get("sku")).trim();
            if (!name || !sku) {
                setError("Enter a product name and SKU.");
                return;
            }
            if (
                products.some(
                    (p) => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== editing?.id,
                )
            ) {
                setError("That SKU already exists. Use a unique SKU.");
                return;
            }

            const p: Product = {
                id: editing?.id || productDraftId.current,
                name,
                sku,
                category: String(d.get("category")),
                cost: num("cost"),
                price: num("price"),
                stock: editing
                    ? (products.find((item) => item.id === editing.id)?.stock ?? editing.stock)
                    : num("stock"),
                reorderPoint: num("reorderPoint"),
                targetStock: num("targetStock"),
                color: editing?.color || "#e2e9df",
                symbol: editing?.symbol || "📦",
            };

            if (
                !Number.isSafeInteger(p.reorderPoint) ||
                p.reorderPoint! < 0 ||
                p.reorderPoint! >= 10000000 ||
                !Number.isSafeInteger(p.targetStock) ||
                p.targetStock! <= p.reorderPoint! ||
                p.targetStock! > 10000000
            ) {
                setError("Use whole stock levels with the target above the alert level.");
                return;
            }

            if (
                [p.cost, p.price, p.stock].some((v) => !Number.isFinite(v) || v < 0) ||
                !Number.isInteger(p.stock)
            ) {
                setError("Use valid positive prices and a whole stock quantity.");
                return;
            }
            if (mode === "cloud" && !notebook.hydrated) {
                try {
                    await notebook.saveRecord("products", p, editing);
                } catch (e) {
                    setError(e instanceof Error ? e.message : "Could not save this product.");
                    return;
                }
            } else
                setProducts((old) =>
                    editing ? old.map((x) => (x.id === p.id ? p : x)) : [...old, p],
                );
            notify(editing ? "Product updated" : "Product added");
        } else {
            const p = products.find((p) => p.id === d.get("product"));
            const quantity = num("quantity");
            if (!p || !Number.isInteger(quantity) || quantity < 1 || quantity > p.stock) {
                setError("Choose a product and a quantity within available stock.");
                return;
            }

            const customer = String(d.get("customer")).trim();
            if (!customer) {
                setError("Enter the customer name.");
                return;
            }

            const order: Order = {
                id: `SD-${Date.now().toString().slice(-7)}`,
                productId: p.id,
                productName: p.name,
                customer,
                channel: String(d.get("channel")),
                quantity,
                price: p.price,
                cost: p.cost,
                fee: num("fee"),
                packaging: num("packaging"),
                shipping: num("shipping"),
                date: String(d.get("date")),
                status: "Processing",
            };

            if (
                [order.fee, order.packaging, order.shipping].some(
                    (v) => !Number.isFinite(v) || v < 0,
                ) ||
                order.fee >= 100
            ) {
                setError("Costs must be nonnegative and fees below 100%.");
                return;
            }

            setOrders((old) => [order, ...old]);
            setProducts((old) =>
                old.map((x) => (x.id === p.id ? { ...x, stock: x.stock - quantity } : x)),
            );
            notify("Order recorded and stock updated");
        }
        setModal(null);
    }

    function changeOrderStatuses(ids: string[], action: "Completed" | "Cancelled") {
        try {
            if (!ready || notebook.hasUnsaved || storageIssue)
                throw Error("Wait for current changes to finish saving.");
            const result = transitionOrders(orders, products, ids, action);
            setOrders(result.orders);
            setProducts(result.products);
            notify(
                `${result.count} order line${result.count === 1 ? "" : "s"} ${action.toLowerCase()}. ${action === "Cancelled" ? "Only reserved manual stock was restored." : "Stock is unchanged."}`,
            );
            return true;
        } catch (e) {
            notify(e instanceof Error ? e.message : "Could not update these orders.");
            return false;
        }
    }

    function cancelOrder(order: Order) {
        changeOrderStatuses([order.id], "Cancelled");
    }

    function importOrders(incoming: Order[]) {
        setOrders((old) => {
            const ids = new Set(old.map((o) => o.id));
            const charged = new Set(
                old
                    .filter((o) => o.sourceOrderId)
                    .map((o) => o.channel + "|" + o.sourceOrderId!.toUpperCase()),
            );
            const fresh = incoming
                .filter((o) => !ids.has(o.id))
                .map((o) => {
                    const key = o.channel + "|" + o.sourceOrderId!.toUpperCase();
                    const already = charged.has(key);
                    charged.add(key);
                    return {
                        ...o,
                        packaging: already ? 0 : o.packaging,
                        shipping: already ? 0 : o.shipping,
                    };
                });
            return [...fresh, ...old];
        });
        notify("Marketplace order history added. Saving your notebook…");
    }

    function applyStockChange(change: StockAdjustment) {
        const current = products.find((product) => product.id === change.productId);
        if (!current || current.stock !== change.before)
            throw Error("Stock changed. Reselect the product and try again.");
        setProducts((old) =>
            old.map((product) =>
                product.id === change.productId ? { ...product, stock: change.after } : product,
            ),
        );
        setStockAdjustments((old) => [change, ...old]);
        notify("Stock adjustment recorded. Saving your notebook…");
    }

    function importProducts(incoming: Product[]) {
        setProducts((old) => {
            const skus = new Set(old.map((product) => product.sku.trim().toLowerCase()));
            return [
                ...old,
                ...incoming.filter((product) => {
                    const sku = product.sku.trim().toLowerCase();
                    if (skus.has(sku)) return false;
                    skus.add(sku);
                    return true;
                }),
            ];
        });
        notify("New products added. Saving your notebook…");
    }

    function exportInventory() {
        if (mode === "cloud") {
            void exportSaved("inventory", { search });
            return;
        }
        const rows = [
            [
                "Product name",
                "SKU",
                "Unit cost",
                "Selling price",
                "Stock",
                "Category",
                "Currency",
                "Reorder point",
                "Target stock",
            ],
            ...products
                .filter((product) =>
                    (product.name + " " + product.sku).toLowerCase().includes(search.toLowerCase()),
                )
                .map((product) => [
                    product.name,
                    product.sku,
                    product.cost,
                    product.price,
                    product.stock,
                    product.category,
                    "PHP",
                    stockTargets(product).reorderPoint,
                    stockTargets(product).targetStock,
                ]),
        ];
        const csv = rows
            .map((row) =>
                row
                    .map(
                        (value) =>
                            '"' +
                            (typeof value === "number"
                                ? String(value)
                                : String(value).replace(/^[=+@-]/, "'$&")
                            ).replaceAll('"', '""') +
                            '"',
                    )
                    .join(","),
            )
            .join("\r\n");
        const url = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "inventory-products.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    function exportOrders() {
        if (mode === "cloud") {
            void exportSaved("orders", { search, status: orderStatus, sort: orderSort });
            return;
        }
        const rows = [
            [
                "Order",
                "Customer",
                "Product",
                "Channel",
                "Quantity",
                "Revenue",
                "Profit",
                "Status",
                "Date",
            ],
            ...(page === "Orders" ? shownOrders : filtered).map((o) => [
                o.sourceOrderId || o.id,
                o.customer,
                o.productName,
                o.channel,
                o.quantity,
                orderTotals(o).revenue,
                orderTotals(o).profit.toFixed(2),
                o.status,
                o.date,
            ]),
        ];
        const csv = rows
            .map((row) =>
                row
                    .map(
                        (v) =>
                            '"' +
                            String(v)
                                .replace(/^[=+@-]/, "'$&")
                                .replaceAll('"', '""') +
                            '"',
                    )
                    .join(","),
            )
            .join("\r\n");
        const url = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "sellers-notebook-orders.csv";
        a.click();
        URL.revokeObjectURL(url);
        notify("Orders exported");
    }

    const estimate = pricing(
        calc.cost,
        calc.packaging,
        calc.shipping,
        calc.fee,
        calc.margin,
        calc.tax,
    );
    const roundedPrice = estimate ? Math.ceil(estimate.price) : 0,
        roundedFees = Math.round(roundedPrice * calc.fee) / 100,
        roundedTaxes = Math.round(roundedPrice * calc.tax) / 100;
    const result = estimate
        ? {
              ...estimate,
              price: roundedPrice,
              fees: roundedFees,
              taxes: roundedTaxes,
              profit: roundedPrice - estimate.base - roundedFees - roundedTaxes,
          }
        : null;

    const chart =
        mode === "cloud" ? serverReport.data?.chart || [] : revenueBuckets(filtered, range);
    const max = Math.max(...chart.map((bucket) => bucket.revenue), 1000);

    async function exportSummary() {
        if (mode === "cloud" && user) {
            try {
                await downloadNotebookFile(
                    "/api/notebook/summary?" +
                        new URLSearchParams({
                            revision: String(notebook.revision),
                            period,
                            channel,
                            from: customFrom,
                            to: customTo,
                        }),
                    user.id,
                );
            } catch (e) {
                notify(e instanceof Error ? e.message : "Could not export summary.");
            }
            return;
        }
        const rows = [
            ["Report", "Business summary"],
            ["Business", branding?.businessName || user?.name || "My business"],
            ["From", range.from],
            ["Through", range.to],
            ["Channel", channel],
            ["Revenue", Number(summary.revenue.toFixed(2))],
            ["Order costs", Number(summary.orderCosts.toFixed(2))],
            ["Order profit", Number(summary.orderProfit.toFixed(2))],
            ["Recorded refunds", refunds],
            ["Revenue after refunds", Number((summary.revenue - refunds).toFixed(2))],
            ["Additional overhead", Number(summary.overhead.toFixed(2))],
            ["Estimated net profit", Number(summary.netProfit.toFixed(2))],
            ["Currency", "PHP"],
            ["Completed order lines", reportCounts.completed],
            [
                "Notes",
                "Excludes taxes, unrecorded costs, and settlement timing. Refunds follow their recorded refund date. Channel views exclude whole-business overhead.",
            ],
        ];
        const csv = rows
            .map((row) =>
                row
                    .map(
                        (value) =>
                            '"' +
                            (typeof value === "number"
                                ? String(value)
                                : String(value).replace(/^[=+@-]/, "'$&")
                            ).replaceAll('"', '""') +
                            '"',
                    )
                    .join(","),
            )
            .join("\r\n");
        const url = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `business-summary-${range.from}-${range.to}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    const shownProducts = products.filter((product) =>
        (product.name + " " + product.sku).toLowerCase().includes(search.toLowerCase()),
    );

    const recordSupplierRefund = (
        id: string,
        input: Omit<PurchasePayment, "id">,
        expected: string,
    ) => {
        try {
            const current = (notebook.getDocument().purchaseOrders || []).find((p) => p.id === id);
            if (!current || purchasePaymentProgress(current) !== expected)
                throw Error("This purchase changed. Reopen refund entry and review its credit.");
            const next = addSupplierRefund(current, input);
            setPurchaseOrders((items) => items.map((p) => (p.id === id ? next : p)));
            return true;
        } catch (e) {
            notify(e instanceof Error ? e.message : "Could not record supplier refund.");
            return false;
        }
    };
    const removeSupplierRefundRecord = (id: string, recordId: string, expected: string) => {
        const current = (notebook.getDocument().purchaseOrders || []).find((p) => p.id === id);
        if (!current || purchasePaymentProgress(current) !== expected) {
            notify("This purchase changed. Review the latest refund records.");
            return;
        }
        setPurchaseOrders((items) =>
            items.map((p) =>
                p.id === id
                    ? {
                          ...p,
                          supplierRefunds: (p.supplierRefunds || []).filter(
                              (record) => record.id !== recordId,
                          ),
                      }
                    : p,
            ),
        );
    };
    const recordPurchasePayment = (
        id: string,
        payment: Omit<PurchasePayment, "id">,
        expected: string,
    ) => {
        try {
            const current = (notebook.getDocument().purchaseOrders || []).find((p) => p.id === id);
            if (!current || purchasePaymentProgress(current) !== expected)
                throw Error("This purchase changed. Reopen payment entry and review its balance.");
            const next = addPurchasePayment(current, payment);
            setPurchaseOrders((items) => items.map((p) => (p.id === id ? next : p)));
            return true;
        } catch (e) {
            notify(e instanceof Error ? e.message : "Could not record payment.");
            return false;
        }
    };
    const removePurchasePaymentRecord = (id: string, paymentId: string, expected: string) => {
        const current = (notebook.getDocument().purchaseOrders || []).find((p) => p.id === id);
        if (!current || purchasePaymentProgress(current) !== expected) {
            notify("This purchase changed. Review the latest payment records.");
            return;
        }
        try {
            const next = removePurchasePayment(current, paymentId);
            setPurchaseOrders((items) => items.map((p) => (p.id === id ? next : p)));
        } catch (e) {
            notify(e instanceof Error ? e.message : "Could not remove payment record.");
        }
    };
    const dueCounts = deliveryCounts(purchaseOrders, today),
        dueNow =
            mode === "cloud"
                ? serverReport.data?.dueNow || 0
                : dueCounts.Overdue + dueCounts["Due today"];
    const inventoryPage = usePagination(shownProducts, search + "|" + mode);

    const shownOrders = filterOrderList(filtered, products, search, orderStatus, orderSort);

    return (
        <div className={sidebarHidden ? "shell sidebar-collapsed" : "shell"}>
            {mobile && (
                <button
                    className="sidebar-backdrop"
                    aria-label="Close sidebar"
                    onClick={closeSidebar}
                />
            )}

            <aside
                id="notebook-sidebar"
                inert={!sidebarOpen}
                className={mobile ? "sidebar open" : "sidebar"}
            >
                <div className="sidebar-heading">
                    <a
                        className="brand"
                        href="#"
                        onClick={async () => go("Overview")}
                    >
                        <span className="brand-mark">
                            <BrandingMark icon={branding?.icon} />
                        </span>
                        <span
                            className={branding ? "brand-title custom-brand-title" : "brand-title"}
                        >
                            {branding ? (
                                branding.notebookTitle
                            ) : (
                                <>
                                    Seller’s
                                    <br />
                                    <span>Notebook</span>
                                </>
                            )}
                        </span>
                    </a>
                    <button
                        className="icon-button sidebar-close"
                        type="button"
                        aria-label="Hide sidebar"
                        title="Hide sidebar"
                        onClick={closeSidebar}
                    >
                        <PanelLeftClose size={18} />
                    </button>
                </div>
                <div className="workspace notebook-identity">
                    <NotebookPen size={19} />
                    <div>
                        <strong>
                            {branding?.businessName ||
                                (mode === "demo" ? "Sample notebook" : "Your business notebook")}
                        </strong>
                        <small>
                            {mode === "demo" ? "Practice pages" : "Private · Just for you"}
                        </small>
                    </div>
                </div>
                <p className="nav-label">in this notebook</p>
                <nav>
                    {tabs.map(({ name, icon: Icon }, index) => (
                        <button
                            key={name}
                            className={page === name ? "nav-item active" : "nav-item"}
                            aria-current={page === name ? "page" : undefined}
                            onClick={async () => go(name)}
                        >
                            <Icon size={19} />
                            {name}
                            <span
                                className="nav-index"
                                aria-hidden="true"
                            >
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            {name === "Inventory" && low.length > 0 && (
                                <span className="nav-count">{low.length}</span>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-note personal-note">
                    <label htmlFor="sidebar-personal-note">
                        <Sprout size={17} />A note to yourself
                    </label>
                    <textarea
                        id="sidebar-personal-note"
                        aria-label="A note to yourself"
                        maxLength={200}
                        disabled={!ready || !!storageIssue}
                        value={sidebarNote}
                        onChange={(e) => setSidebarNote(e.target.value)}
                        placeholder="Small business. Big possibilities. You’ve got this."
                    />
                    <small>
                        {sidebarNote.length}/200 ·{" "}
                        {mode === "demo" ? "This browser" : "Saved with your notebook"}
                    </small>
                </div>
                <div className="sidebar-theme">
                    <ThemeSwitch />
                </div>
                <button
                    type="button"
                    className="profile profile-button"
                    aria-label="Open account and sync settings"
                    onClick={async () => setAccountOpen(true)}
                >
                    <span className="profile-avatar">
                        {user?.image ? (
                            <img
                                src={user.image}
                                alt="Your profile"
                            />
                        ) : (
                            initials
                        )}
                    </span>
                    <span className="profile-details">
                        <strong>{user?.name || "Your account"}</strong>
                        <small>
                            {mode === "cloud" ? "Account & settings" : "Sample workspace"}
                        </small>
                    </span>
                    <UserRound size={17} />
                </button>
            </aside>

            <div className="main-wrap">
                <header className="topbar">
                    <button
                        id="sidebar-toggle"
                        className="sidebar-toggle icon-button"
                        type="button"
                        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                        aria-controls="notebook-sidebar"
                        aria-expanded={sidebarOpen}
                        onClick={async () =>
                            isNarrow ? setMobile(!mobile) : setSidebarHidden(!sidebarHidden)
                        }
                    >
                        {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                    </button>
                    <div className="breadcrumb">
                        {branding?.businessName || "My notebook"} <span>/</span>{" "}
                        <strong>{page}</strong>
                    </div>
                    <div className="notebook-topbar-actions">
                        <NotebookTour
                            key={`${user?.id || "opening"}|${mode}`}
                            ready={ready}
                            userId={user?.id}
                            page={page}
                            blocked={
                                !!(
                                    storageIssue ||
                                    notebook.hasUnsaved ||
                                    modal ||
                                    accountOpen ||
                                    detailOrder ||
                                    financialKind ||
                                    inventoryImportOpen ||
                                    importOpen
                                )
                            }
                            onNavigate={(name) => {
                                setPage(name);
                                setMobile(false);
                            }}
                        />
                        <CursorToggle inline />
                        <span className="top-date">
                            {new Date(today + "T12:00:00Z").toLocaleDateString("en-PH", {
                                month: "long",
                                year: "numeric",
                                timeZone: "Asia/Manila",
                            })}
                        </span>
                    </div>
                </header>

                <main>
                    {mode === "cloud" && user && (
                        <LiveNotebook
                            userId={user.id}
                            onRevision={notebook.acceptRevision}
                        />
                    )}
                    <div className="notebook-caption">
                        <span>
                            {workspaceName}{" "}
                            <span className="page-number">
                                /{" "}
                                {String(tabs.findIndex((t) => t.name === page) + 1).padStart(
                                    2,
                                    "0",
                                )}
                            </span>
                        </span>
                        <span className="auto-save">
                            <Check size={13} />
                            {status}
                        </span>
                    </div>
                    <div className="page-heading">
                        <div>
                            <div className="eyebrow">A LITTLE BUSINESS NOTEBOOK</div>
                            <h1>
                                {page === "Overview"
                                    ? "A little clarity. A lot of possibility."
                                    : page === "Inventory"
                                      ? "Good things, well stocked."
                                      : page === "Orders"
                                        ? "Every order is a little win."
                                        : page === "Expenses"
                                          ? "The little costs count, too."
                                          : page === "Suppliers"
                                            ? "Good people behind good products."
                                            : "Find your sweet spot."}
                            </h1>
                            <p>
                                {page === "Overview"
                                    ? "Here’s how your shop is doing. Let’s make today a good one."
                                    : page === "Inventory"
                                      ? "A home for your products, prices, and stock levels."
                                      : page === "Orders"
                                        ? "Track your sales from first click to completed order."
                                        : page === "Expenses"
                                          ? "Keep track of what it takes to keep your business growing."
                                          : page === "Suppliers"
                                            ? "Contacts, product sources, and delivery lead times, neatly kept."
                                            : "Set prices that cover your costs and leave room to grow."}
                            </p>
                        </div>
                        {page !== "Expenses" && page !== "Suppliers" && (
                            <button
                                className="button primary"
                                disabled={!ready}
                                onClick={async () =>
                                    open(page === "Inventory" ? "product" : "order")
                                }
                            >
                                <Plus size={17} />
                                {page === "Inventory" ? "Add product" : "Record a sale"}
                            </button>
                        )}
                    </div>

                    <div id="notebook-onboarding" />
                    {(mode === "loading" || mode === "error" || notebook.hydrating) && (
                        <section
                            className="account-connection"
                            role="status"
                        >
                            <NotebookPen size={27} />
                            <h2>
                                {mode === "loading" || notebook.hydrating
                                    ? "Opening your notebook…"
                                    : "Let’s reconnect your notebook"}
                            </h2>
                            <p>
                                {notebook.hydrating
                                    ? "Opening the records needed for this tool."
                                    : mode === "loading"
                                      ? "Finding your account and saved pages."
                                      : storageIssue}
                            </p>
                            {mode === "error" && (
                                <button
                                    className="button primary"
                                    onClick={async () => void notebook.reload()}
                                >
                                    Try again
                                </button>
                            )}
                        </section>
                    )}

                    {storageIssue && mode !== "error" && (
                        <div
                            className="notice"
                            role="alert"
                        >
                            <p>{storageIssue}</p>
                            {notebook.conflict ? (
                                <>
                                    <a
                                        className="text-button"
                                        href="/auth/sign-in"
                                    >
                                        Sign in again
                                    </a>
                                    <button
                                        className="text-button"
                                        onClick={async () => {
                                            if (
                                                !notebook.hasUnsaved ||
                                                (await confirmAction(
                                                    "Reload the saved notebook? Unsaved changes on this device will be discarded.",
                                                ))
                                            )
                                                void notebook.reload();
                                        }}
                                    >
                                        Reload saved notebook
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="text-button"
                                    onClick={notebook.retrySave}
                                >
                                    Retry saving
                                </button>
                            )}
                        </div>
                    )}

                    <div
                        className="notebook-content"
                        inert={!ready}
                    >
                        {ready &&
                            reportPending &&
                            !range.error &&
                            (page === "Overview" || page === "Orders" || page === "Expenses") && (
                                <div
                                    className="notice"
                                    role="status"
                                >
                                    <p>
                                        {serverReport.error ||
                                            "Updating your saved business report…"}
                                    </p>
                                    {serverReport.error && (
                                        <button
                                            className="text-button"
                                            onClick={serverReport.retry}
                                        >
                                            Retry report
                                        </button>
                                    )}
                                </div>
                            )}

                        <div className="toolbar">
                            <div className="view-label">
                                <span className="live-dot" />
                                {page === "Overview"
                                    ? "Business overview"
                                    : page === "Inventory"
                                      ? `${mode === "cloud" && !notebook.hydrated ? notebook.counts.products || 0 : products.length} products in your collection`
                                      : page === "Orders"
                                        ? "Your sales ledger"
                                        : page === "Expenses"
                                          ? "The costs behind your business"
                                          : page === "Suppliers"
                                            ? `${mode === "cloud" && !notebook.hydrated ? notebook.counts.suppliers || 0 : suppliers.length} supplier connections`
                                            : "Know your numbers"}
                            </div>
                            {page !== "Pricing calculator" && page !== "Suppliers" && (
                                <div className="filters">
                                    <select
                                        aria-label="Filter channel"
                                        value={channel}
                                        onChange={(e) => setChannel(e.target.value)}
                                    >
                                        {[
                                            "All channels",
                                            "Shopee",
                                            "Lazada",
                                            "TikTok Shop",
                                            "Direct",
                                        ].map((c) => (
                                            <option key={c}>{c}</option>
                                        ))}
                                    </select>
                                    <select
                                        aria-label="Date range"
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value)}
                                    >
                                        <option value="30">Last 30 days</option>
                                        <option value="7">Last 7 days</option>
                                        <option value="90">Last 90 days</option>
                                        <option value="month">This month</option>
                                        <option value="all">All time</option>
                                        <option value="custom">Custom dates</option>
                                    </select>
                                    {page !== "Expenses" && page !== "Suppliers" && (
                                        <button
                                            className="button export"
                                            disabled={
                                                !ready ||
                                                notebook.hasUnsaved ||
                                                !!storageIssue ||
                                                !!range.error ||
                                                (page === "Overview" && reportPending)
                                            }
                                            onClick={
                                                page === "Overview"
                                                    ? exportSummary
                                                    : page === "Inventory"
                                                      ? exportInventory
                                                      : exportOrders
                                            }
                                        >
                                            <Download size={15} />
                                            {page === "Overview" ? "Export summary" : "Export"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {period === "custom" &&
                            page !== "Pricing calculator" &&
                            page !== "Suppliers" && (
                                <div className="report-dates">
                                    <label className="field">
                                        <span>Report from</span>
                                        <input
                                            type="date"
                                            value={customFrom}
                                            max={customTo || today}
                                            onChange={(e) => setCustomFrom(e.target.value)}
                                        />
                                    </label>
                                    <label className="field">
                                        <span>Report through</span>
                                        <input
                                            type="date"
                                            value={customTo}
                                            min={customFrom}
                                            max={today}
                                            onChange={(e) => setCustomTo(e.target.value)}
                                        />
                                    </label>
                                    {range.error && (
                                        <p
                                            className="auth-error"
                                            role="alert"
                                        >
                                            {range.error}
                                        </p>
                                    )}
                                </div>
                            )}

                        {(page === "Inventory" || page === "Suppliers") && (
                            <NotebookPageOverview
                                kind={page}
                                userId={mode === "cloud" ? user?.id : undefined}
                                revision={notebook.revision}
                                ready={ready && !notebook.hasUnsaved && !storageIssue}
                                products={products}
                                suppliers={suppliers}
                                purchases={purchaseOrders}
                                today={today}
                            />
                        )}
                        {page === "Overview" && !reportPending && (
                            <>
                                {dueNow > 0 && (
                                    <button
                                        type="button"
                                        className="delivery-attention"
                                        onClick={() => {
                                            go("Suppliers");
                                            setDeliveryOpenRequest((value) => value + 1);
                                        }}
                                    >
                                        {dueNow} {dueNow === 1 ? "delivery is" : "deliveries are"}{" "}
                                        due or overdue · Review deliveries
                                        <ArrowRight size={15} />
                                    </button>
                                )}

                                <div className="stats">
                                    <Stat
                                        label="Total revenue"
                                        value={money(revenue)}
                                        detail="From completed orders"
                                        icon="revenue"
                                    />
                                    <Stat
                                        label="Estimated net profit"
                                        value={money(summary.netProfit)}
                                        detail={
                                            revenue
                                                ? `${((summary.netProfit / revenue) * 100).toFixed(1)}% after refunds & overhead`
                                                : "No completed sales in this view"
                                        }
                                        icon={summary.netProfit < 0 ? "loss" : "profit"}
                                    />
                                    <Stat
                                        label="Orders received"
                                        value={String(reportCounts.received)}
                                        detail={`${reportCounts.processing} awaiting completion`}
                                        icon="orders"
                                    />
                                    <Stat
                                        label="Inventory value"
                                        value={money(reportInventory.value)}
                                        detail={`${reportInventory.units} items across ${reportInventory.products} products`}
                                        icon="stock"
                                    />
                                </div>

                                <p className="profit-context">
                                    Order profit {money(summary.orderProfit)} − refunds{" "}
                                    {money(refunds)} − overhead {money(summary.overhead)} =
                                    estimated net profit {money(summary.netProfit)}.{" "}
                                    {channel !== "All channels"
                                        ? "Whole-business expenses are excluded from this channel view."
                                        : "Includes whole-business and channel expenses in this date range."}{" "}
                                    Refunds follow their refund date; original costs and fees are
                                    retained.{" "}
                                    <button
                                        className="text-button"
                                        onClick={async () => go("Expenses")}
                                    >
                                        Review expenses
                                        <ArrowRight size={13} />
                                    </button>
                                </p>

                                <div className="chart-row">
                                    <CollapsibleCard
                                        className="sales-card"
                                        title={<>Sales performance</>}
                                        description={<> A little progress, every day. </>}
                                        actions={
                                            <>
                                                {" "}
                                                <span className="legend">
                                                    <i />
                                                    Revenue
                                                </span>{" "}
                                            </>
                                        }
                                    >
                                        <div className="chart">
                                            <div className="y-axis">
                                                {[1, 0.75, 0.5, 0.25, 0].map((v) => (
                                                    <span key={v}>{money(max * v)}</span>
                                                ))}
                                            </div>
                                            <div className="plot">
                                                <div className="grid-lines">
                                                    {[0, 1, 2, 3, 4].map((i) => (
                                                        <i key={i} />
                                                    ))}
                                                </div>
                                                <div className="bars">
                                                    {chart.map((bucket, i) => (
                                                        <div
                                                            className="bar-column"
                                                            key={i}
                                                        >
                                                            <div
                                                                className="bar"
                                                                style={{
                                                                    height: `${(bucket.revenue / max) * 95}%`,
                                                                }}
                                                            >
                                                                <span>
                                                                    {bucket.from} – {bucket.to}:{" "}
                                                                    {money(bucket.revenue)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="x-axis">
                                                    {chart
                                                        .filter(
                                                            (_, i) =>
                                                                i === 0 ||
                                                                i === chart.length - 1 ||
                                                                i %
                                                                    Math.max(
                                                                        1,
                                                                        Math.ceil(chart.length / 4),
                                                                    ) ===
                                                                    0,
                                                        )
                                                        .map((bucket) => (
                                                            <span key={bucket.from}>
                                                                {new Date(
                                                                    bucket.from + "T12:00:00Z",
                                                                ).toLocaleDateString("en-PH", {
                                                                    month: "short",
                                                                    day: "numeric",
                                                                    timeZone: "Asia/Manila",
                                                                })}
                                                            </span>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="chart-footer">
                                            <span>
                                                <span className="sparkle">✦</span> Small steps add
                                                up. Keep showing up.
                                            </span>
                                            <span>
                                                {range.from} – {range.to}
                                            </span>
                                        </div>
                                    </CollapsibleCard>

                                    <CollapsibleCard
                                        className="channels-card"
                                        title={<>Where you’re selling</>}
                                        description={<> Your sales, across channels. </>}
                                        actions={
                                            <>
                                                {" "}
                                                <ShoppingBag
                                                    size={18}
                                                    className="muted"
                                                />{" "}
                                            </>
                                        }
                                    >
                                        <div className="channel-total">
                                            <span>Total revenue</span>
                                            <strong>{money(revenue)}</strong>
                                        </div>
                                        <div className="channel-stack">
                                            {["Shopee", "Lazada", "TikTok Shop", "Direct"].map(
                                                (c) => {
                                                    const val = channelValue(c);
                                                    return (
                                                        <div
                                                            key={c}
                                                            className={channelClass(c)}
                                                            style={{
                                                                width: `${revenue ? (val / revenue) * 100 : 25}%`,
                                                            }}
                                                        />
                                                    );
                                                },
                                            )}
                                        </div>
                                        <div className="channel-list">
                                            {["Shopee", "Lazada", "TikTok Shop", "Direct"].map(
                                                (c) => {
                                                    const val = channelValue(c);
                                                    return (
                                                        <div key={c}>
                                                            <span>
                                                                <i className={channelClass(c)} />
                                                                {c}
                                                            </span>
                                                            <strong>{money(val)}</strong>
                                                            <small>
                                                                {revenue
                                                                    ? Math.round(
                                                                          (val / revenue) * 100,
                                                                      )
                                                                    : 0}
                                                                %
                                                            </small>
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    </CollapsibleCard>
                                </div>

                                <div className="bottom-row">
                                    <CollapsibleCard
                                        className="orders-card"
                                        collapsible={false}
                                        title={
                                            <>
                                                Recent orders{" "}
                                                <span className="count-pill">
                                                    {reportCounts.all}
                                                </span>
                                            </>
                                        }
                                        description={<> Good things are heading out the door. </>}
                                        actions={
                                            <>
                                                {" "}
                                                <button
                                                    className="text-button"
                                                    onClick={async () => go("Orders")}
                                                >
                                                    View all orders
                                                    <ArrowRight size={15} />
                                                </button>{" "}
                                            </>
                                        }
                                    >
                                        <OrderTable
                                            orders={recentReportOrders}
                                            compact
                                        />
                                    </CollapsibleCard>
                                    <CollapsibleCard
                                        className="low-card"
                                        collapsible={false}
                                        title="Running a little low"
                                        description={<> A heads-up before you sell out. </>}
                                        actions={
                                            <>
                                                {" "}
                                                <span className="count-pill warm">
                                                    {reportLowCount}
                                                </span>{" "}
                                            </>
                                        }
                                    >
                                        {reportLowCount ? (
                                            reportLow.map((p) => (
                                                <div
                                                    className="low-product"
                                                    key={p.id}
                                                >
                                                    <ProductThumb p={p} />
                                                    <div>
                                                        <strong>{p.name}</strong>
                                                        <small>{p.sku}</small>
                                                    </div>
                                                    <span className="stock-pill">
                                                        {p.stock} left
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty">
                                                All stocked up. Looking good!
                                            </div>
                                        )}
                                        <button
                                            className="restock-button"
                                            onClick={async () => go("Inventory")}
                                        >
                                            Manage inventory
                                            <ArrowRight size={15} />
                                        </button>
                                        <div className="tip">
                                            <Sprout size={19} />
                                            <p>
                                                A stocked shelf is a happy shop.
                                                <br />
                                                <strong>
                                                    Give your bestsellers a little love.
                                                </strong>
                                            </p>
                                        </div>
                                    </CollapsibleCard>
                                </div>
                            </>
                        )}

                        {page === "Inventory" && inventoryImportOpen && (
                            <InventoryImport
                                cloud={
                                    mode === "cloud" && !notebook.hydrated ? cloudView : undefined
                                }
                                onSave={notebook.saveInventoryImport}
                                products={products}
                                onImport={importProducts}
                                onClose={() => setInventoryImportOpen(false)}
                                disabled={notebook.hasUnsaved || !!storageIssue}
                            />
                        )}

                        {page === "Inventory" && mode === "cloud" && user && (
                            <CloudInventory
                                userId={user.id}
                                revision={notebook.revision}
                                search={search}
                                onSearch={setSearch}
                                onEdit={(product) => void open("product", product)}
                                onFiles={(id) => void inventoryTool("#product-attachments", id)}
                                onImport={() => void inventoryImport()}
                                disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                            />
                        )}
                        {page === "Inventory" && mode !== "cloud" && (
                            <CollapsibleCard
                                className="inventory-card"
                                title={<>Product collection</>}
                                description={<> Click a product to edit or restock it. </>}
                                actions={
                                    <>
                                        {" "}
                                        <div className="order-tools">
                                            <button
                                                className="button secondary"
                                                onClick={async () =>
                                                    setInventoryImportOpen(!inventoryImportOpen)
                                                }
                                            >
                                                Import inventory CSV
                                            </button>
                                            <label className="search">
                                                <Search size={17} />
                                                <input
                                                    placeholder="Search products…"
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                />
                                            </label>
                                        </div>{" "}
                                    </>
                                }
                            >
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Category</th>
                                                <th>Unit cost</th>
                                                <th>Selling price</th>
                                                <th>Stock</th>
                                                <th />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inventoryPage.items.map((p) => (
                                                <tr key={p.id}>
                                                    <td>
                                                        <div className="product-cell">
                                                            <ProductThumb p={p} />
                                                            <div>
                                                                <strong>{p.name}</strong>
                                                                <small>{p.sku}</small>
                                                                {suppliers.some((s) =>
                                                                    s.productIds.includes(p.id),
                                                                ) && (
                                                                    <small>
                                                                        Supplier:{" "}
                                                                        {suppliers
                                                                            .filter((s) =>
                                                                                s.productIds.includes(
                                                                                    p.id,
                                                                                ),
                                                                            )
                                                                            .map((s) => s.name)
                                                                            .join(", ")}
                                                                    </small>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>{p.category}</td>
                                                    <td>{money(p.cost)}</td>
                                                    <td className="amount">{money(p.price)}</td>
                                                    <td>
                                                        <span
                                                            className={
                                                                p.stock <=
                                                                stockTargets(p).reorderPoint
                                                                    ? "stock-pill"
                                                                    : "status completed"
                                                            }
                                                        >
                                                            {p.stock} in stock
                                                        </span>
                                                        <small>
                                                            Alert at {stockTargets(p).reorderPoint}{" "}
                                                            · Target {stockTargets(p).targetStock}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button
                                                                className="text-button"
                                                                onClick={async () =>
                                                                    open("product", p)
                                                                }
                                                            >
                                                                Edit
                                                                <ArrowUpRight size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {!products.some((p) =>
                                        (p.name + " " + p.sku)
                                            .toLowerCase()
                                            .includes(search.toLowerCase()),
                                    ) && (
                                        <div className="empty">
                                            No products found. Try a different search.
                                        </div>
                                    )}
                                </div>
                                <Pagination
                                    label="Inventory"
                                    {...inventoryPage}
                                />
                            </CollapsibleCard>
                        )}

                        {page === "Inventory" && cloudView && !notebook.hydrated && (
                            <CloudRestock
                                onAdjustStock={() => setStockEntryRequest((value) => value + 1)}
                                cloud={cloudView}
                                onSave={notebook.savePurchase}
                                onCreated={() => go("Suppliers")}
                                disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                            />
                        )}
                        {page === "Inventory" && notebook.hydrated && (
                            <RestockPlan
                                onAdjustStock={() => setStockEntryRequest((value) => value + 1)}
                                products={products}
                                suppliers={suppliers}
                                orders={purchaseOrders}
                                disabled={
                                    !ready ||
                                    notebook.hasUnsaved ||
                                    !!storageIssue ||
                                    purchaseOrders.length >= 3000
                                }
                                onPurchase={(supplierId, productIds) => {
                                    try {
                                        const purchaseDraft = restockPurchaseDraft(
                                            suppliers.find((item) => item.id === supplierId),
                                            products,
                                            purchaseOrders,
                                            productIds,
                                        );
                                        go("Suppliers");
                                        setQuickRequest({
                                            kind: "purchase",
                                            sequence: ++quickSequence.current,
                                            purchaseDraft,
                                        });
                                    } catch (e) {
                                        notify(
                                            e instanceof Error
                                                ? e.message
                                                : "Could not prepare purchase.",
                                        );
                                    }
                                }}
                            />
                        )}

                        {page === "Inventory" && (
                            <StockAdjustments
                                openRequest={stockEntryRequest}
                                onSaveTargeted={
                                    mode === "cloud" && !notebook.hydrated
                                        ? notebook.saveStock
                                        : undefined
                                }
                                cloud={cloudView}
                                prepareEntry={() => notebook.ensureHydrated()}
                                products={products}
                                history={stockAdjustments}
                                onApply={applyStockChange}
                                disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                            />
                        )}

                        {page === "Inventory" && mode === "cloud" && user && (
                            <NotebookAttachments
                                revision={notebook.revision}
                                userId={user.id}
                                products={products}
                                selectedProduct={attachmentProduct}
                                onSelectProduct={setAttachmentProduct}
                                disabled={notebook.hasUnsaved || !!storageIssue}
                            />
                        )}

                        {page === "Orders" && (
                            <>
                                {importOpen && (
                                    <ShopeeImport
                                        cloud={
                                            mode === "cloud" && !notebook.hydrated
                                                ? cloudView
                                                : undefined
                                        }
                                        onSave={notebook.saveMarketplaceImport}
                                        fetched={shopeeFetched}
                                        products={products}
                                        orders={orders}
                                        onImport={importOrders}
                                        onClose={() => {
                                            setImportOpen(false);
                                            setShopeeFetched(null);
                                        }}
                                        disabled={notebook.hasUnsaved || !!storageIssue}
                                    />
                                )}
                                {!reportPending && (
                                    <div className="stats three">
                                        <Stat
                                            label="Revenue"
                                            value={money(revenue)}
                                            detail="Completed orders only"
                                            icon="revenue"
                                        />
                                        <Stat
                                            label="Estimated expenses"
                                            value={money(summary.orderCosts)}
                                            detail="Product costs, fees, packaging & shipping"
                                            icon="stock"
                                        />
                                        <Stat
                                            label="Estimated profit"
                                            value={money(summary.orderProfit - refunds)}
                                            detail="After recorded costs and period refunds"
                                            icon="profit"
                                        />
                                    </div>
                                )}
                                {mode === "cloud" && user ? (
                                    <CloudOrders
                                        userId={user.id}
                                        revision={notebook.revision}
                                        period={period}
                                        channel={channel}
                                        from={customFrom}
                                        to={customTo}
                                        search={search}
                                        status={orderStatus}
                                        sort={orderSort}
                                        onSearch={setSearch}
                                        onStatus={setOrderStatus}
                                        onSort={setOrderSort}
                                        onImport={() => void ordersImport()}
                                        disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                                        renderTable={(rows, paging, key) => (
                                            <OrderTable
                                                key={key}
                                                orders={rows}
                                                serverPaging={paging}
                                                onComplete={(order) =>
                                                    void orderAction([order], "Completed")
                                                }
                                                onCancel={(order) =>
                                                    void orderAction([order], "Cancelled")
                                                }
                                                onBulk={(ids, action) =>
                                                    orderAction(
                                                        rows.filter((order) =>
                                                            ids.includes(order.id),
                                                        ),
                                                        action,
                                                    )
                                                }
                                                onDetails={(order) => void orderDetails(order)}
                                                disabled={
                                                    !ready || notebook.hasUnsaved || !!storageIssue
                                                }
                                            />
                                        )}
                                    />
                                ) : (
                                    <CollapsibleCard
                                        className=""
                                        title={<>All orders</>}
                                        description={
                                            <>
                                                {" "}
                                                Manual sales reserve stock. Imported history
                                                preserves current stock.{" "}
                                            </>
                                        }
                                        actions={
                                            <>
                                                {" "}
                                                <div className="order-tools">
                                                    <button
                                                        className="button secondary"
                                                        onClick={async () =>
                                                            setImportOpen(!importOpen)
                                                        }
                                                    >
                                                        Import orders CSV
                                                    </button>
                                                    <label className="search">
                                                        <Search size={17} />
                                                        <input
                                                            aria-label="Search orders"
                                                            placeholder="Customer, order ID, SKU…"
                                                            value={search}
                                                            onChange={(e) =>
                                                                setSearch(e.target.value)
                                                            }
                                                        />
                                                    </label>
                                                </div>{" "}
                                            </>
                                        }
                                    >
                                        <div className="order-list-controls">
                                            <label className="field">
                                                <span>Order status</span>
                                                <select
                                                    aria-label="Order status filter"
                                                    value={orderStatus}
                                                    onChange={(e) => setOrderStatus(e.target.value)}
                                                >
                                                    {[
                                                        "All statuses",
                                                        "Processing",
                                                        "Completed",
                                                        "Cancelled",
                                                    ].map((status) => (
                                                        <option key={status}>{status}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className="field">
                                                <span>Sort orders</span>
                                                <select
                                                    aria-label="Sort orders"
                                                    value={orderSort}
                                                    onChange={(e) => setOrderSort(e.target.value)}
                                                >
                                                    <option value="newest">Newest first</option>
                                                    <option value="oldest">Oldest first</option>
                                                    <option value="value">Highest value</option>
                                                </select>
                                            </label>
                                            <small>
                                                {shownOrders.length} order lines shown · filters
                                                apply to the list and order export
                                            </small>
                                        </div>
                                        <OrderTable
                                            key={[
                                                channel,
                                                period,
                                                customFrom,
                                                customTo,
                                                search,
                                                orderStatus,
                                                orderSort,
                                            ].join("|")}
                                            orders={shownOrders}
                                            onComplete={(o) => {
                                                changeOrderStatuses([o.id], "Completed");
                                            }}
                                            onCancel={cancelOrder}
                                            onBulk={changeOrderStatuses}
                                            onDetails={(order) => setDetailOrder(order.id)}
                                            disabled={
                                                !ready || notebook.hasUnsaved || !!storageIssue
                                            }
                                        />
                                    </CollapsibleCard>
                                )}
                                {cloudView && (
                                    <RefundHistory
                                        cloud={cloudView}
                                        onOpen={async (id) => {
                                            try {
                                                if (mode === "cloud" && !notebook.hydrated) {
                                                    setDetailOrder(id);
                                                    return;
                                                }
                                                const data = await notebook.ensureHydrated();
                                                if (
                                                    !(data.orders as Order[]).some(
                                                        (order) => order.id === id,
                                                    )
                                                )
                                                    throw Error("Order no longer exists.");
                                                setDetailOrder(id);
                                            } catch (e) {
                                                notify(
                                                    e instanceof Error
                                                        ? e.message
                                                        : "Could not open order.",
                                                );
                                            }
                                        }}
                                    />
                                )}
                                {!accountOpen && (
                                    <MarketplaceConnections
                                        userId={mode === "cloud" ? user?.id : undefined}
                                        disabled={notebook.hasUnsaved || !!storageIssue}
                                        onOrders={(data) => {
                                            setShopeeFetched(data);
                                            setImportOpen(true);
                                        }}
                                    />
                                )}
                            </>
                        )}

                        {(page === "Expenses" || quickRequest?.kind === "expense") && (
                            <>
                                {page === "Expenses" && !reportPending && (
                                    <>
                                        <div className="stats three">
                                            <Stat
                                                label="Order profit"
                                                value={money(summary.orderProfit)}
                                                detail="Completed sales after their recorded order costs"
                                                icon="profit"
                                            />
                                            <Stat
                                                label="Recorded overhead"
                                                value={money(summary.overhead)}
                                                detail="Additional costs in the selected period and channel"
                                                icon="stock"
                                            />
                                            <Stat
                                                label="Estimated net profit"
                                                value={money(summary.netProfit)}
                                                detail="Order profit minus overhead and period refunds"
                                                icon={summary.netProfit < 0 ? "loss" : "profit"}
                                            />
                                        </div>
                                        <p className="profit-context">
                                            {channel === "All channels"
                                                ? "Whole-business costs and channel costs are included."
                                                : "Only costs assigned to this channel are included. Whole-business costs are not allocated across channels."}{" "}
                                            Recorded refunds in this period: {money(refunds)}. These
                                            estimates exclude taxes and unrecorded costs.
                                        </p>
                                    </>
                                )}
                                <div id="expense-editor">
                                    {mode === "cloud" && user ? (
                                        <CloudExpenses
                                            userId={user.id}
                                            revision={notebook.revision}
                                            period={period}
                                            channel={channel}
                                            from={customFrom}
                                            to={customTo}
                                            renderLedger={(view) => (
                                                <ExpenseLedger
                                                    targeted={
                                                        mode === "cloud" && !notebook.hydrated
                                                    }
                                                    serverView={view}
                                                    prepareEntry={prepareExpense}
                                                    prepareDelete={prepareExpenseDelete}
                                                    onExport={
                                                        mode === "cloud"
                                                            ? (search, category) =>
                                                                  void exportSaved("expenses", {
                                                                      search,
                                                                      category,
                                                                  })
                                                            : undefined
                                                    }
                                                    editorOnly={page !== "Expenses"}
                                                    quickRequest={quickRequest}
                                                    viewKey={[
                                                        channel,
                                                        period,
                                                        customFrom,
                                                        customTo,
                                                    ].join("|")}
                                                    allExpenses={businessExpenses}
                                                    expenses={filteredExpenses}
                                                    onSave={saveExpense}
                                                    onDelete={deleteExpense}
                                                    disabled={
                                                        !ready ||
                                                        notebook.hasUnsaved ||
                                                        !!storageIssue
                                                    }
                                                />
                                            )}
                                        />
                                    ) : (
                                        <ExpenseLedger
                                            onExport={
                                                mode === "cloud"
                                                    ? (search, category) =>
                                                          void exportSaved("expenses", {
                                                              search,
                                                              category,
                                                          })
                                                    : undefined
                                            }
                                            editorOnly={page !== "Expenses"}
                                            quickRequest={quickRequest}
                                            viewKey={[channel, period, customFrom, customTo].join(
                                                "|",
                                            )}
                                            allExpenses={businessExpenses}
                                            expenses={filteredExpenses}
                                            onSave={saveExpense}
                                            onDelete={deleteExpense}
                                            disabled={!ready || !!storageIssue}
                                        />
                                    )}
                                </div>
                            </>
                        )}

                        {(page === "Suppliers" ||
                            quickRequest?.kind === "supplier" ||
                            quickRequest?.kind === "purchase") && (
                            <>
                                {mode === "cloud" && user ? (
                                    <CloudSuppliers
                                        userId={user.id}
                                        revision={notebook.revision}
                                        renderManager={(view) => (
                                            <SupplierManager
                                                onImportRecords={notebook.saveSupplierImport}
                                                cloud={cloudView}
                                                prepareImport={() =>
                                                    mode === "cloud" && !notebook.hydrated
                                                        ? Promise.resolve()
                                                        : notebook.ensureHydrated()
                                                }
                                                onSaveRecord={
                                                    !notebook.hydrated
                                                        ? (supplier, expected) =>
                                                              notebook.saveRecord(
                                                                  "suppliers",
                                                                  supplier,
                                                                  expected,
                                                              )
                                                        : undefined
                                                }
                                                onDeleteRecord={
                                                    !notebook.hydrated
                                                        ? (supplier) =>
                                                              notebook.saveRecord(
                                                                  "suppliers",
                                                                  null,
                                                                  supplier,
                                                              )
                                                        : undefined
                                                }
                                                serverView={view}
                                                prepareEntry={prepareSupplier}
                                                prepareDelete={prepareSupplierDelete}
                                                onExport={(search) =>
                                                    void exportSaved("suppliers", { search })
                                                }
                                                onStatement={(id) => void supplierStatement(id)}
                                                editorOnly={page !== "Suppliers"}
                                                quickRequest={quickRequest}
                                                suppliers={suppliers}
                                                products={products}
                                                onChange={setSuppliers}
                                                disabled={
                                                    !ready || notebook.hasUnsaved || !!storageIssue
                                                }
                                            />
                                        )}
                                    />
                                ) : (
                                    <SupplierManager
                                        onStatement={(id) => void supplierStatement(id)}
                                        editorOnly={page !== "Suppliers"}
                                        quickRequest={quickRequest}
                                        suppliers={suppliers}
                                        products={products}
                                        onChange={setSuppliers}
                                        disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                                    />
                                )}
                                <>
                                    {cloudView && !notebook.hydrated ? (
                                        <CloudPurchases
                                            cloud={cloudView}
                                            branding={branding}
                                            onSave={notebook.savePurchase}
                                            quickRequest={quickRequest}
                                            focusRequest={purchaseFocusRequest}
                                            editorOnly={page !== "Suppliers"}
                                            disabled={
                                                !ready || notebook.hasUnsaved || !!storageIssue
                                            }
                                        />
                                    ) : (
                                        <PurchaseOrders
                                            onGoodsCommand={async (
                                                kind,
                                                id,
                                                input,
                                                expected,
                                                entryId,
                                            ) => {
                                                const current = notebook.getDocument();
                                                const next = applyNotebookPatch(
                                                    current,
                                                    purchaseCommand(current, {
                                                        kind,
                                                        id,
                                                        input,
                                                        expected,
                                                        ...(entryId ? { entryId } : {}),
                                                    }),
                                                );
                                                if (!validDocument(next))
                                                    throw Error(
                                                        "This return could not be validated. Review the purchase and stock history.",
                                                    );
                                                setProducts(next.products);
                                                setStockAdjustments(next.stockAdjustments);
                                                setPurchaseOrders(next.purchaseOrders);
                                            }}
                                            cloud={cloudView}
                                            prepareEntry={preparePurchase}
                                            focusRequest={purchaseFocusRequest}
                                            onSchedule={(id, date, expected) => {
                                                try {
                                                    const current = (
                                                        notebook.getDocument().purchaseOrders || []
                                                    ).find((item) => item.id === id);
                                                    if (!current)
                                                        throw Error("Purchase not found.");
                                                    const next = reschedulePurchase(
                                                        current,
                                                        date,
                                                        expected,
                                                    );
                                                    setPurchaseOrders((items) =>
                                                        items.map((item) =>
                                                            item.id === id ? next : item,
                                                        ),
                                                    );
                                                    return true;
                                                } catch (e) {
                                                    notify(
                                                        e instanceof Error
                                                            ? e.message
                                                            : "Could not update expected delivery.",
                                                    );
                                                    return false;
                                                }
                                            }}
                                            editorOnly={page !== "Suppliers"}
                                            onRecordSupplierRefund={recordSupplierRefund}
                                            onRemoveSupplierRefund={removeSupplierRefundRecord}
                                            quickRequest={quickRequest}
                                            onRecordPayment={recordPurchasePayment}
                                            onRemovePayment={removePurchasePaymentRecord}
                                            branding={branding}
                                            suppliers={suppliers}
                                            products={products}
                                            orders={purchaseOrders}
                                            disabled={
                                                !ready || notebook.hasUnsaved || !!storageIssue
                                            }
                                            onCreate={(order) =>
                                                setPurchaseOrders((items) => [order, ...items])
                                            }
                                            onReceive={(id, delivery, expectedProgress) => {
                                                try {
                                                    const current = (
                                                        notebook.getDocument().purchaseOrders || []
                                                    ).find((p) => p.id === id);
                                                    if (!current)
                                                        throw Error(
                                                            "Purchase not found. Reload and try again.",
                                                        );
                                                    if (
                                                        expectedProgress &&
                                                        purchaseProgress(current) !==
                                                            expectedProgress
                                                    )
                                                        throw Error(
                                                            "This delivery changed on another device. Review the latest quantities before receiving.",
                                                        );
                                                    const received = receivePurchase(
                                                        current,
                                                        notebook.getDocument()
                                                            .products as Product[],
                                                        notebook.getDocument().stockAdjustments ||
                                                            [],
                                                        delivery,
                                                    );
                                                    setProducts(received.products);
                                                    setStockAdjustments(received.stockAdjustments);
                                                    setPurchaseOrders((items) =>
                                                        items.map((p) =>
                                                            p.id === id ? received.order : p,
                                                        ),
                                                    );
                                                    return true;
                                                } catch (e) {
                                                    notify(
                                                        e instanceof Error
                                                            ? e.message
                                                            : "Could not receive this delivery.",
                                                    );
                                                    return false;
                                                }
                                            }}
                                            onCancel={(id) =>
                                                setPurchaseOrders((items) =>
                                                    items.map((p) =>
                                                        p.id === id &&
                                                        ["Ordered", "Partially received"].includes(
                                                            p.status,
                                                        )
                                                            ? {
                                                                  ...p,
                                                                  status: "Cancelled",
                                                                  cancelledAt:
                                                                      new Date().toISOString(),
                                                              }
                                                            : p,
                                                    ),
                                                )
                                            }
                                        />
                                    )}
                                    {page === "Suppliers" && (
                                        <DeliveryReminders
                                            cloud={cloudView}
                                            orders={purchaseOrders}
                                            today={today}
                                            openRequest={deliveryOpenRequest}
                                            onPurchase={async (id, action) => {
                                                try {
                                                    if (action === "receive" && notebook.hydrated)
                                                        await preparePurchase(id);
                                                    setPurchaseFocusRequest({
                                                        id,
                                                        action,
                                                        sequence: ++purchaseFocusSequence.current,
                                                    });
                                                } catch (e) {
                                                    notify(
                                                        e instanceof Error
                                                            ? e.message
                                                            : "Could not open delivery.",
                                                    );
                                                }
                                            }}
                                            onStatement={(id) =>
                                                setStatementRequest((previous) => ({
                                                    id,
                                                    sequence: (previous?.sequence || 0) + 1,
                                                }))
                                            }
                                        />
                                    )}
                                    {page === "Suppliers" && (
                                        <SupplierStatements
                                            cloud={cloudView}
                                            branding={branding}
                                            suppliers={suppliers}
                                            orders={purchaseOrders}
                                            request={statementRequest}
                                        />
                                    )}
                                </>
                            </>
                        )}

                        {page === "Pricing calculator" && (
                            <div className="calculator-layout">
                                <section className="card calculator-form">
                                    <div className="card-header">
                                        <div>
                                            <h2>Make every sale worthwhile</h2>
                                            <p>Enter your costs per item. We’ll do the math.</p>
                                        </div>
                                        <Calculator size={22} />
                                    </div>
                                    <div className="calc-fields">
                                        {[
                                            {
                                                key: "cost",
                                                name: "Product cost",
                                                help: "What you pay for one item",
                                            },
                                            {
                                                key: "packaging",
                                                name: "Packaging",
                                                help: "Boxes, wrapping, and all the little details",
                                            },
                                            {
                                                key: "shipping",
                                                name: "Shipping you cover",
                                                help: "Your share after any customer payment",
                                            },
                                            {
                                                key: "fee",
                                                name: "Platform fee (%)",
                                                help: "Use the rate for your seller account",
                                            },
                                            {
                                                key: "tax",
                                                name: "Tax allowance (%)",
                                                help: "Share of the selling price to set aside for tax; use your own effective rate",
                                            },
                                            {
                                                key: "margin",
                                                name: "Target profit margin (%)",
                                                help: "Your profit as a percentage of the selling price",
                                            },
                                        ].map((f) => (
                                            <label
                                                className="field"
                                                key={f.key}
                                            >
                                                <span>{f.name}</span>
                                                <div className="calc-input">
                                                    <span>
                                                        {f.key === "fee" ||
                                                        f.key === "margin" ||
                                                        f.key === "tax"
                                                            ? "%"
                                                            : "₱"}
                                                    </span>
                                                    <input
                                                        aria-label={f.name}
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={calc[f.key as keyof typeof calc]}
                                                        onChange={(e) =>
                                                            setCalc({
                                                                ...calc,
                                                                [f.key]: Number(e.target.value),
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <small>{f.help}</small>
                                            </label>
                                        ))}
                                    </div>
                                </section>
                                <div>
                                    <section className="price-result">
                                        <div className="eyebrow">YOUR RECOMMENDED PRICE</div>
                                        <h2>{result ? money(Math.ceil(result.price)) : "—"}</h2>
                                        <p>
                                            {result
                                                ? "A price with a little room to grow."
                                                : "Enter non-negative values; fees, tax allowance, and margin must total less than 100%."}
                                        </p>
                                        {result && (
                                            <>
                                                <div className="price-divider" />
                                                <div className="price-line">
                                                    <span>Product + packaging + shipping</span>
                                                    <strong>{money(result.base)}</strong>
                                                </div>
                                                <div className="price-line">
                                                    <span>Platform fees</span>
                                                    <strong>{money(result.fees)}</strong>
                                                </div>
                                                <div className="price-line">
                                                    <span>Tax allowance</span>
                                                    <strong>{money(result.taxes)}</strong>
                                                </div>
                                                <div className="price-line profit-line">
                                                    <span>Estimated profit per item</span>
                                                    <strong>{money(result.profit)}</strong>
                                                </div>
                                                <div className="margin-badge">
                                                    <Check size={16} />
                                                    {calc.margin}% target profit margin
                                                </div>
                                            </>
                                        )}
                                    </section>
                                    <p className="calc-note">
                                        Calculated as total costs ÷ (1 − fee rate − tax allowance −
                                        margin). The recommended price rounds up to the nearest
                                        peso. Tax allowance is a simple percentage of the selling
                                        price, not a VAT or income-tax calculation. It does not
                                        change order reports. Estimates exclude returns and business
                                        overhead.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <SiteFooter />
                </main>
            </div>

            {ready && !mobile && !modal && !accountOpen && !detailOrder && !financialKind && (
                <QuickCreate
                    onCreate={quickCreate}
                    disabled={notebook.hasUnsaved || !!storageIssue}
                    reasons={
                        notebook.hydrated
                            ? {
                                  ...(!eligibleFinancialPurchases(purchaseOrders, "payment").length
                                      ? {
                                            payment:
                                                "Add a purchase with an unpaid item balance first",
                                        }
                                      : {}),
                                  ...(!eligibleFinancialPurchases(purchaseOrders, "supplier-refund")
                                      .length
                                      ? {
                                            "supplier-refund":
                                                "A cancelled purchase needs credit to review first",
                                        }
                                      : {}),
                                  ...(products.length === 0
                                      ? { order: "Add an inventory product first" }
                                      : {}),
                                  ...(!suppliers.some((s) =>
                                      s.productIds.some((id) => products.some((p) => p.id === id)),
                                  )
                                      ? { purchase: "Link a product to a supplier first" }
                                      : {}),
                                  ...(products.length >= 3000
                                      ? { product: "Product limit reached" }
                                      : {}),
                                  ...(suppliers.length >= 1000
                                      ? { supplier: "Supplier limit reached" }
                                      : {}),
                                  ...(purchaseOrders.length >= 3000
                                      ? { purchase: "Purchase limit reached" }
                                      : {}),
                                  ...(businessExpenses.length >= 10000
                                      ? { expense: "Expense limit reached" }
                                      : {}),
                              }
                            : {
                                  ...(!(notebook.counts.products || 0)
                                      ? { order: "Add an inventory product first" }
                                      : {}),
                                  ...(!(notebook.counts.suppliers || 0) ||
                                  !(notebook.counts.products || 0)
                                      ? { purchase: "Link a product to a supplier first" }
                                      : {}),
                                  ...(!(notebook.counts.purchaseOrders || 0)
                                      ? {
                                            payment:
                                                "Add a purchase with an unpaid item balance first",
                                            "supplier-refund":
                                                "A cancelled purchase needs credit to review first",
                                        }
                                      : {}),
                              }
                    }
                />
            )}
            {financialKind &&
                (cloudView && !notebook.hydrated ? (
                    <CloudFinancialEntry
                        cloud={cloudView}
                        kind={financialKind}
                        onSave={notebook.savePurchase}
                        onClose={() => setFinancialKind(null)}
                        disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                    />
                ) : (
                    <QuickFinancialEntry
                        kind={financialKind}
                        orders={purchaseOrders}
                        disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                        onRecordPayment={recordPurchasePayment}
                        onRecordRefund={recordSupplierRefund}
                        onClose={() => setFinancialKind(null)}
                    />
                ))}
            <ConfirmDialog stateKey={`${user?.id || ""}|${mode}|${notebook.documentKey}`} />
            {accountOpen && (
                <EntryModal
                    title="Account settings"
                    description="Your profile, branding, and notebook"
                    className="account-modal"
                    closeLabel="Close account"
                    onClose={() => setAccountOpen(false)}
                >
                    <AccountSettings
                        profileActions={
                            mode === "cloud" ? (
                                <button
                                    className="button secondary"
                                    disabled={notebook.hasUnsaved}
                                    onClick={async () => {
                                        const result = await authClient.signOut();
                                        if (result.error) {
                                            notify(result.error.message || "Could not sign out.");
                                            return;
                                        }
                                        location.assign("/");
                                    }}
                                >
                                    <LogOut size={15} />
                                    Sign out
                                </button>
                            ) : undefined
                        }
                        connections={
                            <MarketplaceConnections
                                embedded
                                userId={mode === "cloud" ? user?.id : undefined}
                                disabled={
                                    !ready ||
                                    mode !== "cloud" ||
                                    notebook.hasUnsaved ||
                                    !!storageIssue
                                }
                                onOrders={(data) => {
                                    setShopeeFetched(data);
                                    setImportOpen(true);
                                    setPage("Orders");
                                    setAccountOpen(false);
                                }}
                            />
                        }
                        user={user}
                        branding={branding}
                        onBranding={setBranding}
                        onProfileSaved={notebook.reload}
                        disabled={!ready || !!storageIssue || mode !== "cloud"}
                        hasUnsaved={notebook.hasUnsaved}
                        status={mode === "cloud" ? status : "Sample notebook · This browser"}
                    >
                        {mode === "cloud" && (
                            <NotebookBackup
                                cloud={
                                    user
                                        ? { userId: user.id, revision: notebook.revision }
                                        : undefined
                                }
                                document={{
                                    products,
                                    orders,
                                    expenses: businessExpenses,
                                    sidebarNote,
                                    branding,
                                    stockAdjustments,
                                    refundRecords,
                                    suppliers,
                                    purchaseOrders,
                                }}
                                onRestore={notebook.restoreDocument}
                                disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                            />
                        )}
                        <div className="account-actions">
                            {mode === "cloud" ? (
                                <>
                                    <button
                                        className="button secondary"
                                        disabled={notebook.hasUnsaved}
                                        onClick={async () => {
                                            notebook.openDemo();
                                            setAccountOpen(false);
                                        }}
                                    >
                                        Explore sample notebook
                                    </button>
                                </>
                            ) : user ? (
                                <button
                                    className="button primary"
                                    onClick={async () => {
                                        void notebook.reload();
                                        setAccountOpen(false);
                                    }}
                                >
                                    Open my notebook
                                    <ArrowRight size={16} />
                                </button>
                            ) : (
                                <a
                                    className="button primary"
                                    href="/auth/sign-in"
                                >
                                    Sign in
                                    <ArrowRight size={16} />
                                </a>
                            )}
                        </div>
                        {mode === "cloud" && notebook.hasUnsaved && (
                            <p className="form-hint">
                                Finish saving your changes before switching notebooks.
                            </p>
                        )}
                    </AccountSettings>
                </EntryModal>
            )}

            {detailOrder &&
                (cloudView && !notebook.hydrated ? (
                    <CloudOrderDetails
                        cloud={cloudView}
                        id={detailOrder}
                        branding={branding}
                        onSave={notebook.saveOrder}
                        onClose={() => setDetailOrder(null)}
                        disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                    />
                ) : (
                    <OrderDetails
                        cloud={cloudView}
                        orders={orders}
                        id={detailOrder}
                        branding={branding}
                        refunds={refundRecords}
                        onRecordRefund={recordRefund}
                        onRemoveRefund={removeRefund}
                        disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                        onClose={() => setDetailOrder(null)}
                    />
                ))}

            {toast && (
                <div
                    className="toast"
                    role="status"
                >
                    <Check size={18} />
                    {toast}
                </div>
            )}

            {modal === "order" && cloudView && !notebook.hydrated ? (
                <SaleEntry
                    cloud={cloudView}
                    onSave={notebook.saveOrder}
                    onClose={() => setModal(null)}
                    disabled={!ready || notebook.hasUnsaved || !!storageIssue}
                />
            ) : (
                modal && (
                    <EntryModal
                        title={
                            modal === "product"
                                ? editing
                                    ? "Edit product"
                                    : "New product"
                                : "Record a sale"
                        }
                        description={
                            modal === "product"
                                ? "Give your product a place in the collection."
                                : "A little win for your business."
                        }
                        onClose={() => setModal(null)}
                    >
                        <form
                            className="product-sale-form"
                            onSubmit={save}
                        >
                            <fieldset disabled={!ready || notebook.hasUnsaved || !!storageIssue}>
                                <div className="form-grid">
                                    {modal === "product" ? (
                                        <>
                                            <Field
                                                name="name"
                                                label="Product name"
                                                defaultValue={editing?.name}
                                                autoFocus
                                            />
                                            <Field
                                                name="sku"
                                                label="SKU"
                                                defaultValue={editing?.sku}
                                            />
                                            <Field
                                                name="category"
                                                label="Category"
                                                defaultValue={editing?.category || "Accessories"}
                                            />
                                            {editing ? (
                                                <p className="form-hint">
                                                    Current stock:{" "}
                                                    {products.find((item) => item.id === editing.id)
                                                        ?.stock ?? editing.stock}
                                                    . Use Stock adjustments in Inventory to record
                                                    quantity changes with a reason.
                                                </p>
                                            ) : (
                                                <Field
                                                    name="stock"
                                                    label="Stock quantity"
                                                    type="number"
                                                    defaultValue={0}
                                                />
                                            )}
                                            <Field
                                                name="reorderPoint"
                                                label="Low-stock alert level"
                                                type="number"
                                                max="9999999"
                                                defaultValue={
                                                    editing
                                                        ? stockTargets(editing).reorderPoint
                                                        : 10
                                                }
                                            />
                                            <Field
                                                name="targetStock"
                                                label="Target stock level"
                                                type="number"
                                                max="10000000"
                                                defaultValue={
                                                    editing ? stockTargets(editing).targetStock : 20
                                                }
                                            />
                                            <Field
                                                name="cost"
                                                label="Unit cost (₱)"
                                                type="number"
                                                step="0.01"
                                                defaultValue={editing?.cost ?? 0}
                                            />
                                            <Field
                                                name="price"
                                                label="Selling price (₱)"
                                                type="number"
                                                step="0.01"
                                                defaultValue={editing?.price ?? 0}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <Field
                                                name="customer"
                                                label="Customer name"
                                                autoFocus
                                            />
                                            <label className="field">
                                                <span>Product</span>
                                                <select
                                                    name="product"
                                                    required
                                                >
                                                    {products
                                                        .filter((p) => p.stock > 0)
                                                        .map((p) => (
                                                            <option
                                                                value={p.id}
                                                                key={p.id}
                                                            >
                                                                {p.name} · {p.stock} available
                                                            </option>
                                                        ))}
                                                </select>
                                            </label>
                                            <label className="field">
                                                <span>Sales channel</span>
                                                <select name="channel">
                                                    {[
                                                        "Shopee",
                                                        "Lazada",
                                                        "TikTok Shop",
                                                        "Direct",
                                                    ].map((c) => (
                                                        <option key={c}>{c}</option>
                                                    ))}
                                                </select>
                                            </label>
                                            <Field
                                                name="quantity"
                                                label="Quantity"
                                                type="number"
                                                min="1"
                                                defaultValue={1}
                                            />
                                            <Field
                                                name="fee"
                                                label="Platform fee (%)"
                                                type="number"
                                                step="0.01"
                                                max="99.99"
                                                defaultValue={8}
                                            />
                                            <Field
                                                name="packaging"
                                                label="Packaging per order (₱)"
                                                type="number"
                                                step="0.01"
                                                defaultValue={15}
                                            />
                                            <Field
                                                name="shipping"
                                                label="Shipping you cover (₱)"
                                                type="number"
                                                step="0.01"
                                                defaultValue={0}
                                            />
                                            <Field
                                                name="date"
                                                label="Order date"
                                                type="date"
                                                defaultValue={new Date().toLocaleDateString(
                                                    "en-CA",
                                                )}
                                            />
                                            <p className="form-hint">
                                                Orders start as Processing. Complete them in Orders
                                                to include them in revenue. Fees are examples; enter
                                                your actual rate.
                                            </p>
                                        </>
                                    )}
                                </div>
                                {error && (
                                    <p
                                        className="form-error"
                                        role="alert"
                                    >
                                        <AlertCircle size={16} />
                                        {error}
                                    </p>
                                )}
                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="button secondary"
                                        onClick={async () => setModal(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="button primary"
                                        type="submit"
                                    >
                                        {modal === "product" ? "Save product" : "Record sale"}
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            </fieldset>
                        </form>
                    </EntryModal>
                )
            )}
        </div>
    );
}

function ProductThumb({ p }: { p: Product }) {
    return (
        <span
            className="product-thumb"
            style={{ background: p.color }}
            aria-hidden="true"
        >
            {p.symbol}
        </span>
    );
}

function Field({
    label,
    ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <label className="field">
            <span>{label}</span>
            <input
                required
                min="0"
                {...props}
            />
        </label>
    );
}

function OrderTable({
    orders,
    compact,
    onComplete,
    onCancel,
    onBulk,
    onDetails,
    disabled = false,
    serverPaging,
}: {
    serverPaging?: OrderPaging;
    orders: Order[];
    compact?: boolean;
    onComplete?: (o: Order) => void;
    onCancel?: (o: Order) => void;
    onBulk?: (ids: string[], action: "Completed" | "Cancelled") => boolean | Promise<boolean>;
    onDetails?: (order: Order) => void;
    disabled?: boolean;
}) {
    const [selected, setSelected] = useState<string[]>([]);

    const orderPage = usePagination(orders);

    const pageOrders = compact || serverPaging ? orders : orderPage.items;
    const paging = serverPaging || orderPage;

    const eligible = pageOrders.filter((order) => order.status === "Processing");

    const stale = selected.some((id) => !eligible.some((order) => order.id === id));

    async function bulk(action: "Completed" | "Cancelled") {
        if (!selected.length || stale) return;
        const note =
            action === "Cancelled"
                ? "Reserved manual stock will be restored. Imported history will not change stock."
                : "These orders will count toward completed sales.";
        if (
            !(await confirmAction(
                `${action === "Cancelled" ? "Cancel" : "Complete"} ${selected.length} selected order lines? ${note}`,
            ))
        )
            return;
        if (await onBulk?.(selected, action)) setSelected([]);
    }

    return (
        <>
            {!compact && (
                <div className="bulk-order-actions">
                    <label>
                        <input
                            type="checkbox"
                            aria-label="Select all visible processing orders"
                            disabled={disabled || !eligible.length}
                            checked={
                                !!eligible.length &&
                                eligible.every((order) => selected.includes(order.id))
                            }
                            onChange={(e) =>
                                setSelected(
                                    e.target.checked ? eligible.map((order) => order.id) : [],
                                )
                            }
                        />
                        Select this page’s processing orders
                    </label>
                    {selected.length > 0 && (
                        <>
                            <small>{selected.length} selected</small>
                            <button
                                className="button secondary"
                                disabled={disabled || stale}
                                onClick={async () => bulk("Completed")}
                            >
                                Complete selected
                            </button>
                            <button
                                className="button secondary cancel"
                                disabled={disabled || stale}
                                onClick={async () => bulk("Cancelled")}
                            >
                                Cancel selected
                            </button>
                            <button
                                className="text-button"
                                onClick={async () => setSelected([])}
                            >
                                Clear selection
                            </button>
                            {stale && (
                                <small role="status">
                                    Selected orders changed. Clear the selection and review again.
                                </small>
                            )}
                        </>
                    )}
                </div>
            )}
            <div className="table-scroll">
                <table>
                    <thead>
                        <tr>
                            {!compact && <th>Select</th>}
                            <th>Order / customer</th>
                            <th>Channel</th>
                            {!compact && <th>Product</th>}
                            <th>Amount</th>
                            <th>Status</th>
                            {!compact && (
                                <>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {pageOrders.map((o) => (
                            <tr key={o.id}>
                                {!compact && (
                                    <td>
                                        {o.status === "Processing" && (
                                            <input
                                                type="checkbox"
                                                aria-label={`Select ${o.channel} order ${o.sourceOrderId || o.id}`}
                                                disabled={disabled}
                                                checked={selected.includes(o.id)}
                                                onChange={(e) =>
                                                    setSelected((old) =>
                                                        e.target.checked
                                                            ? [...old, o.id]
                                                            : old.filter((id) => id !== o.id),
                                                    )
                                                }
                                            />
                                        )}
                                    </td>
                                )}
                                <td>
                                    <strong className="order-id">#{o.sourceOrderId || o.id}</strong>
                                    <small>{o.customer}</small>
                                </td>
                                <td>
                                    <span className={"channel-badge " + channelClass(o.channel)}>
                                        {o.channel}
                                    </span>
                                </td>
                                {!compact && (
                                    <td>
                                        {o.productName}
                                        <small>Qty {o.quantity}</small>
                                    </td>
                                )}
                                <td className="amount">{money(orderTotals(o).revenue)}</td>
                                <td>
                                    <span className={"status " + o.status.toLowerCase()}>
                                        <i />
                                        {o.status}
                                    </span>
                                </td>
                                {!compact && (
                                    <>
                                        <td className="date-cell">
                                            {new Date(o.date + "T12:00:00").toLocaleDateString(
                                                "en-US",
                                                { month: "short", day: "numeric" },
                                            )}
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="text-button"
                                                    aria-label={`Details for ${o.channel} order ${o.sourceOrderId || o.id}`}
                                                    onClick={async () => onDetails?.(o)}
                                                >
                                                    Details
                                                </button>
                                                {o.status === "Processing" && (
                                                    <>
                                                        <button
                                                            className="text-button"
                                                            disabled={disabled}
                                                            onClick={async () => onComplete?.(o)}
                                                        >
                                                            Complete
                                                        </button>
                                                        <button
                                                            className="text-button cancel"
                                                            disabled={disabled}
                                                            onClick={async () => onCancel?.(o)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!orders.length && (
                    <div className="empty">
                        No orders in this view. Try another filter or record your first sale.
                    </div>
                )}
            </div>
            {!compact && (
                <Pagination
                    label="Orders"
                    {...paging}
                    setPage={(page) => {
                        setSelected([]);
                        paging.setPage(page);
                    }}
                    setPageSize={(size) => {
                        setSelected([]);
                        paging.setPageSize(size);
                    }}
                />
            )}
        </>
    );
}
