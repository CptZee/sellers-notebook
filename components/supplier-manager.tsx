"use client";
import { SupplierProductPicker } from "./supplier-product-picker";
import type { CloudNotebook } from "../lib/use-notebook-view";
import type { SupplierView } from "./cloud-suppliers";
import { filterSuppliers } from "../lib/supplier-list.mjs";
import { confirmAction } from "./confirm-dialog";
import { useEffect, useRef, useState } from "react";
import type { QuickCreateRequest } from "./quick-create";
import dynamic from "next/dynamic";
const SupplierImport = dynamic(
    () => import("./supplier-import").then((module) => module.SupplierImport),
    {
        loading: () => (
            <p
                className="panel-loading"
                role="status"
            >
                Opening supplier importer…
            </p>
        ),
    },
);
import { EntryModal } from "./entry-modal";
import { CollapsibleCard } from "./collapsible-card";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import type { Product, Supplier } from "../lib/notebook-types";
import { validDocument } from "../lib/notebook-validation.mjs";

export function SupplierManager({
    suppliers,
    products,
    onChange,
    disabled,
    quickRequest,
    editorOnly = false,
    onStatement,
    serverView,
    prepareEntry,
    prepareDelete,
    onExport,
    cloud,
    onSaveRecord,
    onDeleteRecord,
    prepareImport,
    onImportRecords,
}: {
    onImportRecords?: (suppliers: Supplier[], revision: number) => Promise<void>;
    cloud?: CloudNotebook;
    onSaveRecord?: (supplier: Supplier, expected: Supplier | null) => Promise<void>;
    onDeleteRecord?: (supplier: Supplier) => Promise<void>;
    prepareImport?: () => Promise<unknown>;
    serverView?: SupplierView;
    prepareEntry?: (supplier?: Supplier) => Promise<Supplier | null>;
    prepareDelete?: (supplier: Supplier) => Promise<Supplier[]>;
    onExport?: (search: string) => void;
    suppliers: Supplier[];
    products: Product[];
    onChange: (suppliers: Supplier[]) => void;
    disabled: boolean;
    quickRequest?: QuickCreateRequest | null;
    editorOnly?: boolean;
    onStatement?: (id: string) => void;
}) {
    const [importing, setImporting] = useState(false),
        [draftId, setDraftId] = useState(""),
        [submitting, setSubmitting] = useState(false);
    const [localSearch, setLocalSearch] = useState(""),
        [editing, setEditing] = useState<Supplier | null>(null),
        [adding, setAdding] = useState(false),
        [error, setError] = useState(""),
        [productSearch, setProductSearch] = useState(""),
        [selected, setSelected] = useState<string[]>([]);
    const search = serverView?.search ?? localSearch,
        setSearch = serverView?.onSearch || setLocalSearch;
    const visible = serverView ? serverView.items : filterSuppliers(suppliers, products, search);
    const localPaging = usePagination(visible, search),
        paging = serverView?.paging || localPaging,
        pageItems = serverView ? visible : localPaging.items;
    const productPaging = usePagination(
        products.filter((p) =>
            (p.name + " " + p.sku).toLowerCase().includes(productSearch.toLowerCase()),
        ),
        productSearch,
    );
    function start(supplier: Supplier | null) {
        setDraftId(crypto.randomUUID());
        setEditing(supplier);
        setAdding(true);
        setError("");
        setSelected(supplier?.productIds || []);
        setProductSearch("");
    }
    const handled = useRef(0);
    useEffect(() => {
        if (quickRequest?.kind !== "supplier" || quickRequest.sequence === handled.current) return;
        handled.current = quickRequest.sequence;
        if (!adding) start(null);
        else if (editing)
            setError("Finish or cancel the current supplier edit before creating another.");
    }, [quickRequest]);

    async function save(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (disabled || submitting) return;
        if (editing && !onSaveRecord) {
            const current = suppliers.find((s) => s.id === editing.id);
            if (
                !current ||
                (
                    [
                        "name",
                        "contact",
                        "email",
                        "phone",
                        "address",
                        "notes",
                        "leadTimeDays",
                    ] as const
                ).some((key) => current[key] !== editing[key]) ||
                JSON.stringify(current.productIds) !== JSON.stringify(editing.productIds)
            ) {
                setError(
                    "This supplier changed on another device. Cancel and reopen the latest entry.",
                );
                return;
            }
        }
        const form = new FormData(event.currentTarget);
        const supplier: Supplier = {
            id: editing?.id || draftId,
            name: String(form.get("name") || "").trim(),
            contact: String(form.get("contact") || "").trim(),
            email: String(form.get("email") || "").trim(),
            phone: String(form.get("phone") || "").trim(),
            address: String(form.get("address") || "").trim(),
            notes: String(form.get("notes") || "").trim(),
            leadTimeDays: Number(form.get("leadTimeDays")),
            productIds: selected,
        };
        const next = editing
            ? suppliers.map((s) => (s.id === editing.id ? supplier : s))
            : [...suppliers, supplier];
        if (
            onSaveRecord
                ? !supplier.name ||
                  !Number.isInteger(supplier.leadTimeDays) ||
                  supplier.leadTimeDays < 0 ||
                  supplier.leadTimeDays > 3650 ||
                  supplier.productIds.length > 3000
                : !validDocument({ products, orders: [], suppliers: next })
        ) {
            setError(
                "Check the supplier details, product links, and whole-number lead time. Up to 1,000 suppliers are supported.",
            );
            return;
        }
        setSubmitting(true);
        try {
            if (onSaveRecord) await onSaveRecord(supplier, editing);
            else onChange(next);
            setAdding(false);
            setEditing(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save this supplier.");
        } finally {
            setSubmitting(false);
        }
    }
    function exportCsv() {
        if (onExport) {
            onExport(search);
            return;
        }
        const rows = [
            [
                "Supplier",
                "Contact person",
                "Email",
                "Phone",
                "Address",
                "Lead time (days)",
                "Product SKUs",
                "Notes",
            ],
            ...visible.map((s) => [
                s.name,
                s.contact,
                s.email,
                s.phone,
                s.address,
                s.leadTimeDays,
                products
                    .filter((p) => s.productIds.includes(p.id))
                    .map((p) => p.sku)
                    .join("; "),
                s.notes,
            ]),
        ];
        const csv = rows
            .map((row) =>
                row
                    .map(
                        (cell) =>
                            '"' +
                            String(cell)
                                .replace(/^[\s]*[=+@-]/, "'$&")
                                .replaceAll('"', '""') +
                            '"',
                    )
                    .join(","),
            )
            .join("\r\n");
        const url = URL.createObjectURL(
            new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "notebook-suppliers.csv";
        anchor.click();
        URL.revokeObjectURL(url);
    }
    return (
        <div className="supplier-manager">
            {error && !adding && (
                <p
                    className="auth-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
            {!editorOnly && importing && (
                <SupplierImport
                    cloud={cloud && !cloud.hydrated ? cloud : undefined}
                    onSave={onImportRecords}
                    suppliers={suppliers}
                    products={products}
                    disabled={disabled || adding}
                    onClose={() => setImporting(false)}
                    onImport={(items) => onChange([...suppliers, ...items])}
                />
            )}
            {adding && (
                <EntryModal
                    className="supplier-editor"
                    title={editing ? "Edit supplier" : "New supplier"}
                    description="Keep the people behind your products close at hand."
                    onClose={() => {
                        setAdding(false);
                        setEditing(null);
                        setError("");
                    }}
                >
                    <form onSubmit={save}>
                        <fieldset disabled={disabled || submitting}>
                            <div className="supplier-fields">
                                <label className="field">
                                    <span>Supplier name</span>
                                    <input
                                        name="name"
                                        required
                                        maxLength={200}
                                        defaultValue={editing?.name}
                                    />
                                </label>
                                <label className="field">
                                    <span>Contact person</span>
                                    <input
                                        name="contact"
                                        maxLength={200}
                                        defaultValue={editing?.contact}
                                    />
                                </label>
                                <label className="field">
                                    <span>Supplier email</span>
                                    <input
                                        name="email"
                                        type="email"
                                        maxLength={254}
                                        defaultValue={editing?.email}
                                    />
                                </label>
                                <label className="field">
                                    <span>Supplier phone</span>
                                    <input
                                        name="phone"
                                        type="tel"
                                        maxLength={80}
                                        defaultValue={editing?.phone}
                                    />
                                </label>
                                <label className="field">
                                    <span>Lead time (days)</span>
                                    <input
                                        aria-label="Lead time (days)"
                                        name="leadTimeDays"
                                        type="number"
                                        min="0"
                                        max="3650"
                                        step="1"
                                        required
                                        defaultValue={editing?.leadTimeDays ?? 0}
                                    />
                                    <small>Typical delivery time; 0 means unspecified.</small>
                                </label>
                                <label className="field">
                                    <span>Supplier address</span>
                                    <textarea
                                        aria-label="Supplier address"
                                        name="address"
                                        rows={2}
                                        maxLength={1000}
                                        defaultValue={editing?.address}
                                    />
                                </label>
                                <label className="field supplier-notes">
                                    <span>Supplier notes</span>
                                    <textarea
                                        aria-label="Supplier notes"
                                        name="notes"
                                        rows={3}
                                        maxLength={1000}
                                        defaultValue={editing?.notes}
                                    />
                                </label>
                            </div>
                            {cloud && onSaveRecord ? (
                                <SupplierProductPicker
                                    cloud={cloud}
                                    selected={selected}
                                    onChange={setSelected}
                                />
                            ) : (
                                <>
                                    {" "}
                                    <details className="supplier-products">
                                        <summary>
                                            Linked inventory items · {selected.length} selected
                                        </summary>
                                        <label className="field">
                                            <span>Find products to link</span>
                                            <input
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                            />
                                        </label>
                                        <div className="supplier-product-options">
                                            {productPaging.items.map((p) => (
                                                <label key={p.id}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.includes(p.id)}
                                                        onChange={(e) =>
                                                            setSelected((ids) =>
                                                                e.target.checked
                                                                    ? [...ids, p.id]
                                                                    : ids.filter(
                                                                          (id) => id !== p.id,
                                                                      ),
                                                            )
                                                        }
                                                    />
                                                    <span>
                                                        {p.name}
                                                        <small>{p.sku}</small>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <Pagination
                                            label="Supplier products"
                                            {...productPaging}
                                        />
                                        {!products.length && (
                                            <p className="import-note">
                                                Add inventory products first, then link them here.
                                            </p>
                                        )}
                                    </details>
                                </>
                            )}
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
                                    type="button"
                                    className="button secondary"
                                    onClick={async () => {
                                        setAdding(false);
                                        setEditing(null);
                                        setError("");
                                    }}
                                >
                                    Cancel supplier edit
                                </button>
                                <button
                                    className="button primary"
                                    type="submit"
                                >
                                    Save supplier
                                </button>
                            </div>
                        </fieldset>
                    </form>
                </EntryModal>
            )}
            {!editorOnly && (
                <CollapsibleCard
                    title="Your supplier pages"
                    description={
                        serverView?.pending
                            ? serverView.error
                                ? "Supplier entries unavailable"
                                : "Opening supplier entries…"
                            : `${serverView?.total ?? visible.length} suppliers · private to this notebook`
                    }
                    actions={
                        <>
                            <button
                                className="button secondary"
                                disabled={disabled || adding}
                                onClick={async () => {
                                    try {
                                        setError("");
                                        if (prepareImport) await prepareImport();
                                        else await prepareEntry?.();
                                        setImporting(!importing);
                                    } catch (e) {
                                        setError(
                                            e instanceof Error
                                                ? e.message
                                                : "Could not open supplier import.",
                                        );
                                    }
                                }}
                            >
                                Import suppliers CSV
                            </button>
                            <button
                                className="button secondary"
                                disabled={disabled || serverView?.pending}
                                onClick={exportCsv}
                            >
                                Export suppliers
                            </button>
                            <button
                                className="button primary"
                                disabled={disabled || adding}
                                onClick={async () => {
                                    try {
                                        setError("");
                                        await prepareEntry?.();
                                        start(null);
                                    } catch (e) {
                                        setError(
                                            e instanceof Error
                                                ? e.message
                                                : "Could not open supplier entry.",
                                        );
                                    }
                                }}
                            >
                                Add supplier
                            </button>
                        </>
                    }
                >
                    <div className="supplier-search">
                        <label className="search">
                            <span className="sr-only">Search suppliers</span>
                            <input
                                placeholder="Search suppliers or product SKUs…"
                                maxLength={200}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </label>
                    </div>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Supplier / contact</th>
                                    <th>Reach them</th>
                                    <th>Products</th>
                                    <th>Lead time</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((s) => (
                                    <tr key={s.id}>
                                        <td>
                                            <strong>{s.name}</strong>
                                            <small>{s.contact}</small>
                                        </td>
                                        <td>
                                            <span>{s.email}</span>
                                            <small>{s.phone}</small>
                                        </td>
                                        <td>{s.productIds.length} linked items</td>
                                        <td>
                                            {s.leadTimeDays
                                                ? `${s.leadTimeDays} days`
                                                : "Unspecified"}
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                {onStatement && (
                                                    <button
                                                        className="text-button"
                                                        aria-label={`Statement for ${s.name}`}
                                                        onClick={() => onStatement(s.id)}
                                                    >
                                                        Statement
                                                    </button>
                                                )}
                                                <button
                                                    className="text-button"
                                                    disabled={disabled || adding}
                                                    aria-label={`Edit supplier ${s.name}`}
                                                    onClick={async () => {
                                                        try {
                                                            setError("");
                                                            const current = prepareEntry
                                                                ? await prepareEntry(s)
                                                                : s;
                                                            if (!current)
                                                                throw Error(
                                                                    "This supplier was removed. Refresh the list.",
                                                                );
                                                            start(current);
                                                        } catch (e) {
                                                            setError(
                                                                e instanceof Error
                                                                    ? e.message
                                                                    : "Could not open this supplier.",
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="text-button cancel"
                                                    disabled={disabled || adding}
                                                    aria-label={`Delete supplier ${s.name}`}
                                                    onClick={async () => {
                                                        if (
                                                            await confirmAction(
                                                                `Remove “${s.name}” from your suppliers? Inventory items and stock stay as they are.`,
                                                            )
                                                        ) {
                                                            try {
                                                                setError("");
                                                                if (onDeleteRecord)
                                                                    await onDeleteRecord(s);
                                                                else {
                                                                    const current = prepareDelete
                                                                        ? await prepareDelete(s)
                                                                        : suppliers;
                                                                    onChange(
                                                                        current.filter(
                                                                            (item) =>
                                                                                item.id !== s.id,
                                                                        ),
                                                                    );
                                                                }
                                                            } catch (e) {
                                                                setError(
                                                                    e instanceof Error
                                                                        ? e.message
                                                                        : "Could not remove this supplier.",
                                                                );
                                                            }
                                                        }
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {serverView?.pending ? (
                            <div
                                className="empty"
                                role="status"
                            >
                                {serverView.error || "Opening suppliers…"}
                                {serverView.error && (
                                    <button
                                        className="text-button"
                                        onClick={serverView.retry}
                                    >
                                        Retry suppliers
                                    </button>
                                )}
                            </div>
                        ) : (
                            !visible.length && (
                                <p className="empty">
                                    {search
                                        ? "No matching suppliers. Try a different search."
                                        : "Your supplier pages are ready. Add your first supplier to begin."}
                                </p>
                            )
                        )}
                    </div>
                    {!serverView?.pending && (
                        <Pagination
                            label="Suppliers"
                            {...paging}
                        />
                    )}
                </CollapsibleCard>
            )}
        </div>
    );
}
