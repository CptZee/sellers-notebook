import {
    ArrowDownRight,
    ArrowUpRight,
    Package,
    ShoppingBag,
    Truck,
    CalendarClock,
    ClipboardList,
    TriangleAlert,
} from "lucide-react";
export function Stat({
    label,
    value,
    detail,
    icon,
}: {
    label: string;
    value: string;
    detail: string;
    icon: string;
}) {
    const Icon =
        (
            {
                orders: ShoppingBag,
                stock: Package,
                profit: ArrowUpRight,
                suppliers: Truck,
                deliveries: CalendarClock,
                purchases: ClipboardList,
                low: TriangleAlert,
            } as Record<string, typeof Package>
        )[icon] || ArrowDownRight;
    return (
        <section className={`card stat ${icon}`}>
            <div className="stat-label">
                {label}
                <Icon
                    size={17}
                    aria-hidden="true"
                />
            </div>
            <strong className="stat-value">{value}</strong>
            <span className="stat-detail">
                <span className={icon === "profit" ? "positive" : ""}>
                    {icon === "profit" && (
                        <ArrowUpRight
                            size={13}
                            aria-hidden="true"
                        />
                    )}
                </span>
                {detail}
            </span>
        </section>
    );
}
