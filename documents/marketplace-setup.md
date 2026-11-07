# Lazada / TikTok Shop preparation

Production URL and activation handoff for all three platforms: [marketplace-activation.md](marketplace-activation.md). Deployment is owner-managed; approved app credentials are still pending.

Prepared locally on 2026-11-06. Neither platform has real app credentials configured. No live authorization, provider refresh or real-shop order fetch was performed.

## Implemented

- Existing owner-bound OAuth connections and encrypted token storage are reused.
- `POST /api/marketplaces/{lazada|tiktok}/orders` requires a session, matching expected user, same origin, complete app setup and an explicit activation flag.
- Signed provider adapters have fixed origins, no redirects, timeouts, a 45-second overall fetch budget, a 60-request budget and a 1,000-line cap. A too-large or inconsistent fetch fails rather than returning partial history.
- Lazada uses the Philippines order list and item-detail paths; TikTok discovers authorized PH shops and pages its order search. Multiple PH shops require an explicit verified shop choice.
- Only explicit PHP amounts are accepted. Repeated physical units may consolidate only when order/SKU, unit price, status and date agree. Ambiguous pricing/status, missing SKUs/currency and unsafe numeric IDs fail rather than guess. Buyer details are not requested for the notebook; preview rows use a generic buyer label.
- The fetch result opens the existing platform-specific preview. Fetching does not save orders, alter stock or schedule further requests. Explicit review and import are still required.
- Expiring access tokens refresh under a database lease. Ciphertext, connection identity and lease checks prevent competing refresh writes or resurrecting a disconnected connection. A failed or interrupted refresh releases the lease or lets it expire; provider errors are sanitized.

## Configuration when approved app access is available

Keep actual values in the server environment, never in chat, browser code or version control. The app credentials belong to this application; every user separately authorizes their own seller account.

The [first-launch wizard](first-launch.md) can collect these settings for a new installation. Register the correct integration app in each provider portal and request only the seller/shop and order-read permissions needed for this notebook. The app does not require listing or order-write access for its current imports.

Authorization states are hashed, expire after ten minutes and are bound to the signed-in owner, provider, app identity and browser cookie. Callbacks consume them once. Tokens are AES-256-GCM encrypted with owner/provider/account binding. Preserve `MARKETPLACE_TOKEN_ENCRYPTION_KEY`; changing it prevents existing connections from being decrypted. A changed app identity requires reauthorization. TikTok seller authorization uses the app's Service ID configured in Partner Center; both callbacks require the same signed-in browser session and returned state.

| Platform                | Server variables                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Lazada                  | `LAZADA_APP_KEY`, `LAZADA_APP_SECRET`, `LAZADA_REDIRECT_URI`                                          |
| TikTok Shop             | `TIKTOK_SHOP_APP_KEY`, `TIKTOK_SHOP_APP_SECRET`, `TIKTOK_SHOP_SERVICE_ID`, `TIKTOK_SHOP_REDIRECT_URI` |
| Shared token encryption | `MARKETPLACE_TOKEN_ENCRYPTION_KEY` — stable 32-byte base64 key                                        |

Callbacks require public HTTPS and the exact paths `/api/marketplaces/lazada/callback` and `/api/marketplaces/tiktok/callback`. Configure provider-approved seller/order-read permissions and the app's hosting/Auth origins.

Both flags default off and are shown as `false` in `.env.example`:

```dotenv
LAZADA_ORDER_IMPORT_ENABLED=false
TIKTOK_SHOP_ORDER_IMPORT_ENABLED=false
```

Missing credentials keep connection buttons disabled with a coming-soon notice. Even with credentials, order fetch controls remain hidden until their flag is `true`. CSV imports remain available.

## Controlled test-shop validation before release

1. Confirm `npm run db:migrate` has applied `0005_marketplace_refresh_lease` (already applied to the current local project's database after branch verification).
2. Configure an approved app and public HTTPS callback in local/staging. Authorize a consenting test seller independently of other users.
3. Enable only the relevant flag in that controlled environment and restart. Validate permissions, signatures, region and shop selection with the authorized shop.
4. Inspect actual response contracts against `lib/marketplace-orders.mjs`. In particular, verify Lazada's item/quantity and paid-price semantics, currency fields, timestamp offsets, and TikTok's line-item unit-price/quantity semantics. These mappings are fixture-tested preparation, not live-verified contracts. Unsupported responses intentionally stop the fetch.
5. Verify date boundaries, pagination, order IDs larger than JavaScript's safe integer range, mixed statuses/prices, partial cancellations and repeat imports. Compare unit quantities/prices to the seller's export. Delivered orders keep the current preview policy; refunds/returns require separate handling.
6. Verify real access-token expiry, rotating refresh tokens, revoked permissions, app changes, retry behavior and disconnect during a fetch. Preserve the encryption key and never log token-bearing provider URLs or payloads.
7. Review the resulting preview, then save a small batch. Confirm platform-specific duplicate detection, once-per-order defaults, account isolation and unchanged current stock. Disable the flag if any contract or reconciliation check fails.
8. Enable production fetching only after the controlled shop checks pass. Scheduled sync/webhooks are separate unfinished work.

## Evidence

- Build, typecheck, Drizzle migration check and 177 unit tests pass. Provider unit tests use synthetic credentials and mocked responses only.
- `node scripts/verify-marketplace-refresh.cjs` passes on the isolated Neon migration branch: one refresh wins, rotated tokens remain encrypted, fresh tokens are reused, and disconnect during refresh cannot recreate tokens for either provider. Temporary connection rows are deleted.
- `node scripts/verify-marketplace-preparation.cjs` verifies actual no-key guards/UI and CSV availability. Mocked configured fetches open real platform-correct previews, including TikTok multi-shop selection, without collection hydration or automatic writes. Results are in `verification/marketplace-preparation-e2e.json`; temporary accounts are cleaned up.
- The nullable refresh lease migration was tested on `codex-relational-notebooks-20261106`, then applied to the current database. Existing notebook/product/order counts remain 1 / 1 / 3.

The refresh verifier needs the ignored `.env.migration-test` connection to an isolated branch. Its current branch is temporary and expires on 2026-11-08; create a fresh isolated branch before running it after expiration. It overrides provider calls with mocks, not actual app credentials.

## Provider references

Official pages were consulted; some require JavaScript/login for full schemas. Live payload and scope verification above remains necessary.

- [Lazada order integration guide](https://open.lazada.com/apps/doc/doc?docId=121327&nodeId=29616)
- [Lazada seller authorization and token refresh](https://open.lazada.com/apps/doc/doc?docId=121782&nodeId=45695)
- [TikTok Shop common API parameters](https://partner.tiktokshop.com/docv2/page/common-parameters)
- [TikTok Shop order list](https://partner.tiktokshop.com/docv2/page/get-order-list-202309)
- [TikTok Shop authorized shops](https://partner.tiktokshop.com/docv2/page/get-authorized-shops-202309)
