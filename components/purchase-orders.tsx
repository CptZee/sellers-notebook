"use client";
import { SupplierGoodsReturns, type GoodsCommand } from "./supplier-goods-returns";

import { restockDraftVersion } from "../lib/restock-purchase.mjs";
import { confirmAction } from "./confirm-dialog";
import { useState, useEffect, useRef } from "react";
import type { QuickCreateRequest } from "./quick-create";
import { PurchasePayments } from "./purchase-payments";
import { PurchaseSchedule } from "./purchase-schedule";
import { EntryModal } from "./entry-modal";
import { CollapsibleCard } from "./collapsible-card";
import { useNotebookView, type CloudNotebook } from "../lib/use-notebook-view";
import { ViewLoading } from "./view-loading";
import { downloadRecordCopy, printRecordCopy } from "../lib/record-copy";
import { downloadView } from "../lib/view-download";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import { createPurchase, receivedUnits, purchaseProgress } from "../lib/purchases.mjs";
import { purchaseCopyHtml, purchaseOverview, isPurchaseOverdue } from "../lib/purchase-copy.mjs";
import type {
    Product,
    Supplier,
    PurchaseOrder,
    Branding,
    PurchasePayment,
} from "../lib/notebook-types";
const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n || 0);
export function PurchaseOrders({
    suppliers,
    products,
    orders,
    branding,
    quickRequest,
    onCreate,
    onReceive,
    onCancel,
    onRecordPayment,
    onRemovePayment,
    onRecordSupplierRefund,
    onRemoveSupplierRefund,
    disabled,
    editorOnly = false,
    focusRequest,
    onSchedule,
    cloud,
    prepareEntry,
    onStartCreate,
    onGoodsCommand,
}: {
    onGoodsCommand?: GoodsCommand;
    onStartCreate?: () => void;
    cloud?: CloudNotebook;
    prepareEntry?: (id?: string) => Promise<PurchaseOrder | null>;
    suppliers: Supplier[];
    products: Product[];
    orders: PurchaseOrder[];
    branding: Branding | null;
    onCreate: (order: PurchaseOrder) => void;
    onReceive: (
        id: string,
        delivery?: Record<string, number>,
        expectedProgress?: string,
    ) => boolean | Promise<boolean>;
    onCancel: (id: string) => void | Promise<void>;
    onRecordPayment: (
        id: string,
        payment: Omit<PurchasePayment, "id">,
        expected: string,
    ) => boolean | Promise<boolean>;
    onRemovePayment: (id: string, paymentId: string, expected: string) => void | Promise<void>;
    onRecordSupplierRefund: (
        id: string,
        input: Omit<PurchasePayment, "id">,
        expected: string,
    ) => boolean | Promise<boolean>;
    onRemoveSupplierRefund: (
        id: string,
        recordId: string,
        expected: string,
    ) => void | Promise<void>;
    disabled: boolean;
    quickRequest?: QuickCreateRequest | null;
    editorOnly?: boolean;
    focusRequest?: { id: string; action: "view" | "receive"; sequence: number } | null;
    onSchedule: (id: string, date: string, expected: string) => boolean | Promise<boolean>;
}) {
    const [creating, setCreating] = useState(false),
        [supplierId, setSupplierId] = useState(""),
        [lines, setLines] = useState<{ productId: string; quantity: number; unitCost: number }[]>(
            [],
        ),
        [error, setError] = useState(""),
        [status, setStatus] = useState("All purchases"),
        [search, setSearch] = useState("");
    const [receiving, setReceiving] = useState(""),
        [receiptDraft, setReceiptDraft] = useState<Record<string, number>>({}),
        [receiptProgress, setReceiptProgress] = useState(""),
        [receiptError, setReceiptError] = useState("");
    const [planVersion, setPlanVersion] = useState("");
    const handled = useRef(0);
    useEffect(() => {
        if (quickRequest?.kind !== "purchase" || quickRequest.sequence === handled.current) return;
        handled.current = quickRequest.sequence;
        if (onStartCreate) {
            onStartCreate();
            return;
        }
        setCreating(true);
        setError("");
        setSupplierId(quickRequest.purchaseDraft?.supplierId || "");
        setLines(quickRequest.purchaseDraft?.lines || []);
        setPlanVersion(quickRequest.purchaseDraft?.version || "");
    }, [quickRequest]);

    const supplier = suppliers.find((s) => s.id === supplierId),
        available = products.filter((p) => supplier?.productIds.includes(p.id));
    const stalePlan =
        !!planVersion && planVersion !== restockDraftVersion(supplier, products, orders);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    const shown = orders
        .filter(
            (o) =>
                (status === "All purchases" ||
                    (status === "Overdue" ? isPurchaseOverdue(o, today) : o.status === status)) &&
                [o.reference, o.supplierName, ...o.items.map((i) => i.productName + " " + i.sku)]
                    .join(" ")
                    .toLowerCase()
                    .includes(search.toLowerCase()),
        )
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
    const [expanded, setExpanded] = useState(!cloud || !!cloud.hydrated),
        [focusId, setFocusId] = useState("");
    const view = useNotebookView<PurchaseOrder>(
            cloud,
            "purchases",
            { status, search, id: focusId },
            expanded,
        ),
        overview = cloud ? view.totals : purchaseOverview(shown, today);
    const [copyError, setCopyError] = useState("");
    async function downloadCopy(order: PurchaseOrder) {
        if (cloud) {
            setCopyError("");
            try {
                await downloadRecordCopy(cloud, "purchase", order.id);
            } catch (e) {
                setCopyError(e instanceof Error ? e.message : "Could not download copy.");
            }
            return;
        }
        const url = URL.createObjectURL(
            new Blob([purchaseCopyHtml(order, branding)], { type: "text/html;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download =
            "purchase-" + order.reference.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 90) + ".html";
        a.click();
        URL.revokeObjectURL(url);
    }
    async function printCopy(order: PurchaseOrder) {
        setCopyError("");
        if (cloud) {
            try {
                await printRecordCopy(cloud, "purchase", order.id);
            } catch (e) {
                setCopyError(e instanceof Error ? e.message : "Could not print copy.");
            }
            return;
        }
        const popup = window.open("", "_blank", "width=950,height=750");
        if (!popup) {
            setCopyError(
                "Allow the purchase window to open, or download the supplier copy instead.",
            );
            return;
        }
        popup.opener = null;
        popup.document.write(purchaseCopyHtml(order, branding));
        popup.document.close();
        popup.focus();
        popup.print();
    }
    const localPaging = usePagination(shown, status + "|" + search),
        paging = cloud
            ? {
                  ...view.paging,
                  items: view.items.map(
                      (item) => orders.find((order) => order.id === item.id) || item,
                  ),
              }
            : localPaging;
    async function prepare(order?: PurchaseOrder) {
        try {
            const current = await prepareEntry?.(order?.id);
            if (
                order &&
                current &&
                (purchaseProgress(current) !== purchaseProgress(order) ||
                    order.items.length !== current.items.length ||
                    order.items.some(
                        (item, index) =>
                            item.productId !== current.items[index]?.productId ||
                            item.quantity !== current.items[index]?.quantity ||
                            item.unitCost !== current.items[index]?.unitCost,
                    ))
            )
                throw Error(
                    "This purchase changed. Review the latest quantities before continuing.",
                );
            return true;
        } catch (e) {
            setCopyError(e instanceof Error ? e.message : "Could not open this entry.");
            return false;
        }
    }
    const focusHandled = useRef(0),
        [pendingFocus, setPendingFocus] = useState<{
            id: string;
            action: "view" | "receive";
        } | null>(null);
    useEffect(() => {
        if (!focusRequest || focusHandled.current === focusRequest.sequence) return;
        const order = orders.find((item) => item.id === focusRequest.id);
        if (!order && !cloud) return;
        setExpanded(true);
        setFocusId(cloud ? focusRequest.id : "");
        focusHandled.current = focusRequest.sequence;
        setStatus("All purchases");
        setSearch(cloud ? "" : order!.reference);
        setPendingFocus(focusRequest);
    }, [focusRequest, orders]);
    useEffect(() => {
        if (!pendingFocus) return;
        const index = (cloud ? paging.items : shown).findIndex(
            (order) => order.id === pendingFocus.id,
        );
        if (index < 0) return;
        const targetPage = Math.floor(index / paging.pageSize) + 1;
        if (paging.page !== targetPage) {
            paging.setPage(targetPage);
            return;
        }
        const row = Array.from(
            document.querySelectorAll<HTMLDetailsElement>(".purchase-record"),
        ).find((element) => element.dataset.purchaseId === pendingFocus.id);
        if (!row) return;
        const parent = row.closest<HTMLDetailsElement>(".purchase-orders");
        if (parent) parent.open = true;
        row.open = true;
        const order = paging.items.find((item) => item.id === pendingFocus.id);
        if (
            pendingFocus.action === "receive" &&
            order &&
            ["Ordered", "Partially received"].includes(order.status)
        ) {
            setReceiving(order.id);
            setReceiptDraft({});
            setReceiptProgress(purchaseProgress(order));
            setReceiptError("");
            setTimeout(() => {
                if (row.isConnected)
                    row.querySelector<HTMLInputElement>(".partial-receipt input")?.focus({
                        preventScroll: true,
                    });
            }, 0);
        } else row.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
        row.scrollIntoView({ behavior: "smooth", block: "start" });
        setPendingFocus(null);
    }, [pendingFocus, shown, paging.page, paging.pageSize]);

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        try {
            if (stalePlan)
                throw Error(
                    "Stock, supplier details, or open purchases changed. Cancel and prepare a fresh restock draft.",
                );
            const data = new FormData(event.currentTarget);
            const order = createPurchase(
                supplier,
                lines,
                products,
                String(data.get("notes") || ""),
                String(data.get("expectedDate") || ""),
            );
            onCreate(order);
            setCreating(false);
            setLines([]);
            setSupplierId("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not create this purchase.");
        }
    }
    return (
        <>
            {creating && (
                <EntryModal
                    title="New purchase order"
                    description="Choose a supplier and the items you plan to order."
                    onClose={() => {
                        setCreating(false);
                        setLines([]);
                        setSupplierId("");
                    }}
                >
                    <form
                        className="purchase-form"
                        onSubmit={submit}
                    >
                        <fieldset disabled={disabled}>
                            <div className="supplier-fields">
                                <label className="field">
                                    <span>Purchase supplier</span>
                                    <select
                                        aria-label="Purchase supplier"
                                        required
                                        value={supplierId}
                                        onChange={(e) => {
                                            setSupplierId(e.target.value);
                                            setLines([]);
                                            setPlanVersion("");
                                        }}
                                    >
                                        <option value="">Choose supplier</option>
                                        {suppliers.map((s) => (
                                            <option
                                                key={s.id}
                                                value={s.id}
                                            >
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="field">
                                    <span>Expected delivery (optional)</span>
                                    <input
                                        name="expectedDate"
                                        type="date"
                                    />
                                </label>
                            </div>
                            <p className="import-note">
                                Choose products linked to this supplier. Link products on the
                                supplier’s Edit page if none appear.
                            </p>
                            {planVersion && (
                                <p className="import-note">
                                    Prepared from the restock planner after subtracting outstanding
                                    units on open purchases. Review quantities and supplier prices
                                    before saving.
                                </p>
                            )}
                            {stalePlan && (
                                <p
                                    className="auth-error"
                                    role="alert"
                                >
                                    Stock, supplier details, or open purchases changed. Cancel and
                                    prepare a fresh restock draft.
                                </p>
                            )}
                            {lines.map((line, index) => (
                                <div
                                    className="purchase-line"
                                    key={index}
                                >
                                    <label className="field">
                                        <span>Purchase product {index + 1}</span>
                                        <select
                                            aria-label={`Purchase product ${index + 1}`}
                                            required
                                            value={line.productId}
                                            onChange={(e) => {
                                                const product = products.find(
                                                    (p) => p.id === e.target.value,
                                                );
                                                setLines((items) =>
                                                    items.map((item, i) =>
                                                        i === index
                                                            ? {
                                                                  ...item,
                                                                  productId: e.target.value,
                                                                  unitCost: product?.cost || 0,
                                                              }
                                                            : item,
                                                    ),
                                                );
                                            }}
                                        >
                                            <option value="">Choose product</option>
                                            {available.map((p) => (
                                                <option
                                                    key={p.id}
                                                    value={p.id}
                                                >
                                                    {p.name} · {p.sku}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="field">
                                        <span>Units {index + 1}</span>
                                        <input
                                            aria-label={`Purchase units ${index + 1}`}
                                            type="number"
                                            min="1"
                                            max="10000000"
                                            step="1"
                                            required
                                            value={line.quantity}
                                            onChange={(e) =>
                                                setLines((items) =>
                                                    items.map((item, i) =>
                                                        i === index
                                                            ? {
                                                                  ...item,
                                                                  quantity: Number(e.target.value),
                                                              }
                                                            : item,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                    <label className="field">
                                        <span>Unit cost (₱) {index + 1}</span>
                                        <input
                                            aria-label={`Purchase unit cost ${index + 1}`}
                                            type="number"
                                            min="0"
                                            max="100000000"
                                            step="0.01"
                                            required
                                            value={line.unitCost}
                                            onChange={(e) =>
                                                setLines((items) =>
                                                    items.map((item, i) =>
                                                        i === index
                                                            ? {
                                                                  ...item,
                                                                  unitCost: Number(e.target.value),
                                                              }
                                                            : item,
                                                    ),
                                                )
                                            }
                                        />
                                    </label>
                                    <button
                                        className="text-button cancel"
                                        type="button"
                                        aria-label={`Remove purchase line ${index + 1}`}
                                        onClick={async () =>
                                            setLines((items) => items.filter((_, i) => i !== index))
                                        }
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                            <button
                                className="button secondary"
                                type="button"
                                disabled={!available.length || lines.length >= 100}
                                onClick={async () =>
                                    setLines((items) => [
                                        ...items,
                                        { productId: "", quantity: 1, unitCost: 0 },
                                    ])
                                }
                            >
                                Add purchase item
                            </button>
                            <label className="field purchase-notes">
                                <span>Purchase notes</span>
                                <textarea
                                    aria-label="Purchase notes"
                                    name="notes"
                                    maxLength={1000}
                                    rows={2}
                                />
                            </label>
                            {error && (
                                <p
                                    className="auth-error"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}
                            <div className="supplier-actions">
                                <button
                                    className="button secondary"
                                    type="button"
                                    onClick={async () => {
                                        setCreating(false);
                                        setLines([]);
                                        setSupplierId("");
                                    }}
                                >
                                    Cancel purchase entry
                                </button>
                                <button
                                    className="button primary"
                                    disabled={!lines.length || stalePlan}
                                >
                                    Save purchase order
                                </button>
                            </div>
                        </fieldset>
                    </form>
                </EntryModal>
            )}
            {!editorOnly && (
                <CollapsibleCard
                    defaultOpen={!cloud || !!cloud.hydrated}
                    openRequest={focusRequest?.sequence || 0}
                    onOpenChange={setExpanded}
                    className="purchase-orders"
                    title="Purchases & deliveries"
                    description="Keep track of what you’ve ordered from your suppliers."
                    actions={
                        <button
                            className="button secondary"
                            disabled={disabled || creating || orders.length >= 3000}
                            onClick={async () => {
                                if (onStartCreate) {
                                    onStartCreate();
                                    return;
                                }
                                if (!(await prepare())) return;
                                setCreating(true);
                                setError("");
                                setPlanVersion("");
                            }}
                        >
                            New purchase order
                        </button>
                    }
                >
                    <p className="purchase-intro">
                        Record orders you arrange with suppliers outside this notebook. Record each
                        delivery here to add only the units that arrived to stock and stock history.
                        Outstanding quantities stay open until received or cancelled. Purchases do
                        not send messages, make payments, add expenses, or change unit costs.
                    </p>

                    <div className="purchase-filters">
                        {focusId && (
                            <button
                                className="text-button"
                                onClick={() => setFocusId("")}
                            >
                                Show all purchases
                            </button>
                        )}
                        <label className="field">
                            <span>Search purchases</span>
                            <input
                                value={search}
                                onChange={(e) => {
                                    setFocusId("");
                                    setSearch(e.target.value);
                                }}
                            />
                        </label>
                        <label className="field">
                            <span>Purchase status</span>
                            <select
                                aria-label="Purchase status"
                                value={status}
                                onChange={(e) => {
                                    setFocusId("");
                                    setStatus(e.target.value);
                                }}
                            >
                                {[
                                    "All purchases",
                                    "Ordered",
                                    "Partially received",
                                    "Overdue",
                                    "Received",
                                    "Cancelled",
                                ].map((s) => (
                                    <option key={s}>{s}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div
                        className="purchase-overview"
                        aria-label="Purchase overview"
                    >
                        <div>
                            <small>Open purchases</small>
                            <strong>{overview.openCount}</strong>
                        </div>
                        <div>
                            <small>Units outstanding</small>
                            <strong>{overview.outstandingUnits}</strong>
                        </div>
                        <div>
                            <small>Outstanding item estimate</small>
                            <strong>{money(overview.outstandingCost)}</strong>
                        </div>
                        <div>
                            <small>Overdue deliveries</small>
                            <strong>{overview.overdueCount}</strong>
                        </div>
                    </div>
                    <p className="purchase-intro">
                        Summary follows the current search and status across all pages. Overdue
                        means an open purchase with an expected delivery before today. Estimates
                        exclude tax and delivery.
                    </p>
                    {copyError && (
                        <p
                            className="auth-error purchase-copy-error"
                            role="alert"
                        >
                            {copyError}
                        </p>
                    )}
                    {cloud && view.pending && (
                        <ViewLoading
                            error={view.error}
                            retry={view.retry}
                        />
                    )}
                    <button
                        className="text-button"
                        disabled={!!cloud && view.pending}
                        onClick={async () => {
                            try {
                                if (cloud)
                                    await downloadView(cloud, "purchases", {
                                        status,
                                        search,
                                        id: focusId,
                                    });
                            } catch (e) {
                                setCopyError(e instanceof Error ? e.message : "Download failed.");
                            }
                        }}
                        hidden={!cloud}
                    >
                        Export purchases
                    </button>
                    <div className="purchase-list">
                        {paging.items.map((order) => (
                            <details
                                className="purchase-record"
                                data-purchase-id={order.id}
                                key={order.id}
                            >
                                <summary>
                                    <strong>{order.reference}</strong> · {order.supplierName}{" "}
                                    <span>
                                        {order.status}
                                        {isPurchaseOverdue(order, today) ? " · Overdue" : ""}
                                    </span>
                                </summary>
                                <p className="import-note">
                                    Created {new Date(order.createdAt).toLocaleDateString("en-PH")}
                                    {order.expectedDate ? ` · Expected ${order.expectedDate}` : ""}
                                    {order.receivedAt
                                        ? ` · Received ${new Date(order.receivedAt).toLocaleDateString("en-PH")}`
                                        : ""}
                                </p>
                                <PurchaseSchedule
                                    prepareEntry={prepareEntry}
                                    order={order}
                                    onSave={onSchedule}
                                    disabled={disabled}
                                />
                                {order.notes && <p className="purchase-notes">{order.notes}</p>}
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Product / SKU</th>
                                                <th>Ordered</th>
                                                <th>Received</th>
                                                <th>Outstanding</th>
                                                <th>Unit cost</th>
                                                <th>Line total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {order.items.map((item) => (
                                                <tr key={item.productId}>
                                                    <td>
                                                        {item.productName}
                                                        <small>{item.sku}</small>
                                                    </td>
                                                    <td>{item.quantity}</td>
                                                    <td>{receivedUnits(order, item)}</td>
                                                    <td>
                                                        {order.status === "Cancelled"
                                                            ? 0
                                                            : item.quantity -
                                                              receivedUnits(order, item)}
                                                        {order.status === "Cancelled" &&
                                                            item.quantity >
                                                                receivedUnits(order, item) && (
                                                                <small>
                                                                    {item.quantity -
                                                                        receivedUnits(
                                                                            order,
                                                                            item,
                                                                        )}{" "}
                                                                    cancelled
                                                                </small>
                                                            )}
                                                    </td>
                                                    <td>{money(item.unitCost)}</td>
                                                    <td>
                                                        {money(
                                                            (Math.round(item.unitCost * 100) *
                                                                item.quantity) /
                                                                100,
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="purchase-copy-actions">
                                    <button
                                        className="button secondary"
                                        disabled={disabled || (!!cloud && view.pending)}
                                        onClick={async () => downloadCopy(order)}
                                    >
                                        Download supplier copy
                                    </button>
                                    <button
                                        className="button secondary"
                                        disabled={disabled || (!!cloud && view.pending)}
                                        onClick={async () => printCopy(order)}
                                    >
                                        Print purchase order
                                    </button>
                                </div>
                                <p className="import-note">
                                    Supplier copies include recorded item costs and delivery counts.
                                    Your internal purchase notes are kept private.
                                </p>
                                <p className="purchase-total">
                                    Recorded item cost:{" "}
                                    {money(
                                        order.items.reduce(
                                            (sum, i) =>
                                                sum + Math.round(i.unitCost * 100) * i.quantity,
                                            0,
                                        ) / 100,
                                    )}{" "}
                                    · excludes tax and delivery
                                </p>
                                {onGoodsCommand && (
                                    <SupplierGoodsReturns
                                        order={order}
                                        prepareEntry={prepareEntry}
                                        onCommand={onGoodsCommand}
                                        disabled={disabled}
                                    />
                                )}
                                <PurchasePayments
                                    cloud={cloud}
                                    prepareEntry={prepareEntry}
                                    order={order}
                                    disabled={disabled}
                                    onRecord={onRecordPayment}
                                    onRemove={onRemovePayment}
                                    onRecordRefund={onRecordSupplierRefund}
                                    onRemoveRefund={onRemoveSupplierRefund}
                                />
                                {["Ordered", "Partially received"].includes(order.status) && (
                                    <>
                                        <div className="supplier-actions">
                                            <button
                                                className="button secondary cancel"
                                                disabled={disabled}
                                                onClick={async () => {
                                                    if (!(await prepare(order))) return;
                                                    if (
                                                        await confirmAction(
                                                            `Cancel the outstanding units for ${order.reference}? Previously received stock stays in inventory. Notify your supplier separately.`,
                                                        )
                                                    )
                                                        await onCancel(order.id);
                                                }}
                                            >
                                                {order.status === "Partially received"
                                                    ? "Cancel remainder"
                                                    : "Cancel purchase"}
                                            </button>
                                            <button
                                                className="button secondary"
                                                disabled={disabled}
                                                onClick={async () => {
                                                    if (!(await prepare(order))) return;
                                                    setReceiving(order.id);
                                                    setReceiptDraft({});
                                                    setReceiptProgress(purchaseProgress(order));
                                                    setReceiptError("");
                                                }}
                                            >
                                                Receive part of delivery
                                            </button>
                                            <button
                                                className="button primary"
                                                disabled={disabled}
                                                onClick={async () => {
                                                    if (!(await prepare(order))) return;
                                                    if (
                                                        await confirmAction(
                                                            `Receive ALL ${order.items.reduce((sum, i) => sum + i.quantity - receivedUnits(order, i), 0)} outstanding units for ${order.reference}? Confirm these items have arrived.`,
                                                        )
                                                    )
                                                        await onReceive(
                                                            order.id,
                                                            undefined,
                                                            purchaseProgress(order),
                                                        );
                                                }}
                                            >
                                                {order.status === "Partially received"
                                                    ? "Receive remaining delivery"
                                                    : "Receive full delivery"}
                                            </button>
                                        </div>
                                        {receiving === order.id && (
                                            <form
                                                className="partial-receipt"
                                                onSubmit={async (event) => {
                                                    event.preventDefault();
                                                    setReceiptError("");
                                                    const total = Object.values(
                                                        receiptDraft,
                                                    ).reduce((sum, n) => sum + n, 0);
                                                    if (
                                                        !Number.isSafeInteger(total) ||
                                                        total <= 0
                                                    ) {
                                                        setReceiptError(
                                                            "Enter at least one received unit.",
                                                        );
                                                        return;
                                                    }
                                                    if (
                                                        (await confirmAction(
                                                            `Record ${total} received units for ${order.reference}? Only these units will be added to stock.`,
                                                        )) &&
                                                        (await onReceive(
                                                            order.id,
                                                            receiptDraft,
                                                            receiptProgress,
                                                        ))
                                                    )
                                                        setReceiving("");
                                                }}
                                            >
                                                <fieldset disabled={disabled}>
                                                    <h3>What arrived in this delivery?</h3>
                                                    <p className="import-note">
                                                        Enter only units received now. Leave other
                                                        items at zero.
                                                    </p>
                                                    {order.items
                                                        .filter(
                                                            (item) =>
                                                                item.quantity >
                                                                receivedUnits(order, item),
                                                        )
                                                        .map((item) => (
                                                            <label
                                                                className="field partial-receipt-item"
                                                                key={item.productId}
                                                            >
                                                                <span>
                                                                    {item.productName} · {item.sku}
                                                                </span>
                                                                <input
                                                                    aria-label={`Received now for ${item.sku}`}
                                                                    type="number"
                                                                    min="0"
                                                                    max={
                                                                        item.quantity -
                                                                        receivedUnits(order, item)
                                                                    }
                                                                    step="1"
                                                                    value={
                                                                        receiptDraft[
                                                                            item.productId
                                                                        ] ?? 0
                                                                    }
                                                                    onChange={(e) =>
                                                                        setReceiptDraft(
                                                                            (values) => ({
                                                                                ...values,
                                                                                [item.productId]:
                                                                                    Number(
                                                                                        e.target
                                                                                            .value,
                                                                                    ),
                                                                            }),
                                                                        )
                                                                    }
                                                                />
                                                                <small>
                                                                    {item.quantity -
                                                                        receivedUnits(
                                                                            order,
                                                                            item,
                                                                        )}{" "}
                                                                    units outstanding
                                                                </small>
                                                            </label>
                                                        ))}
                                                    {receiptError && (
                                                        <p
                                                            className="auth-error"
                                                            role="alert"
                                                        >
                                                            {receiptError}
                                                        </p>
                                                    )}
                                                    {receiptProgress !==
                                                        purchaseProgress(order) && (
                                                        <p
                                                            className="auth-error"
                                                            role="alert"
                                                        >
                                                            This delivery changed on another device.
                                                            Close and reopen this form to review the
                                                            latest quantities.
                                                        </p>
                                                    )}
                                                    <div className="supplier-actions">
                                                        <button
                                                            className="button secondary"
                                                            type="button"
                                                            onClick={async () => setReceiving("")}
                                                        >
                                                            Close delivery entry
                                                        </button>
                                                        <button
                                                            className="button primary"
                                                            disabled={
                                                                receiptProgress !==
                                                                purchaseProgress(order)
                                                            }
                                                        >
                                                            Record received units
                                                        </button>
                                                    </div>
                                                </fieldset>
                                            </form>
                                        )}
                                    </>
                                )}
                            </details>
                        ))}
                    </div>
                    {!(cloud ? view.total : shown.length) && !view.pending && (
                        <p className="empty">
                            No purchases in this view. Start with a supplier and the products you
                            plan to order.
                        </p>
                    )}
                    <Pagination
                        label="Purchases"
                        {...paging}
                    />
                </CollapsibleCard>
            )}
        </>
    );
}
