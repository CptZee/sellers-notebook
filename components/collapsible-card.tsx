"use client";
import { useState, useEffect } from "react";
import { SectionSummary } from "./section-summary";
export function CollapsibleCard({
    title,
    description,
    actions,
    className = "",
    id,
    children,
    defaultOpen = true,
    onOpenChange,
    openRequest = 0,
    collapsible = true,
}: {
    onOpenChange?: (open: boolean) => void;
    openRequest?: number;
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
    id?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    collapsible?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    useEffect(() => {
        if (openRequest) setOpen(true);
    }, [openRequest]);
    if (!collapsible)
        return (
            <section
                id={id}
                className={`card static-card ${className}`}
            >
                <SectionSummary
                    title={title}
                    description={description}
                    collapsible={false}
                />
                {actions && <div className="section-actions">{actions}</div>}
                {children}
            </section>
        );
    return (
        <details
            id={id}
            className={`card collapsible-card ${className}`}
            open={open}
            onToggle={(e) => {
                setOpen(e.currentTarget.open);
                onOpenChange?.(e.currentTarget.open);
            }}
        >
            <SectionSummary
                title={title}
                description={description}
            />
            {actions && <div className="section-actions">{actions}</div>}
            {children}
        </details>
    );
}
