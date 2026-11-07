# Scheduled marketplace fetch preparation

Implemented locally on 2026-11-06. No marketplace credentials, cron caller, webhook receiver or hosted worker was activated.

## Behavior

Each connected Lazada/TikTok account can opt into hourly, six-hourly or daily fetches with a 1–7 day lookback. A multi-shop TikTok account uses the shop selected through the authorized Fetch orders flow. Preference changes are saved explicitly; reconnecting a different connection requires a new opt-in.

Scheduled work only prepares batches. A ready batch opens the existing platform-specific importer, where the owner checks mappings, prices and cost defaults before saving. Existing order IDs are skipped; fetched status changes do not overwrite existing sales. Current stock is never changed by fetching or staging. This is scheduled history collection, not payout, inventory or fulfillment synchronization.

The schedule and history controls are collapsed inside a connected platform's row. Without credentials there are no active fetch/schedule controls. When worker setup is missing, enabling is rejected with a coming-soon notice. Turning an existing schedule off remains possible even after configuration is removed.

## Typed database storage

- `seller_marketplace_sync_settings`: explicit opt-in, connection snapshot, cadence, lookback, chosen shop and next due time.
- `seller_marketplace_sync_runs`: immutable date range/shop snapshot, current status, bounded attempt count, lease, safe failure text and row count.
- `seller_marketplace_sync_rows`: external order ID, SKU, quantity, unit price, date, status, generic buyer label and currency, ordered by position.

There is no JSON document/payload column. Transient JSON SQL parameters become typed rows atomically. Runs reference their owner's settings; row foreign keys include owner/run identity. External SKUs intentionally remain external references until the normal preview matches them to owned inventory.

`0006_marketplace_sync_queue` was tested on the isolated Neon branch, then applied to the current database. The original notebook/product/order counts remain 1 / 1 / 3.

## Queue and retry rules

- Due schedules enqueue at most five jobs per worker call. A partial unique index permits only one queued/retrying/running job per owner/platform.
- A worker claims one job with `FOR UPDATE SKIP LOCKED`, a random lease token and a 120-second lease. Multiple workers cannot claim the same active lease.
- Provider fetching retains the existing timeout/request limits. A batch is staged only if the lease, enabled preference, selected shop and current connection still match.
- Turning off, changing the selected shop or disconnecting cancels obsolete work. A reconnect cannot inherit or publish another connection's run. Ready batch access also requires its original connection to remain current.
- Known transient provider/refresh-contention failures retry after 60 and 120 seconds, up to three attempts. Unsupported payload/configuration failures stop for review. Failure text is fixed/sanitized, never copied from provider responses or token-bearing URLs.
- Expired worker leases can be claimed with a new token. An old worker cannot publish after recovery. An expired third attempt becomes failed.
- Manual Retry requires an enabled, matching shop/connection and no other active run. It restarts that run's attempt window. History shows its current state and most recent safe error, not a separate audit row for every attempt.
- Sync tables are separate from business notebook backups. Ready batches are not saved sales; imported records enter normal backups only after explicit import.

## Controlled activation after real provider verification

First complete [marketplace-setup.md](marketplace-setup.md), including actual API scopes, response semantics and refresh rotation. Keep provider flags off until that proof is complete.

Configure these server-only variables in the chosen hosting environment:

```dotenv
MARKETPLACE_SYNC_ENABLED=false
MARKETPLACE_SYNC_SECRET=
```

The secret must be a separate random value of at least 32 characters. Keep it out of browser code and logs. `.env.example` intentionally leaves it blank and the feature off.

After provider access is proven in staging:

1. Deploy the current migrations and Next.js code to public HTTPS. The worker route exports a 120-second duration hint; choose a host whose actual execution limits support the fetch/refresh work.
2. Configure an app-owned scheduler to POST to `/api/internal/marketplace-sync`, for example once per minute, with `Authorization: Bearer <server-only sync secret>`. No scheduler has been created by this implementation.
3. Set the sync secret and enable the global flag only in that controlled environment. The worker additionally requires complete provider app setup and the relevant order-import activation flag. Requests without exact bearer authorization are rejected before database work.
4. Have the test owner explicitly enable a schedule. Verify a run is queued, fetched and shown as ready; opening it must show the normal importer without saving records.
5. Verify errors, the three-attempt limit, disabling during a fetch, disconnect/reconnect, selected-shop changes and isolated history. Then explicitly review/import a small batch and reconcile duplicates, costs and unchanged stock.
6. Activate for other owners only after those checks. Opt-in remains per connection. Disabling the global flag stops worker processing; turning off an owner schedule also cancels that owner's active work.

Provider webhooks are still pending. No public webhook intake route was added; signature verification and replay/idempotency handling must be based on approved provider contracts before event ingestion is enabled.

## Verification

- Build, typecheck, Drizzle checks and 180 unit tests pass.
- `npm run verify:sync-queue`: isolated-branch database checks cover concurrent enqueue/claim, atomic/idempotent staging, owner foreign keys, retry delays/limits, disabled/disconnected work, mock worker orchestration, app-bound settings, shop changes, manual retries and expired-lease recovery. Temporary settings/runs/rows/connections are deleted; sales counts do not change.
- `npm run verify:sync-history`: real-app checks cover 25-row history pages, typed batch reconstruction, preview handoff without notebook hydration, off-state configuration guards, cancellation, current-connection access, account isolation, 320/390/768px layouts and delayed review responses after disconnect. Late responses cannot reopen the importer after its connection view unmounts. Temporary accounts and integration fixtures are removed. Results are in `verification/sync-history-e2e.json`.

The queue verifier requires a fresh isolated `.env.migration-test` branch distinct from the current database, with no other sync settings. It refuses a database with existing schedules. The existing temporary branch expires on 2026-11-08; create a fresh isolated branch after expiry. Provider calls in this test are mocked; no real app credentials are required.
