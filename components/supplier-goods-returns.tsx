"use client";
import { useState } from "react";
import type { PurchaseOrder } from "../lib/notebook-types";
import {
    returnedUnits,
    returnCreditCents,
    returnRefundAvailable,
} from "../lib/supplier-returns.mjs";
import { receivedUnits } from "../lib/purchases.mjs";
import { paymentMethods } from "../lib/purchase-payments.mjs";
import { confirmAction } from "./confirm-dialog";
import { EntryModal } from "./entry-modal";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
export type GoodsCommand = (
    kind: string,
    id: string,
    input: Record<string, unknown>,
    expected: PurchaseOrder,
    entryId?: string,
) => Promise<void>;
const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
export function SupplierGoodsReturns({
    order,
    prepareEntry,
    onCommand,
    disabled,
}: {
    order: PurchaseOrder;
    prepareEntry?: (id?: string) => Promise<PurchaseOrder | null>;
    onCommand: GoodsCommand;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [entry, setEntry] = useState<{
            kind: "return" | "refund";
            id: string;
            expected: PurchaseOrder;
        }>();
    const returns = usePagination(order.goodsReturns || [], order.id),
        cash = usePagination(order.goodsReturnRefunds || [], order.id),
        today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    async function prepare() {
        setError("");
        return (await prepareEntry?.(order.id)) || order;
    }
    async function start(kind: "return" | "refund") {
        setBusy(true);
        setError("");
        try {
            const current = await prepare();
            if (
                kind === "return" &&
                !current.items.some(
                    (i) => receivedUnits(current, i) > returnedUnits(current, i.productId),
                )
            )
                throw Error("No unreturned received units remain on this purchase.");
            if (kind === "refund" && returnRefundAvailable(current) <= 0)
                throw Error("No paid credit is available for a returned-goods refund.");
            setEntry({ kind, id: crypto.randomUUID(), expected: current });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not open return entry.");
        } finally {
            setBusy(false);
        }
    }
    async function correct(kind: string, input: Record<string, unknown>, question: string) {
        setBusy(true);
        setError("");
        try {
            const current = await prepare();
            if (await confirmAction(question)) await onCommand(kind, order.id, input, current);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not correct this return.");
        } finally {
            setBusy(false);
        }
    }
    const baseline = entry?.expected;
    return (
        <>
            {entry && baseline && (
                <EntryModal
                    title={
                        entry.kind === "return"
                            ? "Return goods to supplier"
                            : "Record returned-goods cash refund"
                    }
                    description={baseline.reference + " · " + baseline.supplierName}
                    onClose={() => {
                        if (!busy) setEntry(undefined);
                    }}
                >
                    <form
                        onSubmit={async (event) => {
                            event.preventDefault();
                            if (busy) return;
                            setBusy(true);
                            setError("");
                            const form = new FormData(event.currentTarget);
                            try {
                                const input =
                                    entry.kind === "return"
                                        ? {
                                              items: baseline.items
                                                  .map((i) => ({
                                                      productId: i.productId,
                                                      quantity: Number(
                                                          form.get("units:" + i.productId) || 0,
                                                      ),
                                                  }))
                                                  .filter((i) => i.quantity > 0),
                                              date: String(form.get("date")),
                                              reason: String(form.get("reason")),
                                          }
                                        : {
                                              amount: Number(form.get("amount")),
                                              date: String(form.get("date")),
                                              method: String(form.get("method")),
                                              reference: String(form.get("reference") || ""),
                                              notes: String(form.get("notes") || ""),
                                          };
                                if (
                                    !(await confirmAction(
                                        entry.kind === "return"
                                            ? "Confirm these goods have already been sent back. This reduces recorded stock and creates item credit, not a cash refund."
                                            : "Confirm this money has already arrived from the supplier. This records cash separately and does not change stock.",
                                    ))
                                )
                                    return;
                                await onCommand(
                                    entry.kind === "return"
                                        ? "goods-return"
                                        : "goods-return-refund",
                                    order.id,
                                    input,
                                    baseline,
                                    entry.id,
                                );
                                setEntry(undefined);
                            } catch (e) {
                                setError(
                                    e instanceof Error ? e.message : "Could not save this return.",
                                );
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        <fieldset disabled={disabled || busy}>
                            {entry.kind === "return" ? (
                                <>
                                    <p className="import-note">
                                        Return only received goods still in your inventory. The item
                                        credit uses the purchase’s recorded unit cost; no
                                        replacement delivery is added automatically.
                                    </p>
                                    {baseline.items
                                        .filter(
                                            (i) =>
                                                receivedUnits(baseline, i) >
                                                returnedUnits(baseline, i.productId),
                                        )
                                        .map((i) => (
                                            <label
                                                className="field"
                                                key={i.productId}
                                            >
                                                <span>Return units for {i.sku}</span>
                                                <input
                                                    name={"units:" + i.productId}
                                                    aria-label={"Return units for " + i.sku}
                                                    type="number"
                                                    min={0}
                                                    step={1}
                                                    max={
                                                        receivedUnits(baseline, i) -
                                                        returnedUnits(baseline, i.productId)
                                                    }
                                                    defaultValue={0}
                                                />
                                                <small>
                                                    {receivedUnits(baseline, i) -
                                                        returnedUnits(baseline, i.productId)}{" "}
                                                    unreturned received units · {money(i.unitCost)}{" "}
                                                    each
                                                </small>
                                            </label>
                                        ))}
                                    <label className="field">
                                        <span>Reason for supplier return</span>
                                        <input
                                            name="reason"
                                            aria-label="Reason for supplier return"
                                            required
                                            maxLength={200}
                                        />
                                    </label>
                                </>
                            ) : (
                                <>
                                    <p className="import-note">
                                        Available returned-goods cash credit:{" "}
                                        {money(returnRefundAvailable(baseline))}. Unpaid return
                                        credit reduces the balance owed and cannot be recorded as
                                        cash received.
                                    </p>
                                    <label className="field">
                                        <span>Returned-goods refund amount</span>
                                        <input
                                            name="amount"
                                            aria-label="Returned-goods refund amount"
                                            type="number"
                                            min="0.01"
                                            max={returnRefundAvailable(baseline)}
                                            step="0.01"
                                            required
                                        />
                                    </label>
                                    <label className="field">
                                        <span>Returned-goods refund method</span>
                                        <select
                                            name="method"
                                            aria-label="Returned-goods refund method"
                                        >
                                            {paymentMethods.map((m) => (
                                                <option key={m}>{m}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="field">
                                        <span>Returned-goods refund reference</span>
                                        <input
                                            name="reference"
                                            maxLength={100}
                                        />
                                    </label>
                                    <label className="field">
                                        <span>Private return refund notes</span>
                                        <textarea
                                            name="notes"
                                            maxLength={500}
                                            rows={2}
                                        />
                                    </label>
                                </>
                            )}
                            <label className="field">
                                <span>
                                    {entry.kind === "return"
                                        ? "Supplier return date"
                                        : "Returned-goods refund date"}
                                </span>
                                <input
                                    name="date"
                                    aria-label={
                                        entry.kind === "return"
                                            ? "Supplier return date"
                                            : "Returned-goods refund date"
                                    }
                                    type="date"
                                    required
                                    min={new Date(baseline.createdAt).toLocaleDateString("en-CA", {
                                        timeZone: "Asia/Manila",
                                    })}
                                    max={today}
                                    defaultValue={today}
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
                                    onClick={() => setEntry(undefined)}
                                >
                                    Cancel return entry
                                </button>
                                <button className="button primary">
                                    {entry.kind === "return"
                                        ? "Record physical return"
                                        : "Record returned-goods refund"}
                                </button>
                            </div>
                        </fieldset>
                    </form>
                </EntryModal>
            )}
            <details
                className="supplier-goods-returns"
                onToggle={(event) => {
                    setOpen(event.currentTarget.open);
                    if (event.currentTarget.open) {
                        setBusy(true);
                        void prepare()
                            .catch((e) => setError(e.message))
                            .finally(() => setBusy(false));
                    }
                }}
            >
                <summary>Goods returns &amp; return refunds</summary>
                {open && (
                    <div className="supplier-goods-return-body">
                        <p className="import-note">
                            Delivery history stays unchanged. Returned item credit:{" "}
                            {money(returnCreditCents(order) / 100)} · cash credit available:{" "}
                            {money(returnRefundAvailable(order))}.
                        </p>
                        <div className="supplier-actions">
                            <button
                                className="button secondary"
                                disabled={disabled || busy}
                                onClick={() => void start("return")}
                            >
                                Return received goods
                            </button>
                            <button
                                className="button secondary"
                                disabled={disabled || busy || returnRefundAvailable(order) <= 0}
                                onClick={() => void start("refund")}
                            >
                                Record returned-goods cash
                            </button>
                        </div>
                        {busy && <p role="status">Opening the latest purchase…</p>}
                        {!entry && error && (
                            <p
                                className="auth-error"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}
                        {returns.items.map((r) => (
                            <div
                                className="goods-return-record"
                                key={r.id}
                            >
                                <strong>
                                    {r.date} · {r.voidedAt ? "Voided return" : "Goods returned"}
                                </strong>
                                <p>{r.reason}</p>
                                {r.items.map((i) => (
                                    <small key={i.productId}>
                                        {i.productName} · {i.sku} · {i.quantity} units ·{" "}
                                        {money(i.unitCost * i.quantity)}
                                    </small>
                                ))}
                                {!r.voidedAt && (
                                    <button
                                        className="text-button"
                                        disabled={disabled || busy}
                                        onClick={() =>
                                            void correct(
                                                "void-goods-return",
                                                { returnId: r.id },
                                                "Void this mistaken return and restore its units to stock? Confirm the goods are in your inventory. Correct supporting cash refund records first.",
                                            )
                                        }
                                    >
                                        Void goods return
                                    </button>
                                )}
                            </div>
                        ))}
                        <Pagination
                            label="Goods returns"
                            {...returns}
                        />
                        {cash.items.map((r) => (
                            <div
                                className="goods-return-record"
                                key={r.id}
                            >
                                <strong>
                                    {r.date} · {money(r.amount)} cash received
                                </strong>
                                <small>
                                    {r.method} · {r.reference}
                                </small>
                                {r.notes && <p>{r.notes}</p>}
                                <button
                                    className="text-button"
                                    disabled={disabled || busy}
                                    onClick={() =>
                                        void correct(
                                            "remove-goods-return-refund",
                                            { recordId: r.id },
                                            "Remove this mistaken cash refund entry? This corrects the notebook only; it does not reverse money received.",
                                        )
                                    }
                                >
                                    Remove returned-goods refund
                                </button>
                            </div>
                        ))}
                        <Pagination
                            label="Returned-goods refunds"
                            {...cash}
                        />
                    </div>
                )}
            </details>
        </>
    );
}
