/* Read-only setup check. Never print credential values, tokens or authorization URLs. */
require("@next/env").loadEnvConfig(process.cwd());
(async () => {
    const { shopeeConfig } = await import("../lib/shopee-api.mjs");
    const { marketplaceConfig } = await import("../lib/marketplace-api.mjs");
    const origin = "https://ntbk.ajmission.dev";
    const definitions = [
        {
            id: "shopee",
            name: "Shopee",
            config: shopeeConfig(),
            keys: [
                "SHOPEE_PARTNER_ID",
                "SHOPEE_PARTNER_KEY",
                "SHOPEE_REDIRECT_URI",
                "SHOPEE_TOKEN_ENCRYPTION_KEY",
            ],
            callback: "SHOPEE_REDIRECT_URI",
            path: "/api/shopee/callback",
        },
        {
            id: "lazada",
            name: "Lazada",
            config: marketplaceConfig("lazada"),
            keys: [
                "LAZADA_APP_KEY",
                "LAZADA_APP_SECRET",
                "LAZADA_REDIRECT_URI",
                "MARKETPLACE_TOKEN_ENCRYPTION_KEY",
            ],
            callback: "LAZADA_REDIRECT_URI",
            path: "/api/marketplaces/lazada/callback",
            flag: "LAZADA_ORDER_IMPORT_ENABLED",
        },
        {
            id: "tiktok",
            name: "TikTok Shop",
            config: marketplaceConfig("tiktok"),
            keys: [
                "TIKTOK_SHOP_APP_KEY",
                "TIKTOK_SHOP_APP_SECRET",
                "TIKTOK_SHOP_SERVICE_ID",
                "TIKTOK_SHOP_REDIRECT_URI",
                "MARKETPLACE_TOKEN_ENCRYPTION_KEY",
            ],
            callback: "TIKTOK_SHOP_REDIRECT_URI",
            path: "/api/marketplaces/tiktok/callback",
            flag: "TIKTOK_SHOP_ORDER_IMPORT_ENABLED",
        },
    ];
    const selected = process.argv[2];
    if (selected && !definitions.some((item) => item.id === selected)) {
        console.error("Usage: npm run marketplaces:check -- [shopee|lazada|tiktok]");
        process.exitCode = 2;
        return;
    }
    let ready = true;
    for (const item of definitions.filter((item) => !selected || item.id === selected)) {
        const missing = item.keys.filter((key) => !process.env[key]?.trim());
        const matches = process.env[item.callback] === origin + item.path;
        const production =
            item.name !== "Shopee" || process.env.SHOPEE_ENVIRONMENT === "production";
        console.log(
            item.name +
                ": " +
                (item.config.ready
                    ? "app configuration valid"
                    : "app configuration incomplete or invalid"),
        );
        if (missing.length) console.log("  Missing: " + missing.join(", "));
        console.log("  Expected production callback: " + origin + item.path);
        console.log("  Production callback matches: " + matches);
        if (item.name === "Shopee") console.log("  Shopee production environment: " + production);
        if (item.flag)
            console.log("  Order fetching enabled: " + (process.env[item.flag] === "true"));
        ready &&= item.config.ready && matches && production;
    }
    console.log(
        "This checks local configuration only; app approval, callback reachability, seller consent and real-shop validation are still required.",
    );
    process.exitCode = ready ? 0 : 1;
})().catch(() => {
    console.error("Could not check marketplace configuration.");
    process.exitCode = 1;
});
