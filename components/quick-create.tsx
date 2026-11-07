"use client";
import { useEffect, useRef, useState } from "react";
import {
    Plus,
    X,
    Package,
    ShoppingBag,
    ReceiptText,
    Truck,
    ClipboardList,
    Wallet,
    RotateCcw,
} from "lucide-react";
export type QuickCreateKind =
    "product" | "order" | "expense" | "supplier" | "purchase" | "payment" | "supplier-refund";
export type QuickCreateRequest = {
    kind: QuickCreateKind;
    sequence: number;
    purchaseDraft?: import("../lib/restock-purchase.mjs").RestockPurchaseDraft;
};
export function QuickCreate({
    onCreate,
    disabled,
    reasons = {},
}: {
    onCreate: (kind: QuickCreateKind) => void;
    disabled: boolean;
    reasons?: Partial<Record<QuickCreateKind, string>>;
}) {
    const [open, setOpen] = useState(false),
        root = useRef<HTMLDivElement>(null),
        trigger = useRef<HTMLButtonElement>(null);
    const actions = [
        { kind: "product" as const, label: "New product", icon: Package },
        { kind: "order" as const, label: "Record a sale", icon: ShoppingBag },
        { kind: "expense" as const, label: "New expense", icon: ReceiptText },
        { kind: "supplier" as const, label: "New supplier", icon: Truck },
        { kind: "purchase" as const, label: "New purchase order", icon: ClipboardList },
        { kind: "payment" as const, label: "Purchase payment", icon: Wallet },
        { kind: "supplier-refund" as const, label: "Supplier refund", icon: RotateCcw },
    ];
    useEffect(() => {
        if (!open) return;
        root.current
            ?.querySelector<HTMLButtonElement>(".quick-create-menu button:not(:disabled)")
            ?.focus();
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, [open]);
    useEffect(() => {
        if (disabled) setOpen(false);
    }, [disabled]);
    return (
        <div
            className="quick-create"
            ref={root}
            onBlur={(e) => {
                if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node))
                    setOpen(false);
            }}
            onKeyDown={(e) => {
                if (e.key === "Escape" && open) {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen(false);
                    trigger.current?.focus();
                }
            }}
        >
            {open && (
                <div
                    id="quick-create-menu"
                    className="quick-create-menu"
                    role="group"
                    aria-label="Create a new entry"
                >
                    {actions.map(({ kind, label, icon: Icon }) => (
                        <button
                            type="button"
                            key={kind}
                            disabled={disabled || !!reasons[kind]}
                            onClick={() => {
                                setOpen(false);
                                onCreate(kind);
                            }}
                        >
                            <Icon size={19} />
                            <span>
                                {label}
                                {reasons[kind] && <small>{reasons[kind]}</small>}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            <button
                type="button"
                className="quick-create-trigger"
                ref={trigger}
                disabled={disabled}
                aria-label={open ? "Close quick create" : "Quick create"}
                aria-expanded={open}
                aria-controls="quick-create-menu"
                onClick={() => setOpen((value) => !value)}
            >
                {open ? <X size={23} /> : <Plus size={23} />}
            </button>
        </div>
    );
}
