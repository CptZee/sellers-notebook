"use client";
import { Link2 } from "lucide-react";
import { CollapsibleCard } from "./collapsible-card";
import { ShopeeConnection, type ShopeeFetched } from "./shopee-connection";
import { UpcomingConnections } from "./upcoming-connections";

export function MarketplaceConnections({
    userId,
    disabled,
    onOrders,
    embedded = false,
}: {
    userId?: string;
    disabled: boolean;
    onOrders: (data: ShopeeFetched) => void;
    embedded?: boolean;
}) {
    const content = (
        <div className="marketplace-connections-body">
            {userId ? (
                <ShopeeConnection
                    userId={userId}
                    disabled={disabled}
                    onOrders={onOrders}
                />
            ) : (
                <section className="marketplace-row">
                    <div>
                        <h3>
                            <Link2 size={16} />
                            Shopee
                        </h3>
                        <p>Open your saved notebook to manage a shop connection.</p>
                    </div>
                    <button
                        className="button secondary"
                        disabled
                    >
                        Connect Shopee shop
                    </button>
                </section>
            )}
            <UpcomingConnections
                userId={userId}
                disabled={disabled}
                onOrders={onOrders}
            />
            <p className="import-note">
                Connections are optional. You can also record sales manually or import order CSVs.
                Disconnecting a shop keeps previously imported orders.
            </p>
        </div>
    );
    return embedded ? (
        <section
            className="settings-marketplaces"
            aria-label="Marketplace connections"
        >
            <h2>Marketplace connections</h2>
            <p className="settings-intro">
                Manage Shopee, Lazada, and TikTok Shop. Available connections require your shop’s
                authorization; fetched orders open in Orders for review.
            </p>
            {content}
        </section>
    ) : (
        <CollapsibleCard
            className="marketplace-connections-card"
            title="Marketplace connections"
            description="Shopee, Lazada & TikTok Shop · Connect and review orders before importing."
            defaultOpen={false}
        >
            {content}
        </CollapsibleCard>
    );
}
