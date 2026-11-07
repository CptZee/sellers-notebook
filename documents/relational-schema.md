# Relational storage migration — 2026-11-06

The current Neon `production` database was migrated after testing a copy on `codex-relational-notebooks-20261106` (`br-round-sun-azr3wsd2`). The test branch expires on 2026-11-08. Real connection strings remain in ignored environment files.

## Storage

| Records                               | Tables                                                |
| ------------------------------------- | ----------------------------------------------------- |
| Notebook metadata                     | `seller_notebooks`                                    |
| Inventory                             | `seller_products`                                     |
| Supplier contacts and inventory links | `seller_suppliers`, `seller_supplier_products`        |
| Sales and customer refunds            | `seller_orders`, `seller_customer_refunds`            |
| Overhead                              | `seller_expenses`                                     |
| Purchases and lines                   | `seller_purchase_orders`, `seller_purchase_items`     |
| Supplier payments and refunds         | `seller_purchase_payments`, `seller_supplier_refunds` |
| Stock history                         | `seller_stock_adjustments`                            |

Business fields have typed columns. Collection order is stored separately from record identity. Money uses PostgreSQL numeric without silently rounding existing sale/product amounts. Purchase child rows and supplier product links have their own identities and positions. Owned relationships use composite owner/record keys; deleting a notebook cascades through its business rows. Historical supplier IDs/names remain on purchases when the current supplier contact is deleted. Attachment links are owner-scoped foreign keys; removing a product clears its attachment link without clearing the file owner.

The migration contains deferred foreign keys and SKU uniqueness to allow atomic multi-record changes and SKU swaps. Scoped `ON DELETE SET NULL` behavior, SQL projection views, and transactional writer functions are deliberately defined in SQL where Drizzle cannot represent all details. Views construct API objects from typed rows; they do not store JSON documents. Normal list readers query owner-scoped views directly and apply pagination in SQL. Full snapshots are assembled only for domain validation and explicit backup/export operations.

`seller_commit_changes` locks the notebook metadata row, checks its revision, writes changed rows and nested differences, and advances the revision within the same transaction. Unchanged records are not rewritten. The header-only Realtime subscription remains valid. Full PUT is a replacement/restore operation; the old omitted-field merge behavior was removed.

## Applied migration evidence

Command: `npm run db:migrate`

```text
Applied migration 1793959294283
Reconciled every field, collection order, revision and timestamp for 1 notebook(s).
Current database: {
  notebooks: 1,
  products: 1,
  orders: 3,
  expenses: 0,
  purchases: 0,
  document_column: false
}
```

The migration runner uses a single transaction and advisory lock. Before conversion it locks and retains source rows in memory. After conversion, before commit, it compares every field and collection order against the relational snapshot and checks revisions/timestamps. Constraints are forced before commit. Any mismatch rolls back the entire migration, including column removal. No private notebook backup was written into the repository.

## Verification

- `npm run build`, `npm run typecheck`, `npm run db:check`, and all 168 unit tests pass.
- `npm run verify:relational`: sample round trip for 120 products, 180 orders, 120 expenses, suppliers, purchases and histories; stale revisions rejected; a temporary update trigger proves only the changed product is written; owner-scoped foreign keys reject invalid links; SKU swaps commit atomically; supplier deletion retains purchase history. All fixture changes roll back.
- `verify:server`: 30 report filter combinations match domain calculations; record batches, conflicts, retry UI, ownership and origin guards pass on the migrated branch.
- `verify:views`: 168 query combinations, global counts, complete exports, bounded purchase/history pages, mobile panels and account isolation pass on the migrated branch.
- `verify:records` and `verify:purchase-tools`: targeted edits, live conflict protection, financial records, receipts, cancellation, concurrency, mobile entry and isolation pass against the migrated current database.
- `verify:neon`: full real-service browser regression passes against the migrated current database, including Auth, private Object Storage, Realtime, all bookkeeping flows, backup/restore and test-account cleanup. Evidence is in `verification/neon-e2e.json`.
- `verify:pagination`: all seven collections reassemble exactly, with at most 100 records per page; metadata refresh, selective live updates, targeted editing, exports, bounds and account isolation pass. The fixture contains 120 products and 360 orders. Its obsolete editor-hydration assertion was updated to require a single-record read.
- Running `npm run db:migrate` again applies nothing and confirms only the original notebook, product and three sales remain, with `document_column: false`.

The branch-only browser run initially failed cross-device checks because its environment used the original branch's Realtime endpoint. Those checks pass against the current database with matching service configuration. Testing also found and fixed a financial-history SQL branch and normalized purchase timestamp/empty-array serialization. Legacy merge test cases were replaced with complete notebook restores, in accordance with the requested removal of backward compatibility.

Full server-side domain validation and the existing notebook limits remain. Targeted forms and server-generated exports have their own acceptance checks in [the release checklist](review-checklist.md); they are independent of storage normalization.
