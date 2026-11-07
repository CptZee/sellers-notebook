"use client";
import type { ExpenseView } from "./cloud-expenses";
import { confirmAction } from "./confirm-dialog";
import { EntryModal } from "./entry-modal";
import type { QuickCreateRequest } from "./quick-create";
import { CollapsibleCard } from "./collapsible-card";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import { useState, useEffect } from "react";
import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Expense } from "../lib/notebook-types";
import { expenseCategories } from "../lib/expenses.mjs";

const money = (value: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
export function ExpenseLedger({
    expenses,
    allExpenses,
    onSave,
    onDelete,
    disabled,
    viewKey = "",
    quickRequest,
    editorOnly = false,
    onExport,
    serverView,
    prepareEntry,
    prepareDelete,
    targeted = false,
}: {
    targeted?: boolean;
    serverView?: ExpenseView;
    prepareEntry?: (expense?: Expense) => Promise<Expense | null>;
    prepareDelete?: (expense: Expense) => Promise<void>;
    onExport?: (search: string, category: string) => void;
    expenses: Expense[];
    allExpenses: Expense[];
    onSave: (expense: Expense, expected?: Expense | null) => void | Promise<void>;
    onDelete: (id: string, expected?: Expense) => void | Promise<void>;
    disabled: boolean;
    viewKey?: string;
    quickRequest?: QuickCreateRequest | null;
    editorOnly?: boolean;
}) {
    const [editing, setEditing] = useState<Expense | null>(null),
        [error, setError] = useState(""),
        [localSearch, setLocalSearch] = useState(""),
        [localCategory, setLocalCategory] = useState("All categories");
    const [entryOpen, setEntryOpen] = useState(false),
        [draftId, setDraftId] = useState(""),
        [submitting, setSubmitting] = useState(false);
    const search = serverView?.search ?? localSearch,
        category = serverView?.category ?? localCategory,
        setSearch = serverView?.onSearch || setLocalSearch,
        setCategory = serverView?.onCategory || setLocalCategory;
    useEffect(() => {
        if (quickRequest?.kind === "expense") {
            setDraftId(crypto.randomUUID());
            setEditing(null);
            setError("");
            setEntryOpen(true);
        }
    }, [quickRequest]);
    const visible = serverView
        ? serverView.items
        : expenses
              .filter(
                  (e) =>
                      (category === "All categories" || e.category === category) &&
                      (e.title + " " + e.notes).toLowerCase().includes(search.toLowerCase()),
              )
              .toSorted((a, b) => b.date.localeCompare(a.date));
    const localPaging = usePagination(visible, [viewKey, search, category].join("|")),
        paging = serverView?.paging || localPaging,
        pageItems = serverView ? visible : localPaging.items;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;
        const formElement = event.currentTarget;
        setError("");
        if (editing && !targeted) {
            const current = allExpenses.find((expense) => expense.id === editing.id);
            if (
                !current ||
                (["title", "category", "amount", "date", "channel", "notes"] as const).some(
                    (key) => current[key] !== editing[key],
                )
            ) {
                setError(
                    "This expense changed or was removed on another device. Cancel this edit and reopen the latest entry.",
                );
                return;
            }
        }
        const form = new FormData(event.currentTarget);
        const expense: Expense = {
            id: editing?.id || draftId,
            title: String(form.get("title")).trim(),
            amount: Number(form.get("amount")),
            date: String(form.get("date")),
            category: String(form.get("category")),
            channel: String(form.get("channel")) as Expense["channel"],
            notes: String(form.get("notes") || "").trim(),
        };
        if (
            !expense.title ||
            !Number.isFinite(expense.amount) ||
            expense.amount <= 0 ||
            Math.abs(expense.amount * 100 - Math.round(expense.amount * 100)) > 0.00001
        ) {
            setError("Enter a title and a positive amount with no more than two decimal places.");
            return;
        }
        setSubmitting(true);
        try {
            await onSave(expense, editing);
            formElement.reset();
            setEditing(null);
            setEntryOpen(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not save this expense.");
        } finally {
            setSubmitting(false);
        }
    }
    function exportCsv() {
        if (onExport) {
            onExport(search, category);
            return;
        }
        const rows = [
            ["Date", "Title", "Category", "Channel", "Amount (PHP)", "Notes"],
            ...visible.map((e) => [
                e.date,
                e.title,
                e.category,
                e.channel,
                e.amount.toFixed(2),
                e.notes,
            ]),
        ];
        const data = rows
            .map((row) =>
                row
                    .map(
                        (cell) =>
                            '"' +
                            String(cell)
                                .replace(/^[=+@-]/, "'$&")
                                .replaceAll('"', '""') +
                            '"',
                    )
                    .join(","),
            )
            .join("\r\n");
        const url = URL.createObjectURL(
            new Blob(["\uFEFF" + data], { type: "text/csv;charset=utf-8" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "sellers-notebook-expenses.csv";
        anchor.click();
        URL.revokeObjectURL(url);
    }
    return (
        <div className="expense-layout">
            {error && !entryOpen && (
                <p
                    className="auth-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
            {entryOpen && (
                <EntryModal
                    className="expense-entry"
                    title={editing ? "Edit expense" : "New expense"}
                    description="Record the costs of keeping your shop going."
                    onClose={() => {
                        setEntryOpen(false);
                        setEditing(null);
                        setError("");
                    }}
                >
                    <form
                        key={editing?.id || "new"}
                        onSubmit={submit}
                    >
                        <fieldset disabled={disabled || submitting}>
                            <div className="expense-fields">
                                <label className="field">
                                    <span>Expense title</span>
                                    <input
                                        name="title"
                                        required
                                        maxLength={200}
                                        placeholder="e.g. November ad campaign"
                                        defaultValue={editing?.title}
                                    />
                                </label>
                                <label className="field">
                                    <span>Amount (₱)</span>
                                    <input
                                        name="amount"
                                        type="number"
                                        min="0.01"
                                        max="100000000"
                                        step="0.01"
                                        required
                                        defaultValue={editing?.amount}
                                    />
                                </label>
                                <label className="field">
                                    <span>Expense date</span>
                                    <input
                                        name="date"
                                        type="date"
                                        max={today}
                                        required
                                        defaultValue={editing?.date || today}
                                    />
                                </label>
                                <label className="field">
                                    <span>Expense category</span>
                                    <select
                                        name="category"
                                        defaultValue={editing?.category || "Advertising"}
                                    >
                                        {expenseCategories.map((category) => (
                                            <option key={category}>{category}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="field">
                                    <span>Expense applies to</span>
                                    <select
                                        name="channel"
                                        defaultValue={editing?.channel || "Business"}
                                    >
                                        <option value="Business">Whole business</option>
                                        {["Shopee", "Lazada", "TikTok Shop", "Direct"].map((c) => (
                                            <option key={c}>{c}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="field expense-notes">
                                    <span>Expense notes (optional)</span>
                                    <textarea
                                        name="notes"
                                        rows={2}
                                        maxLength={1000}
                                        defaultValue={editing?.notes}
                                    />
                                </label>
                            </div>
                            <p className="import-note">
                                Only add costs not already included on an order. Product costs,
                                platform fees, packaging, and shipping recorded on orders are
                                already deducted from order profit.
                            </p>
                            {error && (
                                <p
                                    className="auth-error"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            )}
                            <div className="expense-form-actions">
                                <button
                                    className="button secondary"
                                    type="button"
                                    onClick={async () => {
                                        setEntryOpen(false);
                                        setEditing(null);
                                        setError("");
                                    }}
                                >
                                    {editing ? "Cancel edit" : "Cancel"}
                                </button>
                                <button
                                    className="button primary"
                                    type="submit"
                                >
                                    <Plus size={15} />
                                    {editing ? "Save expense" : "Add expense"}
                                </button>
                            </div>
                        </fieldset>
                    </form>
                </EntryModal>
            )}
            {!editorOnly && (
                <CollapsibleCard
                    className="expense-list"
                    title={<>Your expense pages</>}
                    description={
                        serverView?.pending ? (
                            <>
                                {serverView.error
                                    ? "Expense entries unavailable"
                                    : "Opening expense entries…"}
                            </>
                        ) : (
                            <>
                                {" "}
                                {serverView?.total ?? visible.length} entries ·{" "}
                                {money(
                                    serverView?.totalAmount ??
                                        visible.reduce(
                                            (sum, e) => sum + Math.round(e.amount * 100),
                                            0,
                                        ) / 100,
                                )}{" "}
                                shown{" "}
                            </>
                        )
                    }
                    actions={
                        <>
                            {" "}
                            <button
                                className="button primary"
                                disabled={disabled}
                                onClick={async () => {
                                    setError("");
                                    try {
                                        await prepareEntry?.();
                                        setDraftId(crypto.randomUUID());
                                        setEditing(null);
                                        setEntryOpen(true);
                                    } catch (e) {
                                        setError(
                                            e instanceof Error
                                                ? e.message
                                                : "Could not open expense entry.",
                                        );
                                    }
                                }}
                            >
                                New expense
                            </button>
                            <button
                                className="button export"
                                disabled={disabled || serverView?.pending}
                                onClick={exportCsv}
                            >
                                <Download size={15} />
                                Export expenses
                            </button>{" "}
                        </>
                    }
                >
                    <div className="expense-list-filters">
                        <label className="search">
                            <Search size={16} />
                            <input
                                aria-label="Search expenses"
                                maxLength={200}
                                placeholder="Search expenses…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </label>
                        <select
                            aria-label="Filter expense category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            <option>All categories</option>
                            {expenseCategories.map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date / expense</th>
                                    <th>Category</th>
                                    <th>Applies to</th>
                                    <th>Amount</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((expense) => (
                                    <tr key={expense.id}>
                                        <td>
                                            <strong>{expense.title}</strong>
                                            <small>{expense.date}</small>
                                            {expense.notes && (
                                                <small className="expense-note-text">
                                                    {expense.notes}
                                                </small>
                                            )}
                                        </td>
                                        <td>{expense.category}</td>
                                        <td>
                                            {expense.channel === "Business"
                                                ? "Whole business"
                                                : expense.channel}
                                        </td>
                                        <td className="amount">{money(expense.amount)}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="text-button"
                                                    disabled={disabled}
                                                    aria-label={`Edit ${expense.title}`}
                                                    onClick={async () => {
                                                        setError("");
                                                        try {
                                                            const current = prepareEntry
                                                                ? await prepareEntry(expense)
                                                                : expense;
                                                            if (!current)
                                                                throw Error(
                                                                    "This expense was removed. Refresh the list.",
                                                                );
                                                            setEditing(current);
                                                            setEntryOpen(true);
                                                        } catch (e) {
                                                            setError(
                                                                e instanceof Error
                                                                    ? e.message
                                                                    : "Could not open this expense.",
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <Pencil size={13} />
                                                    Edit
                                                </button>
                                                <button
                                                    className="text-button cancel"
                                                    disabled={disabled}
                                                    aria-label={`Delete ${expense.title}`}
                                                    onClick={async () => {
                                                        if (
                                                            await confirmAction(
                                                                `Delete “${expense.title}” (${money(expense.amount)})? This removes it from your expense totals.`,
                                                            )
                                                        ) {
                                                            try {
                                                                setError("");
                                                                await prepareDelete?.(expense);
                                                                await onDelete(expense.id, expense);
                                                                if (editing?.id === expense.id)
                                                                    setEditing(null);
                                                            } catch (e) {
                                                                setError(
                                                                    e instanceof Error
                                                                        ? e.message
                                                                        : "Could not remove this expense.",
                                                                );
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <Trash2 size={13} />
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
                                {serverView.error || "Opening expenses…"}
                                {serverView.error && (
                                    <button
                                        className="text-button"
                                        onClick={serverView.retry}
                                    >
                                        Retry expenses
                                    </button>
                                )}
                            </div>
                        ) : (
                            !visible.length && (
                                <div className="empty">
                                    No expenses in this view. Record a business cost or adjust your
                                    filters.
                                </div>
                            )
                        )}
                    </div>
                    {!serverView?.pending && (
                        <Pagination
                            label="Expenses"
                            {...paging}
                        />
                    )}
                </CollapsibleCard>
            )}
        </div>
    );
}
