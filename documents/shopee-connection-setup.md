# Connect a Shopee shop

Enter app-wide credentials through the [first-launch wizard](first-launch.md) for a new installation, or through the original private environment/host settings afterward. Provider registration, seller consent and live acceptance remain necessary; see [marketplace activation](marketplace-activation.md) for production callbacks.

## Current state

Seller’s Notebook includes a Shopee connection panel in Orders, an authorization callback, authenticated encrypted token storage in Neon, token refresh, a read-only order-fetch endpoint, and reuse of the existing review-and-import workflow. The app currently shows **Setup required** because no Shopee app credentials or callback address have been configured. No real shop is connected.

The implementation has protocol/security fixture tests. It has not been validated with an approved Shopee sandbox or live app. Shopee’s current developer documentation returned HTTP 403 to the automated documentation reader; verify the app’s current API contracts, allowed callback behavior, and permissions in the authenticated Shopee console before enabling it for sellers.

## 1. Register the app

Open [Shopee Open Platform](https://open.shopee.com/) in your browser. Follow its current developer registration and app-creation process for your shop/market. Request the permissions needed to authorize a shop and read its orders and order-item details. This notebook integration does not push products, prices, inventory, shipping, or order changes into Shopee.

Start with the sandbox credentials provided for your app. Use live credentials only after Shopee approves the app and the intended shop permissions. Approval and availability are controlled by Shopee; this code does not bypass them.

Do not share the Partner Key, seller password, access tokens, refresh tokens, or authorization codes in chat, screenshots, or source control.

## 2. Choose a callback address

The live callback must be a public HTTPS address for the same deployment of Seller’s Notebook, ending in:

```text
/api/shopee/callback
```

For example, if your deployed app is `https://notebook.example`, register:

```text
https://notebook.example/api/shopee/callback
```

`notebook.example` is an example, not an existing deployment. The current app runs locally; the previous private ChatGPT-hosted preview is not this Neon-backed server deployment. A live connection needs a suitable HTTPS deployment or development tunnel that Shopee allows. The code permits loopback HTTP for sandbox configuration only; this does not guarantee Shopee will accept that callback.

The flow appends a random `state` query parameter to the redirect URL. Confirm the registered app accepts and preserves this callback query parameter. The callback requires the same signed-in Neon account and an HttpOnly state cookie; allow the browser’s top-level redirect to complete.

## 3. Configure server-only values

Set these in ignored `.env` for local development, or in the deployment’s secret/environment settings:

```dotenv
SHOPEE_ENVIRONMENT=sandbox
SHOPEE_PARTNER_ID=your_numeric_partner_id
SHOPEE_PARTNER_KEY=your_partner_key
SHOPEE_REDIRECT_URI=https://your-actual-host/api/shopee/callback
SHOPEE_TOKEN_ENCRYPTION_KEY=your_existing_random_32_byte_base64_key
```

A local token-encryption key was generated without printing it. Preserve that key; replacing it makes previously stored tokens unreadable and requires reconnecting shops. The actual Partner ID and Partner Key must come from Shopee. The application only permits the fixed Shopee sandbox/production API origins; it does not accept an arbitrary API host from the browser.

Add the actual app origin to Neon Auth’s trusted domains and Realtime’s allowed origins before using a new deployment. Keep all partner keys and token encryption keys server-only, with no `NEXT_PUBLIC_` prefix.

After configuring the values:

```sh
npm run db:migrate
npm run build
npm run start
```

The Shopee tables were tested on an isolated Neon branch before applying the migration to production. Normal app queries continue using the existing pooled Neon HTTP connection.

## 4. Authorize and import

1. Sign into Seller’s Notebook and open Orders.
2. Choose **Connect Shopee shop**. Sign in on Shopee and authorize the intended shop.
3. Return to the same notebook account through the callback.
4. Pick a date range and choose **Fetch orders for review**.
5. Review SKU matches, prices, statuses, fees, and fulfillment-cost defaults in the importer. Nothing is added merely by fetching.
6. Confirm the review and add the new order lines. The existing account autosave persists them and Realtime updates other signed-in devices.

## Behavior and limits

- One connected shop per notebook account.
- Credentials are AES-256-GCM encrypted and bound to the account and shop. The browser receives connection metadata, not shop tokens.
- Authorization state is short-lived, one-use, cookie-bound, and account-bound.
- Expiring access tokens are refreshed under a database lease to avoid concurrent refresh-token rotation. A disconnected connection cannot persist refreshed tokens or return fetched results.
- Fetching reads orders updated within an inclusive date window of at most 14 days, capped at 200 orders / 1,000 item lines. Narrow the range if the result exceeds those limits. Pagination or missing detail failures stop the fetch rather than silently importing a partial result.
- Only PHP orders are supported. SKU-less and unmatched products must be resolved in the preview; no costs or inventory products are invented.
- Imported history preserves current stock. Financial estimates use your reviewed defaults and current product costs, not a fetched Shopee escrow settlement.
- Existing imported order lines are skipped, not overwritten. This version does not automatically update old order statuses or implement returns/refunds.
- Fetch/import is manual. Scheduled background sync and webhooks are not implemented.
- Disconnect deletes this app’s stored shop credentials and keeps imported orders. To revoke the app’s remote authorization, use Shopee’s own authorization settings as well.

## Checks before claiming live readiness

- [ ] App credentials are valid for the selected sandbox/live environment.
- [ ] Registered redirect URL accepts the appended state parameter.
- [ ] Real shop authorization and code exchange succeed in the same Neon browser session.
- [ ] Returned token expiry and refresh rotation match the approved app’s actual response contract.
- [ ] Read-order permissions return complete list/detail fields and pagination for the intended market.
- [ ] An actual order matches the CSV/API preview’s SKU, date, currency, price, and quantity.
- [ ] Duplicate fetch/import does not create extra sales, and historical cancellation does not inflate stock.
- [ ] Another notebook account cannot view or disconnect the shop.

Run `npm test` for fixture tests and `npm run verify:neon` for the local app/Neon checks. These checks are not a substitute for authorization against your approved Shopee app.

## Importing historical Shopee CSVs

CSV import works independently of a live connection. In Orders, choose the Shopee CSV import, match products by Seller SKU, select the date format and map the order ID, SKU, quantity, unit price, date and status. Buyer name and currency are optional; any supplied currency must be PHP. Use a CSV under 2 MB with 1–1,000 order lines, and enter actual fee and fulfillment-cost defaults before reviewing the preview.

- Unknown SKUs and duplicate order/SKU lines are rejected. Imports do not invent inventory products or silently combine ambiguous records.
- Source identities include the marketplace, order ID and SKU; repeated imports skip existing source lines. Existing manually entered orders cannot always be identified as duplicates.
- Packaging and seller-paid shipping apply once per source order, including across separate imports of its lines.
- Historical imports preserve current stock; cancelling imported history does not add stock back. Only Completed orders contribute to revenue.
- Imports do not overwrite existing order statuses or financial snapshots. Record customer refunds through the notebook’s separate refund workflow; unsupported marketplace return/refund statuses require explicit review.

Confirm the reviewed figures and unchanged-stock behavior before committing. Real seller CSV layouts still require acceptance with that seller’s export.
