"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadNotebookPages, NotebookReadError, type NotebookPageCache } from "./load-notebook.mjs";
import { canonicalJson, createNotebookPatch } from "./notebook-patch.mjs";
import { sampleStorageKey } from "./sample-notebook.mjs";
import type {
    Product,
    Expense,
    Branding,
    StockAdjustment,
    RefundRecord,
    Supplier,
    PurchaseOrder,
} from "./notebook-types";

export type NotebookUser = { id: string; name: string; email: string; image?: string | null };
type Document<P, O> = {
    products: P[];
    orders: O[];
    expenses?: Expense[];
    sidebarNote?: string;
    branding?: Branding | null;
    stockAdjustments?: StockAdjustment[];
    refundRecords?: RefundRecord[];
    suppliers?: Supplier[];
    purchaseOrders?: PurchaseOrder[];
};
// Postgres JSONB reorders object keys; compare values consistently across devices.
const serialize = canonicalJson;
export function useNotebook<P, O>(sample: Document<P, O>) {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<P[]>([]);
    const [orders, setOrders] = useState<O[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [refundRecords, setRefundRecords] = useState<RefundRecord[]>([]);
    const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
    const [branding, setBranding] = useState<Branding | null>(null);
    const [sidebarNote, setSidebarNote] = useState("");
    const [ready, setReady] = useState(false);
    const [user, setUser] = useState<NotebookUser | null>(null);
    const [mode, setMode] = useState<"loading" | "cloud" | "demo" | "error">("loading");
    const [status, setStatus] = useState("Opening your notebook…");
    const [issue, setIssue] = useState("");
    const [retry, setRetry] = useState(0);
    const [hydrated, setHydrated] = useState(false),
        [hydrating, setHydrating] = useState(false),
        [counts, setCounts] = useState<Record<string, number>>({});
    const hydratedRef = useRef(false),
        hydrateTask = useRef<Promise<Document<P, O>> | null>(null),
        recordWriting = useRef(false);
    const inFlight = useRef(""),
        replaceNext = useRef(false);
    const readCache = useRef<NotebookPageCache | null>(null),
        loadGeneration = useRef(0),
        readController = useRef<AbortController | null>(null),
        remoteTarget = useRef(0),
        remoteReading = useRef<number | null>(null);
    useEffect(
        () => () => {
            loadGeneration.current++;
            readController.current?.abort();
        },
        [],
    );
    const revision = useRef(0),
        saved = useRef(""),
        latest = useRef(""),
        saving = useRef(false),
        blocked = useRef(false),
        currentMode = useRef(mode);
    currentMode.current = mode;
    latest.current = serialize({
        products,
        orders,
        expenses,
        sidebarNote,
        branding,
        stockAdjustments,
        refundRecords,
        suppliers,
        purchaseOrders,
    });

    const openDemo = useCallback(() => {
        loadGeneration.current++;
        readController.current?.abort();
        remoteTarget.current = 0;
        blocked.current = false;
        replaceNext.current = false;
        hydratedRef.current = true;
        setHydrated(true);
        setHydrating(false);
        let document = sample;
        try {
            const raw = localStorage.getItem(sampleStorageKey);
            if (raw) {
                const d = JSON.parse(raw);
                if (Array.isArray(d.products) && Array.isArray(d.orders)) document = d;
            }
        } catch {
            /* Sample notebook still works without browser storage. */
        }
        setPurchaseOrders(
            document.purchaseOrders ||
                (sample.purchaseOrders || []).filter((order) =>
                    order.items.every((item) =>
                        document.products.some((p) => (p as { id: string }).id === item.productId),
                    ),
                ),
        );
        setSuppliers(
            document.suppliers ||
                (sample.suppliers || []).map((s) => ({
                    ...s,
                    productIds: s.productIds.filter((id) =>
                        document.products.some((p) => (p as { id: string }).id === id),
                    ),
                })),
        );
        setProducts(document.products);
        setOrders(document.orders);
        setExpenses(document.expenses || []);
        setSidebarNote(document.sidebarNote || "");
        setBranding(document.branding || null);
        setStockAdjustments(document.stockAdjustments || []);
        setRefundRecords(document.refundRecords || []);
        setMode("demo");
        setReady(true);
        setIssue("");
        setStatus("Sample notebook · this browser");
    }, [sample]);

    const load = useCallback(async () => {
        const generation = ++loadGeneration.current;
        readController.current?.abort();
        const controller = new AbortController();
        readController.current = controller;
        remoteTarget.current = 0;
        replaceNext.current = false;
        hydratedRef.current = false;
        setHydrated(false);
        setHydrating(false);
        hydrateTask.current = null;
        setMode("loading");
        setReady(false);
        setIssue("");
        setStatus("Opening your notebook…");
        try {
            const loaded = await loadNotebookPages({
                signal: controller.signal,
                cache: readCache.current,
                collections: [],
                onProgress: (done, total) => {
                    if (generation === loadGeneration.current && total)
                        setStatus(`Opening your notebook… ${done}/${total}`);
                },
            });
            if (generation !== loadGeneration.current) return;
            readCache.current = loaded.cache;
            setCounts(
                Object.fromEntries(
                    Object.entries(loaded.collections).map(([key, info]) => [key, info.count]),
                ),
            );
            const data = { ...loaded, document: loaded.document as Document<P, O> };
            revision.current = data.revision;
            saved.current = serialize({
                ...data.document,
                expenses: data.document.expenses || [],
                sidebarNote: data.document.sidebarNote || "",
                branding: data.document.branding || null,
                stockAdjustments: data.document.stockAdjustments || [],
                refundRecords: data.document.refundRecords || [],
                suppliers: data.document.suppliers || [],
                purchaseOrders: data.document.purchaseOrders || [],
            });
            blocked.current = false;
            setPurchaseOrders(data.document.purchaseOrders || []);
            setSuppliers(data.document.suppliers || []);
            setProducts(data.document.products);
            setOrders(data.document.orders);
            setExpenses(data.document.expenses || []);
            setSidebarNote(data.document.sidebarNote || "");
            setBranding(data.document.branding || null);
            setStockAdjustments(data.document.stockAdjustments || []);
            setRefundRecords(data.document.refundRecords || []);
            setUser(data.user);
            setMode("cloud");
            setReady(true);
            setStatus("Saved to your account");
        } catch (error) {
            if (generation !== loadGeneration.current || controller.signal.aborted) return;
            if (error instanceof NotebookReadError && error.status === 401) {
                readCache.current = null;
                location.assign("/auth/sign-in");
                return;
            }
            setMode("error");
            setIssue(error instanceof Error ? error.message : "Could not open your notebook.");
            setStatus("Connection unavailable");
        }
    }, [openDemo]);
    useEffect(() => {
        void load();
    }, [load]);
    const ensureHydrated = useCallback(async () => {
        if (hydratedRef.current) return JSON.parse(latest.current) as Document<P, O>;
        if (hydrateTask.current) return hydrateTask.current;
        if (
            currentMode.current !== "cloud" ||
            blocked.current ||
            saving.current ||
            latest.current !== saved.current
        )
            throw Error("Finish saving or reconnect before opening this tool.");
        const generation = ++loadGeneration.current,
            controller = new AbortController();
        readController.current?.abort();
        readController.current = controller;
        setHydrating(true);
        setReady(false);
        setStatus("Opening your notebook tools…");
        const task = (async () => {
            try {
                const loaded = await loadNotebookPages({
                    signal: controller.signal,
                    cache: readCache.current,
                    userId: readCache.current?.ownerId,
                });
                if (generation !== loadGeneration.current || currentMode.current !== "cloud")
                    throw Error("The notebook changed while opening this tool.");
                const document = loaded.document as Document<P, O>;
                readCache.current = loaded.cache;
                revision.current = loaded.revision;
                saved.current = serialize(document);
                hydratedRef.current = true;
                setCounts(
                    Object.fromEntries(
                        Object.entries(loaded.collections).map(([key, info]) => [key, info.count]),
                    ),
                );
                setPurchaseOrders(document.purchaseOrders || []);
                setSuppliers(document.suppliers || []);
                setProducts(document.products);
                setOrders(document.orders);
                setExpenses(document.expenses || []);
                setSidebarNote(document.sidebarNote || "");
                setBranding(document.branding || null);
                setStockAdjustments(document.stockAdjustments || []);
                setRefundRecords(document.refundRecords || []);
                setHydrated(true);
                setReady(true);
                setIssue("");
                setStatus("Saved to your account");
                return document;
            } catch (error) {
                if (generation === loadGeneration.current) {
                    setReady(true);
                    blocked.current = true;
                    setIssue(
                        "This tool could not be opened. Reload the saved notebook and try again.",
                    );
                }
                throw error;
            } finally {
                if (generation === loadGeneration.current) {
                    hydrateTask.current = null;
                    setHydrating(false);
                }
            }
        })();
        hydrateTask.current = task;
        return task;
    }, []);

    async function readRecord<T extends Product | Expense | Supplier>(
        collection: "products" | "expenses" | "suppliers",
        id = "",
    ) {
        if (
            currentMode.current !== "cloud" ||
            blocked.current ||
            saving.current ||
            latest.current !== saved.current
        )
            throw Error("Finish saving or reconnect before opening this entry.");
        const owner = readCache.current?.ownerId,
            generation = loadGeneration.current,
            expectedRevision = revision.current;
        if (!owner) throw Error("Sign in again to open this entry.");
        const response = await fetch(
                "/api/notebook/record?" +
                    new URLSearchParams({ collection, id, revision: String(expectedRevision) }),
                { cache: "no-store", headers: { "X-Notebook-User": owner } },
            ),
            data = await response.json();
        if (
            generation !== loadGeneration.current ||
            currentMode.current !== "cloud" ||
            readCache.current?.ownerId !== owner ||
            revision.current !== expectedRevision
        )
            throw Error("Records changed while opening this entry. Please try again.");
        if (!response.ok) throw Error(data.error || "Could not open this record.");
        return data as { record: T | null; count: number; revision: number };
    }
    async function saveRecord(
        collection: "products" | "expenses" | "suppliers",
        record: Product | Expense | Supplier | null,
        expected: Product | Expense | Supplier | null,
    ) {
        const id = record?.id || expected?.id;
        if (!id) throw Error("This record could not be identified.");
        return saveTargeted("/api/notebook/record", { collection, id, record, expected });
    }
    async function saveOrder(command: Record<string, unknown>) {
        return saveTargeted("/api/notebook/order", command);
    }
    async function saveMarketplaceImport(
        payload: Record<string, unknown>,
        expectedRevision: number,
    ) {
        if (revision.current !== expectedRevision)
            throw Error("Records changed. Review a fresh marketplace preview.");
        return saveTargeted("/api/notebook/marketplace-import", { ...payload, mode: "commit" });
    }
    async function saveSupplierImport(suppliers: Supplier[], expectedRevision: number) {
        if (revision.current !== expectedRevision)
            throw Error("Records changed. Review a fresh supplier preview.");
        return saveTargeted("/api/notebook/supplier-import", { mode: "commit", suppliers });
    }
    async function saveInventoryImport(products: Product[], expectedRevision: number) {
        if (revision.current !== expectedRevision)
            throw Error("Inventory changed. Review a fresh preview before importing.");
        return saveTargeted("/api/notebook/inventory-import", { mode: "commit", products });
    }
    async function saveStock(command: Record<string, unknown>) {
        return saveTargeted("/api/notebook/stock", command);
    }
    async function savePurchase(command: Record<string, unknown>) {
        return saveTargeted("/api/notebook/purchase", command);
    }
    async function saveTargeted(endpoint: string, payload: Record<string, unknown>) {
        if (
            currentMode.current !== "cloud" ||
            hydratedRef.current ||
            blocked.current ||
            saving.current ||
            latest.current !== saved.current
        )
            throw Error("Finish saving or reload the saved notebook before continuing.");
        const owner = readCache.current?.ownerId,
            generation = ++loadGeneration.current;
        if (!owner) throw Error("Sign in again to save this entry.");
        readController.current?.abort();
        recordWriting.current = true;
        saving.current = true;
        setReady(false);
        setStatus("Saving record…");
        let committed = false;
        try {
            const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Notebook-User": owner },
                    body: JSON.stringify({ ...payload, revision: revision.current }),
                }),
                data = await response.json();
            if (!response.ok) throw Error(data.error || "Could not save this record.");
            committed = true;
            const loaded = await loadNotebookPages({
                cache: readCache.current,
                userId: owner,
                collections: [],
            });
            if (generation !== loadGeneration.current || currentMode.current !== "cloud")
                throw Error("The notebook changed while saving.");
            const document = loaded.document as Document<P, O>;
            readCache.current = loaded.cache;
            revision.current = loaded.revision;
            saved.current = serialize(document);
            setCounts(
                Object.fromEntries(
                    Object.entries(loaded.collections).map(([key, info]) => [key, info.count]),
                ),
            );
            setSidebarNote(document.sidebarNote || "");
            setBranding(document.branding || null);
            setIssue("");
            setStatus("Saved to your account");
        } catch (error) {
            if (generation === loadGeneration.current) {
                if (committed) {
                    blocked.current = true;
                    setIssue(
                        "Your record was saved, but the latest notebook could not be refreshed. Reload before editing again.",
                    );
                }
                setStatus(committed ? "Reload saved notebook" : "Record not saved");
            }
            throw error;
        } finally {
            recordWriting.current = false;
            saving.current = false;
            if (generation === loadGeneration.current) setReady(true);
            if (generation === loadGeneration.current && remoteTarget.current > revision.current)
                queueMicrotask(() => void acceptRevision(remoteTarget.current));
        }
    }

    useEffect(() => {
        if (!ready) return;
        if (mode === "demo") {
            try {
                localStorage.setItem(sampleStorageKey, latest.current);
                setStatus("Sample notebook · saved in this browser");
            } catch {
                setIssue("Browser storage is unavailable. Changes only last for this session.");
            }
            return;
        }
        if (mode !== "cloud" || blocked.current || latest.current === saved.current) return;
        setStatus("Unsaved changes");
        const timer = setTimeout(async () => {
            if (saving.current) return;
            saving.current = true;
            try {
                while (latest.current !== saved.current && currentMode.current === "cloud") {
                    setStatus("Saving to your account…");
                    const snapshot = latest.current;
                    inFlight.current = snapshot;
                    const replacement = replaceNext.current;
                    const payload = replacement
                        ? { revision: revision.current, document: JSON.parse(snapshot) }
                        : {
                              revision: revision.current,
                              changes: createNotebookPatch(
                                  JSON.parse(saved.current),
                                  JSON.parse(snapshot),
                              ),
                          };
                    const response = await fetch("/api/notebook", {
                        method: replacement ? "PUT" : "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Notebook-User": user!.id,
                            ...(replacement ? { "X-Notebook-Restore": "true" } : {}),
                        },
                        body: JSON.stringify(payload),
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        if (response.status === 409 || response.status === 401)
                            blocked.current = true;
                        throw new Error(data.error || "Your changes could not be saved.");
                    }
                    replaceNext.current = false;
                    revision.current = data.revision;
                    saved.current = snapshot;
                    setIssue("");
                    setStatus("Saved to your account");
                }
            } catch (error) {
                setIssue(
                    error instanceof Error ? error.message : "Your changes could not be saved.",
                );
                setStatus("Changes not saved");
            } finally {
                saving.current = false;
                inFlight.current = "";
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [
        products,
        orders,
        expenses,
        sidebarNote,
        branding,
        stockAdjustments,
        refundRecords,
        suppliers,
        purchaseOrders,
        mode,
        ready,
        retry,
    ]);

    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (currentMode.current === "cloud" && latest.current !== saved.current) {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, []);

    const acceptRemote = useCallback(
        (
            document: unknown,
            remoteRevision: number,
            collections?: Record<string, { count: number }>,
        ) => {
            if (currentMode.current !== "cloud" || remoteRevision <= revision.current) return;
            const normalized = {
                ...(document as Document<P, O>),
                expenses: (document as Document<P, O>).expenses || [],
                sidebarNote: (document as Document<P, O>).sidebarNote || "",
                branding: (document as Document<P, O>).branding || null,
                stockAdjustments: (document as Document<P, O>).stockAdjustments || [],
                refundRecords: (document as Document<P, O>).refundRecords || [],
                suppliers: (document as Document<P, O>).suppliers || [],
                purchaseOrders: (document as Document<P, O>).purchaseOrders || [],
            };
            const snapshot = serialize(normalized);
            if (snapshot === inFlight.current) return;
            if (latest.current !== saved.current || saving.current) {
                blocked.current = true;
                setIssue(
                    "This notebook changed on another device. Reload the saved version to continue without losing newer changes.",
                );
                return;
            }
            const next = normalized;
            if (collections)
                setCounts(
                    Object.fromEntries(
                        Object.entries(collections).map(([key, info]) => [key, info.count]),
                    ),
                );
            revision.current = remoteRevision;
            saved.current = snapshot;
            setPurchaseOrders(next.purchaseOrders);
            setSuppliers(next.suppliers);
            setProducts(next.products);
            setOrders(next.orders);
            setExpenses(next.expenses);
            setSidebarNote(next.sidebarNote);
            setBranding(next.branding);
            setStockAdjustments(next.stockAdjustments);
            setRefundRecords(next.refundRecords);
            setStatus("Saved to your account");
        },
        [],
    );
    const acceptRevision = useCallback(
        async (remoteRevision: number) => {
            if (
                currentMode.current !== "cloud" ||
                !Number.isSafeInteger(remoteRevision) ||
                remoteRevision <= revision.current
            )
                return;
            remoteTarget.current = Math.max(remoteTarget.current, remoteRevision);
            if (recordWriting.current) return;
            const generation = loadGeneration.current;
            if (remoteReading.current === generation) return;
            remoteReading.current = generation;
            try {
                while (
                    currentMode.current === "cloud" &&
                    generation === loadGeneration.current &&
                    remoteTarget.current > revision.current
                ) {
                    const loaded = await loadNotebookPages({
                        cache: readCache.current,
                        userId: readCache.current?.ownerId,
                        collections: hydratedRef.current ? undefined : [],
                    });
                    if (currentMode.current !== "cloud" || generation !== loadGeneration.current)
                        return;
                    readCache.current = loaded.cache;
                    acceptRemote(loaded.document, loaded.revision, loaded.collections);
                    if (remoteTarget.current <= loaded.revision) break;
                }
            } catch (error) {
                if (currentMode.current !== "cloud" || generation !== loadGeneration.current)
                    return;
                if (error instanceof NotebookReadError && error.status === 401) {
                    readCache.current = null;
                    location.assign("/auth/sign-in");
                    return;
                }
                blocked.current = true;
                setIssue(
                    "Live changes could not be loaded. Reload the saved notebook before editing.",
                );
            } finally {
                if (remoteReading.current === generation) remoteReading.current = null;
            }
        },
        [acceptRemote],
    );
    const restoreDocument = (document: Document<P, O>) => {
        if (
            !ready ||
            mode !== "cloud" ||
            blocked.current ||
            saving.current ||
            latest.current !== saved.current
        )
            throw Error("Finish saving or reconnect before restoring a backup.");
        const normalized = {
            ...document,
            expenses: document.expenses || [],
            sidebarNote: document.sidebarNote || "",
            branding: document.branding || null,
            stockAdjustments: document.stockAdjustments || [],
            refundRecords: document.refundRecords || [],
            suppliers: document.suppliers || [],
            purchaseOrders: document.purchaseOrders || [],
        };
        if (serialize(normalized) === saved.current) return;
        replaceNext.current = true;
        hydratedRef.current = true;
        setHydrated(true);
        setPurchaseOrders(document.purchaseOrders || []);
        setSuppliers(document.suppliers || []);
        setProducts(document.products);
        setOrders(document.orders);
        setExpenses(document.expenses || []);
        setSidebarNote(document.sidebarNote || "");
        setBranding(document.branding || null);
        setStockAdjustments(document.stockAdjustments || []);
        setRefundRecords(document.refundRecords || []);
    };
    const hasUnsaved = mode === "cloud" && latest.current !== saved.current;
    return {
        saveMarketplaceImport,
        saveSupplierImport,
        saveInventoryImport,
        saveStock,
        savePurchase,
        saveOrder,
        readRecord,
        saveRecord,
        getRevision: () => revision.current,
        getDocument: () => JSON.parse(latest.current) as Document<P, O>,
        hydrated,
        hydrating,
        counts,
        ensureHydrated,
        revision: revision.current,
        documentKey: mode === "cloud" ? revision.current + "|" + latest.current : latest.current,
        purchaseOrders,
        setPurchaseOrders,
        suppliers,
        setSuppliers,
        refundRecords,
        setRefundRecords,
        restoreDocument,
        stockAdjustments,
        setStockAdjustments,
        branding,
        setBranding,
        sidebarNote,
        setSidebarNote,
        expenses,
        setExpenses,
        acceptRevision,
        acceptRemote,
        products,
        setProducts,
        orders,
        setOrders,
        ready,
        user,
        mode,
        status,
        issue,
        hasUnsaved,
        reload: load,
        openDemo,
        retrySave: () => setRetry((n) => n + 1),
        conflict: blocked.current,
    };
}
