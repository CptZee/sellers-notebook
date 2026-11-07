"use client";
import { Pagination } from "./pagination";
import { CollapsibleCard } from "./collapsible-card";
import { useCallback, useEffect, useState, useRef } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import type { Product } from "../lib/notebook-types";
import { AccountStorage } from "./account-storage";
type Attachment = {
    id: string;
    filename: string;
    size: number;
    productId: string | null;
    productName?: string | null;
    productSku?: string | null;
};
type ProductPage = {
    revision: number;
    items: { product: Product }[];
    page: number;
    pages: number;
    pageSize: number;
    start: number;
    end: number;
    total: number;
};
export function NotebookAttachments({
    userId,
    revision,
    products,
    selectedProduct,
    onSelectProduct,
    disabled = false,
}: {
    revision: number;
    userId: string;
    products: Product[];
    selectedProduct: string;
    onSelectProduct: (id: string) => void;
    disabled?: boolean;
}) {
    const [expanded, setExpanded] = useState(true),
        [search, setSearch] = useState(""),
        [page, setPage] = useState(1),
        [size, setSize] = useState(25),
        [attempt, setAttempt] = useState(0);
    const productKey = JSON.stringify([userId, revision, search, page, size]),
        [choices, setChoices] = useState<{ key: string; data?: ProductPage; error?: string }>({
            key: "",
        });
    const productPage = choices.key === productKey ? choices.data : undefined;
    const [selectedLabel, setSelectedLabel] = useState<{ id: string; label: string } | null>(null);
    useEffect(() => {
        if (!expanded) return;
        const controller = new AbortController();
        void fetch(
            "/api/notebook/inventory?" +
                new URLSearchParams({
                    revision: String(revision),
                    search,
                    page: String(page),
                    size: String(size),
                }),
            {
                cache: "no-store",
                headers: { "X-Notebook-User": userId },
                signal: controller.signal,
            },
        )
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw Error(data.error || "Could not load product choices.");
                if (
                    data.revision !== revision ||
                    !Array.isArray(data.items) ||
                    data.items.length > size
                )
                    throw Error("Product choices changed. Please retry.");
                if (!controller.signal.aborted) setChoices({ key: productKey, data });
            })
            .catch((e) => {
                if (!controller.signal.aborted) setChoices({ key: productKey, error: e.message });
            });
        return () => controller.abort();
    }, [productKey, expanded, attempt]);
    useEffect(() => {
        if (!selectedProduct || selectedProduct === "general") return;
        const controller = new AbortController();
        void fetch(
            "/api/notebook/record?" +
                new URLSearchParams({
                    collection: "products",
                    id: selectedProduct,
                    revision: String(revision),
                }),
            {
                cache: "no-store",
                headers: { "X-Notebook-User": userId },
                signal: controller.signal,
            },
        )
            .then(async (response) => {
                if (response.status === 404 && !controller.signal.aborted) {
                    onSelectProduct("");
                    return;
                }
                if (!response.ok) return;
                const data = await response.json();
                if (!controller.signal.aborted && data.record)
                    setSelectedLabel({
                        id: selectedProduct,
                        label: data.record.name + " · " + data.record.sku,
                    });
            })
            .catch(() => {});
        return () => controller.abort();
    }, [userId, revision, selectedProduct, onSelectProduct]);
    const productChoices = productPage?.items.map((item) => item.product) || [];
    const [files, setFiles] = useState<Attachment[]>([]),
        [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    const version = useRef(0),
        [nextCursor, setNextCursor] = useState<string | null>(null),
        [loading, setLoading] = useState(false),
        [loadingMore, setLoadingMore] = useState(false);
    const load = useCallback(
        async (cursor?: string) => {
            const current = cursor ? version.current : ++version.current;
            if (!cursor) {
                setFiles([]);
                setNextCursor(null);
                setLoading(true);
            }
            try {
                const params = new URLSearchParams({ limit: "25" });
                if (selectedProduct === "general") params.set("unlinked", "1");
                else if (selectedProduct) params.set("productId", selectedProduct);
                if (cursor) params.set("cursor", cursor);
                const response = await fetch("/api/attachments?" + params.toString(), {
                    cache: "no-store",
                    headers: { "X-Notebook-User": userId },
                });
                if (!response.ok) {
                    if (current === version.current)
                        throw Error("Could not load your attachments.");
                    return;
                }
                const data = await response.json();
                if (current !== version.current) return;
                setFiles((previous) =>
                    cursor
                        ? [
                              ...previous,
                              ...data.attachments.filter(
                                  (file: Attachment) =>
                                      !previous.some((item) => item.id === file.id),
                              ),
                          ]
                        : data.attachments,
                );
                setNextCursor(data.nextCursor || null);
            } finally {
                if (current === version.current) setLoading(false);
            }
        },
        [userId, selectedProduct, revision],
    );
    useEffect(() => {
        setError("");
        load().catch((e) => setError(e.message));
    }, [load]);

    async function upload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setBusy(true);
        setError("");
        try {
            const r = await fetch("/api/attachments", {
                method: "POST",
                headers: {
                    "X-Notebook-User": userId,
                    "Content-Type": file.type,
                    "X-File-Name": encodeURIComponent(file.name),
                    ...(selectedProduct && selectedProduct !== "general"
                        ? { "X-Product-Id": selectedProduct }
                        : {}),
                },
                body: file,
            });
            if (!r.ok) throw new Error((await r.json()).error || "Upload failed.");
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed.");
        } finally {
            setBusy(false);
            e.target.value = "";
            window.dispatchEvent(new Event("notebook-storage-changed"));
        }
    }
    async function remove(id: string) {
        setBusy(true);
        setError("");
        try {
            const r = await fetch(`/api/attachments/${id}`, {
                method: "DELETE",
                headers: { "X-Notebook-User": userId },
            });
            if (!r.ok) throw new Error("Could not delete that attachment.");
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not delete that attachment.");
        } finally {
            setBusy(false);
            window.dispatchEvent(new Event("notebook-storage-changed"));
        }
    }
    async function link(id: string, productId: string) {
        setBusy(true);
        setError("");
        try {
            const r = await fetch(`/api/attachments/${id}`, {
                method: "PATCH",
                headers: { "X-Notebook-User": userId, "Content-Type": "application/json" },
                body: JSON.stringify({ productId: productId || null }),
            });
            if (!r.ok) throw Error((await r.json()).error || "Could not link this file.");
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not link this file.");
        } finally {
            setBusy(false);
            window.dispatchEvent(new Event("notebook-storage-changed"));
        }
    }
    return (
        <CollapsibleCard
            onOpenChange={setExpanded}
            className="attachments-card"
            id="product-attachments"
            title="Tucked between the pages"
            description={<> Receipts, product photos, and documents linked to your inventory. </>}
            actions={
                <>
                    {" "}
                    <label className="button secondary upload-button">
                        <Upload size={15} />
                        {busy ? "One moment…" : "Attach a file"}
                        <input
                            aria-label="Attach a file"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
                            disabled={busy || loadingMore || disabled}
                            onChange={upload}
                        />
                    </label>{" "}
                </>
            }
        >
            <AccountStorage
                userId={userId}
                compact
            />
            <div className="attachments-body">
                <label className="field">
                    <span>Find a product for files</span>
                    <input
                        aria-label="Find a product for files"
                        maxLength={200}
                        value={search}
                        placeholder="Product name or SKU"
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                </label>
                {productPage ? (
                    <Pagination
                        label="File products"
                        {...productPage}
                        setPage={setPage}
                        setPageSize={(value) => {
                            setSize(value);
                            setPage(1);
                        }}
                    />
                ) : (
                    <p role="status">
                        {(choices.key === productKey && choices.error) || "Finding products…"}
                        {choices.key === productKey && choices.error && (
                            <button
                                className="text-button"
                                onClick={() => setAttempt((n) => n + 1)}
                            >
                                Retry file products
                            </button>
                        )}
                    </p>
                )}
                <label className="field attachment-product-filter">
                    <span>Files for inventory item</span>
                    <select
                        aria-label="Files for inventory item"
                        value={selectedProduct}
                        onChange={(e) => onSelectProduct(e.target.value)}
                        disabled={busy || loadingMore}
                    >
                        <option value="">All files</option>
                        <option value="general">Unlinked notebook files</option>
                        {selectedProduct &&
                            selectedProduct !== "general" &&
                            !productChoices.some((p) => p.id === selectedProduct) && (
                                <option value={selectedProduct}>
                                    {selectedLabel?.id === selectedProduct
                                        ? selectedLabel.label
                                        : "Selected inventory item"}
                                </option>
                            )}
                        {productChoices.map((product) => (
                            <option
                                key={product.id}
                                value={product.id}
                            >
                                {product.name} · {product.sku}
                            </option>
                        ))}
                    </select>
                </label>
                <p className="import-note">
                    {selectedProduct && selectedProduct !== "general"
                        ? "New uploads will be linked to this product."
                        : "New uploads stay unlinked until you choose a product."}{" "}
                    Files load 25 at a time as you request more.
                </p>
                {error && (
                    <p
                        className="auth-error"
                        role="alert"
                    >
                        {error}
                    </p>
                )}
                {loading ? (
                    <p
                        className="attachments-empty"
                        role="status"
                    >
                        Opening files…
                    </p>
                ) : files.length ? (
                    files.map((file) => (
                        <div
                            className="attachment"
                            key={file.id}
                        >
                            <Paperclip size={16} />
                            <a href={`/api/attachments/${file.id}`}>{file.filename}</a>
                            <small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
                            <label className="field attachment-product-link">
                                <span className="sr-only">Linked product for {file.filename}</span>
                                <select
                                    aria-label={`Linked product for ${file.filename}`}
                                    value={file.productId || ""}
                                    disabled={busy || loadingMore || disabled}
                                    onChange={(e) => void link(file.id, e.target.value)}
                                >
                                    <option value="">Unlinked</option>
                                    {file.productId &&
                                        !productChoices.some(
                                            (product) => product.id === file.productId,
                                        ) && (
                                            <option value={file.productId}>
                                                {file.productName
                                                    ? file.productName + " · " + file.productSku
                                                    : "Linked inventory item"}
                                            </option>
                                        )}
                                    {productChoices.map((product) => (
                                        <option
                                            key={product.id}
                                            value={product.id}
                                        >
                                            {product.name} · {product.sku}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button
                                className="icon-button"
                                aria-label={`Delete ${file.filename}`}
                                disabled={busy || loadingMore || disabled}
                                onClick={() => void remove(file.id)}
                            >
                                <X size={15} />
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="attachments-empty">
                        No files here yet. PDF, images, CSV, or text · up to 5 MB each.
                    </p>
                )}
                {nextCursor && (
                    <button
                        className="button secondary attachment-load-more"
                        disabled={busy || loadingMore || loading}
                        onClick={() => {
                            setLoadingMore(true);
                            setError("");
                            void load(nextCursor)
                                .catch((e) => setError(e.message))
                                .finally(() => setLoadingMore(false));
                        }}
                    >
                        {loadingMore ? "Loading files…" : "Load more files"}
                    </button>
                )}
            </div>
        </CollapsibleCard>
    );
}
