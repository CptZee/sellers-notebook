"use client";
import { downloadRecordCopy, printRecordCopy } from "../lib/record-copy";
import { useEffect, useState } from "react";
import type { CloudNotebook } from "../lib/use-notebook-view";
import { OrderRefunds } from "./order-refunds";
import { X, Printer, Download } from "lucide-react";
import { orderGroup, customerOrderSummary, customerOrderHtml } from "../lib/order-copy.mjs";
import { orderTotals } from "../lib/finance.mjs";
import type { Order, Branding, RefundRecord } from "../lib/notebook-types";
const money = (value: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
export function OrderDetails({
    orders,
    id,
    branding,
    refunds,
    onRecordRefund,
    onRemoveRefund,
    disabled,
    onClose,
    cloud,
    notice,
}: {
    notice?: React.ReactNode;
    cloud?: CloudNotebook;
    orders: Order[];
    id: string;
    branding: Branding | null;
    refunds: RefundRecord[];
    onRecordRefund: (input: {
        id?: string;
        orderId: string;
        amount: number;
        date: string;
        reason: string;
    }) => void | Promise<void>;
    onRemoveRefund: (id: string, record?: RefundRecord) => void | Promise<void>;
    disabled: boolean;
    onClose: () => void;
}) {
    const [error, setError] = useState("");
    const lines = orderGroup(orders, id);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        return () => {
            if (previous?.isConnected) previous.focus();
        };
    }, []);
    if (!lines.length) return null;
    const copy = customerOrderSummary(lines, branding, refunds),
        active = lines.filter((line) => line.status !== "Cancelled");
    const costs =
            active.reduce((cents, line) => cents + Math.round(orderTotals(line).expense * 100), 0) /
            100,
        profit =
            (Math.round(copy.total * 100) -
                Math.round(costs * 100) -
                Math.round(copy.refunded * 100)) /
            100;
    async function download() {
        if (cloud) {
            setError("");
            try {
                await downloadRecordCopy(cloud, "customer", id);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not download copy.");
            }
            return;
        }
        const url = URL.createObjectURL(
            new Blob([customerOrderHtml(lines, branding, refunds)], {
                type: "text/html;charset=utf-8",
            }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download =
            "customer-order-" + copy.orderId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) + ".html";
        link.click();
        URL.revokeObjectURL(url);
    }
    async function print() {
        setError("");
        if (cloud) {
            try {
                await printRecordCopy(cloud, "customer", id);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Could not print copy.");
            }
            return;
        }
        const popup = window.open("", "_blank", "width=850,height=700");
        if (!popup) {
            setError(
                "Allow the order-summary window to open, or download the customer copy instead.",
            );
            return;
        }
        popup.opener = null;
        popup.document.write(customerOrderHtml(lines, branding, refunds));
        popup.document.close();
        popup.focus();
        popup.print();
    }
    return (
        <div
            className="modal-backdrop"
            onClick={onClose}
        >
            <section
                className="modal order-details-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="order-details-title"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    if (e.key === "Escape") onClose();
                    if (e.key === "Tab") {
                        const controls = e.currentTarget.querySelectorAll<HTMLElement>(
                            "button:not(:disabled),a[href],summary,input:not(:disabled),select:not(:disabled)",
                        );
                        const first = controls[0],
                            last = controls[controls.length - 1];
                        if (e.shiftKey && document.activeElement === first) {
                            e.preventDefault();
                            last.focus();
                        } else if (!e.shiftKey && document.activeElement === last) {
                            e.preventDefault();
                            first.focus();
                        }
                    }
                }}
            >
                <div className="card-header">
                    <div>
                        <h2 id="order-details-title">Order details</h2>
                        <p>
                            {copy.channel} · {copy.orderId}
                        </p>
                    </div>
                    <button
                        className="icon-button"
                        autoFocus
                        aria-label="Close order details"
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="order-details-body">
                    {notice}
                    <h3>{copy.businessName}</h3>
                    {copy.tagline && <p>{copy.tagline}</p>}
                    <dl className="order-detail-meta">
                        <div>
                            <dt>Customer</dt>
                            <dd>{copy.customer}</dd>
                        </div>
                        <div>
                            <dt>Order date</dt>
                            <dd>{copy.date}</dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd>{copy.status}</dd>
                        </div>
                        <div>
                            <dt>Recorded lines</dt>
                            <dd>{lines.length}</dd>
                        </div>
                    </dl>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Unit price</th>
                                    <th>Status</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {copy.items.map((item, index) => (
                                    <tr key={lines[index].id}>
                                        <td>{item.productName}</td>
                                        <td>{item.quantity}</td>
                                        <td>{money(item.price)}</td>
                                        <td>{item.status}</td>
                                        <td>{money(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="order-detail-total">
                        Recorded item total <strong>{money(copy.total)}</strong>
                    </p>
                    {copy.refunded > 0 && (
                        <p className="order-detail-total">
                            Recorded refunds <strong>{money(copy.refunded)}</strong>
                        </p>
                    )}
                    <OrderRefunds
                        cloud={cloud}
                        lines={lines}
                        records={refunds}
                        onRecord={onRecordRefund}
                        onRemove={onRemoveRefund}
                        disabled={disabled}
                    />
                    <details className="order-private-details">
                        <summary>Internal estimates · private</summary>
                        <p>
                            Uses the costs captured on these order lines. Cancelled lines are
                            excluded; processing orders count in reports only after completion.
                        </p>
                        <dl>
                            <div>
                                <dt>Product costs</dt>
                                <dd>
                                    {money(
                                        active.reduce(
                                            (sum, line) => sum + line.cost * line.quantity,
                                            0,
                                        ),
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Platform fees</dt>
                                <dd>
                                    {money(
                                        active.reduce(
                                            (cents, line) =>
                                                cents +
                                                Math.round(line.price * line.quantity * line.fee),
                                            0,
                                        ) / 100,
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Packaging &amp; seller-paid shipping</dt>
                                <dd>
                                    {money(
                                        active.reduce(
                                            (sum, line) => sum + line.packaging + line.shipping,
                                            0,
                                        ),
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Estimated order profit after refunds</dt>
                                <dd>{money(profit)}</dd>
                            </div>
                        </dl>
                    </details>
                    <p className="import-note">
                        Customer copies include recorded item prices and statuses. Internal costs,
                        fees, and profit are excluded. Marketplace lines with the same order ID are
                        grouped within their channel.
                    </p>
                    {error && (
                        <p
                            className="auth-error"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                </div>
                <div className="modal-actions">
                    <button
                        className="button secondary"
                        disabled={disabled}
                        onClick={download}
                    >
                        <Download size={15} />
                        Download customer copy
                    </button>
                    <button
                        className="button primary"
                        disabled={disabled}
                        onClick={print}
                    >
                        <Printer size={15} />
                        Print customer copy
                    </button>
                </div>
            </section>
        </div>
    );
}
