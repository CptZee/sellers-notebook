"use client";
import { SectionSummary } from "./section-summary";
import { useState } from "react";
import { Pagination } from "./pagination";
import { usePagination } from "../lib/use-pagination";
import type { Product, Supplier, PurchaseOrder } from "../lib/notebook-types";
import {
    restockIncomingPlan,
    restockIncomingCsv,
    filterRestockPlan,
} from "../lib/restock-purchase.mjs";
const money = (amount: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
export function RestockPlan({
    products,
    suppliers = [],
    orders = [],
    onPurchase,
    disabled = false,
    onAdjustStock,
}: {
    onAdjustStock?: () => void;
    products: Product[];
    suppliers?: Supplier[];
    orders?: PurchaseOrder[];
    onPurchase?: (supplierId: string, productIds: string[]) => void;
    disabled?: boolean;
}) {
    const [supplier, setSupplier] = useState("all"),
        [view, setView] = useState("All low-stock products"),
        [search, setSearch] = useState("");
    const all = restockIncomingPlan(products, orders),
        plan = filterRestockPlan(all, suppliers, { supplierId: supplier, view, search }),
        quantity = plan.reduce((total, item) => total + item.toBuy, 0),
        incoming = plan.reduce((total, item) => total + item.onOrder, 0),
        estimate =
            plan.reduce((cents, item) => cents + Math.round(item.buyEstimate * 100), 0) / 100;
    function download() {
        const csv = restockIncomingCsv(plan, suppliers);
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "restock-plan.csv";
        link.click();
        URL.revokeObjectURL(url);
    }
    const [expanded, setExpanded] = useState(false);
    const paging = usePagination(plan, JSON.stringify([supplier, view, search]));
    return (
        <details
            className="card restock-plan"
            onToggle={(e) => setExpanded(e.currentTarget.open)}
        >
            <SectionSummary
                title="Restock planner"
                description={<> {all.length} products at their alert level </>}
            />
            {expanded && (
                <div className="restock-plan-body">
                    {onAdjustStock && (
                        <div className="restock-adjust-action">
                            <p>
                                Need to update quantities already on hand? Record a stock
                                adjustment.
                            </p>
                            <button
                                type="button"
                                className="button secondary"
                                disabled={disabled}
                                onClick={onAdjustStock}
                            >
                                New stock adjustment
                            </button>
                        </div>
                    )}
                    <p className="import-note">
                        Based on current stock across all channels, using each product’s alert and
                        target levels. Edit a product to change its levels. Choose a supplier to
                        prepare a purchase, then record arrivals in Purchases & deliveries.
                    </p>
                    <div className="restock-filters">
                        <label className="field">
                            <span>Restock supplier</span>
                            <select
                                aria-label="Restock supplier"
                                value={supplier}
                                onChange={(e) => setSupplier(e.target.value)}
                            >
                                <option value="all">All suppliers</option>
                                <option value="unlinked">No supplier linked</option>
                                {suppliers
                                    .toSorted((a, b) => a.name.localeCompare(b.name))
                                    .map((s) => (
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
                            <span>Restock view</span>
                            <select
                                aria-label="Restock view"
                                value={view}
                                onChange={(event) => setView(event.target.value)}
                            >
                                {[
                                    "All low-stock products",
                                    "Needs buying",
                                    "Covered by incoming stock",
                                ].map((option) => (
                                    <option key={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <label className="field">
                            <span>Search restock products</span>
                            <input
                                aria-label="Search restock products"
                                placeholder="Product name or SKU"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </label>
                    </div>
                    <div className="restock-summary">
                        <span>
                            {incoming} units on order · {quantity} additional units to buy ·
                            estimated item cost {money(estimate)}
                        </span>
                        <button
                            className="button secondary"
                            type="button"
                            disabled={!plan.length}
                            onClick={download}
                        >
                            Export restock plan
                        </button>
                        {onPurchase && (
                            <button
                                className="button primary"
                                type="button"
                                disabled={
                                    disabled ||
                                    !quantity ||
                                    !suppliers.some((item) => item.id === supplier)
                                }
                                onClick={() =>
                                    onPurchase(
                                        supplier,
                                        plan.map((item) => item.id),
                                    )
                                }
                            >
                                Prepare purchase order
                            </button>
                        )}
                    </div>
                    <p className="import-note">
                        Supplier, view, and search filters apply to totals, CSV, and purchase drafts
                        across every page. Choose one supplier to prepare an editable draft. On
                        order counts only outstanding units on open purchases from any supplier.
                        Incoming units are not available stock until received. Additional units to
                        buy subtract those incoming units from the stock shortfall. Costs use
                        current inventory unit costs and exclude delivery, taxes, and supplier price
                        changes.
                    </p>
                    {plan.length ? (
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Product / SKU</th>
                                        <th>Supplier options</th>
                                        <th>Current stock</th>
                                        <th>Alert at</th>
                                        <th>Target</th>
                                        <th>Stock shortfall</th>
                                        <th>On order</th>
                                        <th>Additional units to buy</th>
                                        <th>Additional item estimate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paging.items.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                {item.name}
                                                <small>{item.sku}</small>
                                            </td>
                                            <td>
                                                {suppliers.some((s) =>
                                                    s.productIds.includes(item.id),
                                                )
                                                    ? suppliers
                                                          .filter((s) =>
                                                              s.productIds.includes(item.id),
                                                          )
                                                          .map((s) => (
                                                              <div key={s.id}>
                                                                  {s.name}
                                                                  <small>
                                                                      {s.leadTimeDays
                                                                          ? `${s.leadTimeDays} day lead time`
                                                                          : "Lead time unspecified"}
                                                                  </small>
                                                              </div>
                                                          ))
                                                    : "No supplier linked"}
                                            </td>
                                            <td>{item.stock}</td>
                                            <td>{item.reorderPoint}</td>
                                            <td>{item.targetStock}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.onOrder}</td>
                                            <td>
                                                {item.toBuy}
                                                {!item.toBuy && (
                                                    <small>Covered by incoming stock</small>
                                                )}
                                            </td>
                                            <td>{money(item.buyEstimate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <Pagination
                                label="Restock plan"
                                {...paging}
                            />
                        </div>
                    ) : (
                        <p className="empty">
                            {all.length
                                ? "No low-stock products match these filters."
                                : "All products are above their alert levels."}
                        </p>
                    )}
                </div>
            )}
        </details>
    );
}
