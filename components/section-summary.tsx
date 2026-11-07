import { Children, isValidElement, type ReactNode } from "react";
import {
    BookOpen,
    ChevronRight,
    Package,
    RefreshCw,
    SlidersHorizontal,
    Paperclip,
    Truck,
    ReceiptText,
    ChartNoAxesCombined,
    Store,
    ShoppingBag,
    TriangleAlert,
    Link2,
    RotateCcw,
    ClipboardList,
    CalendarClock,
    Files,
} from "lucide-react";

function labelText(node: ReactNode): string {
    return Children.toArray(node)
        .map((child) =>
            typeof child === "string" || typeof child === "number"
                ? String(child)
                : isValidElement<{ children?: ReactNode }>(child)
                  ? labelText(child.props.children)
                  : "",
        )
        .join(" ");
}
const icons = [
    ["product collection", Package],
    ["restock", RefreshCw],
    ["stock adjustments", SlidersHorizontal],
    ["tucked between", Paperclip],
    ["supplier statements", Files],
    ["delivery reminders", CalendarClock],
    ["supplier", Truck],
    ["purchases", ClipboardList],
    ["expense", ReceiptText],
    ["sales performance", ChartNoAxesCombined],
    ["where you", Store],
    ["orders", ShoppingBag],
    ["running a little low", TriangleAlert],
    ["marketplace connections", Link2],
    ["refund history", RotateCcw],
] as const;
export function SectionSummary({
    title,
    description,
    collapsible = true,
}: {
    title: ReactNode;
    description?: ReactNode;
    collapsible?: boolean;
}) {
    const label = labelText(title).toLowerCase(),
        Icon = icons.find(([text]) => label.includes(text))?.[1] || BookOpen;
    const Heading = collapsible ? "summary" : "header";
    return (
        <Heading
            className={`section-summary notebook-section-summary${collapsible ? "" : " static-section-heading"}`}
        >
            {collapsible && (
                <ChevronRight
                    className="section-chevron"
                    size={16}
                    aria-hidden="true"
                />
            )}
            <Icon
                className="section-heading-icon"
                size={19}
                aria-hidden="true"
            />
            <h2>{title}</h2>
            <span className="section-description">
                {description ?? (collapsible ? "Open to view this section." : "")}
            </span>
        </Heading>
    );
}
