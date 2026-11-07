# Seller’s Notebook review checklist

Use the local app at http://127.0.0.1:3000. The earlier hosted preview is a separate, older deployment.

## Public landing and access

- [ ] Open `/` in a signed-out or private browser: see the notebook introduction, not the dashboard or personal data.
- [ ] Check the sign-in, create-account, “Open it,” and “How it works” links.
- [ ] Visit `/notebook` directly while signed out: redirect to `/auth/sign-in`.
- [ ] After signup/sign-in, arrive at `/notebook`. Sign out and return to the public landing page.
- [ ] After sign-out, browser Back or a direct `/notebook` visit must not restore usable account data.

## Accounts

- [ ] Create a new email/password account; verify a new personal notebook starts empty.
- [ ] Sign out, sign back in, and reload: saved data should remain.
- [ ] Enter a wrong password: see a visible error without opening the notebook.
- [ ] Sign in as another user: products, orders, and files should be separate.
- [ ] Check keyboard navigation, form labels, loading states, and account dialog controls.
- [x] Receive verification and password-reset test emails in a real mailbox (confirmed by the user).
- [ ] Complete verification with the received code and finish resetting the password. Verification remains optional; new signups receive a code automatically.

## Products and stock

- [ ] Add a product with initial stock; edit its name, SKU, category, cost, and selling price. Change existing quantities through Stock adjustments.
- [ ] Reject duplicate SKUs, negative values, and fractional stock.
- [ ] Search by product name and SKU. Test no-result and empty-inventory views.
- [ ] Low-stock warnings use each product’s alert level (default 10); zero-stock products cannot be selected for a new sale.
- [ ] Check that inventory value equals current stock × product cost and does not change with sales date/channel filters.

## Orders and financial totals

- [ ] Recording a sale creates a Processing order and immediately reduces stock.
- [ ] Completing an order adds its revenue and estimated profit to the dashboard exactly once.
- [ ] Cancelling a Processing order restores its stock and excludes it from revenue.
- [ ] Reject quantities above available stock and invalid fees/costs.
- [ ] Editing product prices afterward does not rewrite existing order costs or prices.
- [ ] Example: 2 items at ₱300, unit cost ₱100, 10% fee, ₱15 packaging, ₱0 shipping gives ₱600 revenue and ₱325 estimated profit. Packaging and shipping apply once per order.

## Dashboard, calculator, and export

- [ ] Channel and date filters update sales totals, channel breakdown, and order lists consistently.
- [ ] The sales chart includes sales on the correct local date and handles a new empty notebook.
- [ ] Pricing calculator: cost ₱200 + packaging ₱20 + shipping ₱30, 10% fee, 30% margin recommends ₱417 after rounding up.
- [ ] Fee + margin of 100% or more does not produce an invalid price.
- [ ] Export CSV and compare its rows with the filtered order list.
- [ ] Remember estimates exclude taxes, unrecorded refunds/costs, and settlement timing. Additional overhead is included when recorded. CSV imports support all three marketplaces; direct connections require configured apps.

## Live saving and multiple devices

- [ ] Open the same account in two independent browsers; “Live across your devices” appears.
- [ ] Add/edit a product or complete an order in one browser: the other updates without refreshing.
- [ ] Wait more than a minute and repeat to check subscription renewal.
- [ ] Change data at the same time on both devices: the app should report a conflict instead of silently overwriting newer data.
- [ ] Briefly interrupt the connection: saving failures remain visible and retry works. Unsaved cloud changes are held in memory, not guaranteed offline storage.
- [ ] Sample mode remains separate from account data. Sample edits must not silently import into a real account.

## Private attachments

- [ ] In Inventory, upload a PDF, supported image, CSV, or text file up to 5 MB.
- [ ] Download it and confirm the bytes/file contents match.
- [ ] Delete it and confirm it disappears and can no longer be downloaded.
- [ ] Unsupported, empty, and oversized files show an error.
- [ ] Another account cannot access the file by copying its download URL.

## Layout

- [ ] Review landing, signup/sign-in, dashboard, inventory, orders, expenses, calculator, and attachments at phone and desktop widths.
- [ ] Hide/reopen the sidebar. Desktop preference survives reload; mobile navigation closes on selection, backdrop click, and Escape.
- [ ] Confirm readable numbers and error messages, visible focus states, and no page-wide horizontal scrolling.

## Before a new hosted release

- [ ] Deploy this full Next.js server version; the older hosted preview has not been updated.
- [ ] Set server-only environment values on the selected host and register its HTTPS origin with Neon Auth and Realtime.
- [ ] Configure and test production email delivery.
- [ ] Decide whether existing browser sample data or older D1 records need an explicit account migration.
- [ ] Review backup/recovery, dependency audit findings, privacy policy, account deletion, and rate limits before inviting real sellers.

Automated checks: `npm run build`, `npm test`, `npm run typecheck`, and (with the production app started) `npm run verify:neon`.

## Shopee imports

- [ ] Export Shopee orders to CSV, choose the file in Orders → Import Shopee CSV, and confirm each column mapping.
- [ ] Match Seller SKUs to Inventory; unknown SKUs must block import.
- [ ] Check dates, currency, statuses, unit selling prices, and your actual fee/cost defaults.
- [ ] Confirm fulfillment costs count once per external Shopee order across multiple product lines.
- [ ] Import and reload; rows must persist. Upload the same file again; duplicates must be skipped.
- [ ] Cancel an imported Processing order; current stock must remain unchanged.
- [ ] Review manually entered orders for duplicates; they cannot be automatically matched without source IDs.
- [ ] Test against a real shop export. Direct account sync, Excel workbook upload, automatic refund imports, and automatic status updates are not implemented.

## Expenses and net profit

- [ ] Add an expense with a category, date, channel, and optional notes; reload and confirm it persists.
- [ ] Edit and delete an expense and confirm another browser updates live.
- [ ] With an edit open on one device, change that expense on another; saving the old draft must show a conflict.
- [ ] Check search, category filters, and Export expenses CSV against the displayed entries.
- [ ] An order profit of ₱325 with ₱25 overhead should show ₱300 estimated net profit.
- [ ] Whole-business expenses appear in All channels; only assigned expenses appear in a specific channel.
- [ ] Date filters apply to expense dates. Expenses with no completed sales can produce a negative net profit.
- [ ] A different account must not see these expenses. Avoid duplicating costs already recorded on orders.

## Marketplace availability

- [ ] In Orders, Lazada and TikTok Shop show Coming soon with disabled connection buttons.
- [ ] With Shopee app credentials missing, its connection button is disabled and Coming soon is displayed. Direct connection requests must also be rejected.
- [ ] Sellers see no app-wide credential setup instructions. Manual order entry and Shopee CSV imports remain available.

- [ ] After configuring Lazada or TikTok credentials and HTTPS callbacks, authorize your own account, confirm private metadata, and disconnect without affecting other platforms. Follow [marketplace preparation](marketplace-setup.md) and [production activation](marketplace-activation.md). Authorization alone must not import orders; configured fetching opens a preview for explicit review.

## Sidebar

- [ ] Notebook identity is a plain label without a misleading dropdown arrow.
- [ ] Click the avatar, name, or empty space in the bottom account row; each opens account settings. Keyboard focus and Enter should work too.
- [ ] Type a personal sticky note (up to 200 characters), reload, and check it on another device. Another account should start with its own empty note.
- [ ] Clearing the note restores the encouragement placeholder. Sample notes stay separate from account notes.

## Marketplace CSV imports

- [ ] Open Orders → Import orders CSV and select Shopee, Lazada, or TikTok Shop. Switching platforms clears the previous file and review.
- [ ] Choose a CSV, review column mappings (especially unit selling price and date format), match inventory SKUs, and confirm fee/cost defaults.
- [ ] Import the same external order number for different platforms: records stay separate. Reimport on the same platform: duplicates are skipped.
- [ ] Check packaging/shipping count once per external order within each platform. Cancelling imported history must preserve stock.
- [ ] PHP only; unknown SKU, unsupported returns/refunds, ambiguous dates, and repeated order/SKU lines must be resolved first. Consolidate repeated same-SKU lines before import.
- [ ] Compare against real shop exports. Templates are examples; CSV layouts vary, and Excel workbook upload is not supported.

## Themes

- [ ] Use Dark paper / Light paper in the sidebar; the choice survives reload and navigation in this browser.
- [ ] Review notebook pages, imports, dialogs, landing, and auth forms in both themes.
- [ ] CSV marketplace selector, upload button, and template link align at desktop widths and wrap cleanly on phones.

## Personal branding

- [ ] Open the sidebar account row → Make it your notebook; set business name, notebook title, optional tagline, and Notebook/Shop/Sprout icon. Check the preview and save.
- [ ] Sidebar identity, notebook caption, breadcrumb, and footer reflect the saved values. Reload and check another device.
- [ ] Branding stays private to the account, and sample branding remains separate. Reset branding restores defaults.
- [ ] Test long names and keyboard navigation in light/dark themes and mobile layouts.

- [ ] Sidebar branding remains left-aligned for short names and wraps long names within the sidebar on desktop/mobile. Browser tab title follows saved notebook title and business name, including live updates and reset.

## Account settings

- [ ] Profile, Branding, and Notebook tabs show one section at a time, with keyboard arrow navigation between tabs.
- [ ] Edit Display name and save; sidebar/account identity updates and persists after reload. Account email is read-only.
- [ ] Branding editing and reset work from Branding; sample switching and sign-out work from Notebook.
- [ ] Profile saving waits for unsaved notebook changes, and failed updates show a visible error.

## Profile pictures and signup confirmation

- [ ] Profile → Change picture accepts PNG/JPEG/WebP up to 5 MB, crops/resizes square, and updates the sidebar avatar. Reload and confirm it persists.
- [ ] Remove picture returns to initials and removes the private stored image. Signed-out/other accounts cannot read it.
- [ ] Signup requires Confirm password; mismatched values show a clear error before an account request. Matching values complete normal signup.

## Reporting periods

- [ ] Rolling 7/30/90-day ranges end today in Manila time. Future-dated entries are excluded.
- [ ] This month, All time, and Custom dates apply consistently to sales and expenses; All time includes expense-only history.
- [ ] Invalid or reversed custom ranges show an error and disable summary export.
- [ ] Sales chart covers the entire chosen range and counts only completed sales.
- [ ] Overview → Export summary downloads period/channel metadata, revenue, order costs, order profit, overhead, and net profit. Order/expense CSV exports retain their existing workflows.

## Inventory CSV onboarding

- [ ] Download the inventory template, map columns, review prices and current stock, and add new products.
- [ ] Existing SKUs skip without changing current price or stock; repeating a file adds no duplicates.
- [ ] Negative prices, fractional stock, non-PHP currency, duplicate file SKUs, and missing required mappings block confirmation.
- [ ] Imported products save and appear live on another device. Inventory Export matches the searched product list.

## Manual stock adjustments

- [ ] Restock adds units; Damage subtracts without going negative; Correction sets an absolute count. A reason is required.
- [ ] Affected product stock and before/after history persist and synchronize together. Other products remain unchanged.
- [ ] An open adjustment is blocked if the selected product stock changes remotely; reselect to review the new count.
- [ ] Export stock history includes all entries. Another account has a separate empty history.
- [ ] Sales/cancellations and historical imports retain their current stock behavior and are separate from this manual history.

## Product-linked files

- [ ] Click Files beside an inventory item; the attachment panel selects that product. New uploads link to it.
- [ ] Switch products and confirm only their matching receipts/photos/documents are shown. All files and unlinked views remain available.
- [ ] Use each file’s product selector to reassign or unlink it. This must not change file contents or inventory quantities.
- [ ] Existing files remain available and can be linked. Another account cannot read, reassign, or upload into your product’s files.

## Order list and bulk actions

- [ ] Search by buyer, product, SKU, and external marketplace ID; combine with status, date, and channel filters. Check sorting.
- [ ] Order CSV export matches the visible list. Period summary cards retain date/channel totals.
- [ ] Select visible Processing lines, confirm Complete selected, and check sales totals without another stock deduction.
- [ ] Confirm Cancel selected on manual and historical-import lines: only reserved manual stock returns. Completed/cancelled lines cannot be selected again.
- [ ] Cancel the confirmation dialog or invalidate a selection remotely: no unintended order/stock changes occur.

## Notebook backup and restore

- [ ] Download a backup from Account settings → Notebook. Check products, orders, expenses, stock history, note, and branding; confirm account credentials and file contents are excluded.
- [ ] Choose the backup, inspect counts, download the current notebook as a checkpoint, acknowledge replacement, and confirm restore. Cancel confirmation to verify no changes.
- [ ] Changed current data invalidates the checkpoint; corrupt/unsupported/oversized backups must be rejected.
- [ ] Restore saves privately and syncs. Restore the previous downloaded backup to undo. Cloud files/profile/connections remain separate.

## Order details and customer copies

- [ ] Open Details on manual and marketplace orders; marketplace lines group by order ID and channel.
- [ ] Expand private estimates and compare captured costs; customer download/print copies must omit these fields.
- [ ] Check business branding, customer names, items, dates, and statuses on downloaded HTML and the print window.
- [ ] Cancelled lines remain visible but add zero to the recorded item total. The copy must not claim a processing order is paid.
- [ ] Long names and IDs wrap cleanly; popup-blocked users can still download the customer copy.

## Issued refunds

- [ ] Record partial and full issued refunds on Completed order lines. Date/reason are required, and cumulative amounts cannot exceed recorded item value.
- [ ] Check unchanged stock, retained original costs/fees, refund-date/channel filtering, and reduced net profit. Gross sales remain visible.
- [ ] Customer copies show refund totals but omit private reasons. Refund records save privately, sync, and round-trip through backups.
- [ ] Remove a mistaken record after confirmation; this changes the notebook only. Payments and returned-stock adjustments happen separately.

## Restock planning

- [ ] Edit a product’s Low-stock alert level and Target stock level; reject fractional levels or targets not above the alert.
- [ ] Check private persistence and live updates. Existing products default to 10 / 20.
- [ ] Restock planner includes products at/below their alerts, with target minus current stock units and estimated unit-cost totals.
- [ ] Export restock plan without changing inventory. Optional inventory CSV columns preserve configured levels on export/import of new products.

## Expanded sample data

- [ ] Explore sample notebook: see 120 products, 360 orders, 120 expenses, 120 stock adjustments, and 120 refund records.
- [ ] Check recent report views, multiple channels/statuses, low/zero stock, and grouped marketplace order details.
- [ ] Sample edits persist in the browser and do not change the real account. Return to Open my notebook and confirm saved account data is intact.
- [ ] Old small sample sessions load the expanded version; legacy browser data is preserved separately.

## Pagination and lazy loading

- [ ] Navigate Previous/Next and change page size on Inventory, Orders, Expenses, stock history, restock plans, and import previews.
- [ ] Search/filter changes reset to the first page; deleting/restoring records clamps invalid pages.
- [ ] Exports and financial totals include the full filtered data, rather than only the current page. Order selections clear when changing pages/sizes and Select visible applies to the current page.
- [ ] Closed stock/restock sections do not mount their contents; heavier pages/modals/importers load on demand with loading messages.
- [ ] Files initially fetch 25 metadata rows. Load more returns additional rows within the same product/account filter without duplicates or timestamp gaps.

## Phone and tablet layouts

- [ ] Review all five tabs at 320px, 390px, and 768px: no page-level horizontal scrolling, with readable financial cards and wrapped headings.
- [ ] Swipe wide tables to reach every column. Channel totals remain available on the Overview tab.
- [ ] Use the stacked phone filters, full-width primary action, and Inventory search/import controls.
- [ ] Open product and account dialogs; scroll to the final controls. Check Profile, Branding, and Notebook tabs in dark mode.
- [ ] Pricing calculator stays open without a disclosure header. Narrow sidebar can scroll to its theme/account controls.

## Pricing tax allowance

- [ ] Set Tax allowance (%) to 5. Recommended price rises; the separate allowance, platform fees, costs, and profit reconcile to the rounded price.
- [ ] Zero retains tax-free estimates. Negative/non-numeric values or fee + tax + margin at/above 100% show an invalid estimate.
- [ ] The calculator explains this is a reserve on selling price; order records and financial reports remain unchanged.

## Suppliers

- [ ] Add supplier contacts, notes, and a whole-number delivery lead time; link inventory items and save. Reopen to check details.
- [ ] Check persistence after reload, cross-device updates, and refusal to overwrite an edit changed on another device.
- [ ] Search by supplier contact or linked product/SKU; paginate suppliers/product choices; export all matching suppliers.
- [ ] Suppliers appear under linked inventory items. Multiple suppliers may source the same product.
- [ ] Cancel deletion and confirm no change; confirm deletion and verify products and stock remain intact.
- [ ] Another account has its own supplier list. Backups include suppliers and links; old backups default to no suppliers.
- [ ] Review Suppliers list/editor at phone and tablet widths; sample notebook has 100 fictional suppliers.

## Supplier CSV and restock sourcing

- [ ] Download the supplier template, add contacts and semicolon-separated product SKUs, then inspect the preview and confirm import.
- [ ] Repeat the CSV: existing supplier names are skipped without overwriting contact details. Duplicate file names, invalid lead times/email, and unknown SKUs block confirmation.
- [ ] New suppliers persist, synchronize privately, and appear in backups; inventory stock and reports stay unchanged.
- [ ] Open Restock planner; check supplier options and lead times. Filter by supplier and No supplier linked; exported rows and totals follow that filter across pages.
- [ ] Multiple supplier options do not multiply a product’s restock quantity or estimated cost. Review supplier CSV preview on phones/tablets.

## Purchases and deliveries

- [ ] Under Suppliers, create a multi-item purchase with linked products, whole quantities, unit costs, optional delivery date, and notes. Check private persistence and live updates.
- [ ] Creation leaves stock unchanged. Reject empty/duplicate/unknown product lines and invalid quantities, prices, or dates.
- [ ] Cancel the receive confirmation: nothing changes. Confirm full receipt: each item’s quantity increases once, the order becomes Received, and matching Restock history entries appear.
- [ ] Received and Cancelled purchases have no receive action. Cancellation leaves all stock intact; stale concurrent requests must fail rather than apply another receipt.
- [ ] Purchase item totals and history do not create overhead expenses, payments, supplier messages, or price changes.
- [ ] Search/filter/page purchases; check phone forms and details. Backups include purchase orders, complete notebook restores preserve them, and a separate account sees none of your history.

## Partial deliveries

- [ ] Receive 2 of 5 ordered units: stock rises by 2, the line shows 2 received / 3 outstanding, and status becomes Partially received.
- [ ] Receive remaining delivery: stock rises by 3, received reaches 5, and further receiving is unavailable. Zero/negative/fractional/excessive quantities must not save.
- [ ] On multi-item purchases, receive one item while leaving others at zero; history includes only the changed products.
- [ ] Keep a receipt form open on another device, receive units elsewhere, and verify the stale form is blocked until reopened.
- [ ] Cancel remainder after a partial receipt: already-received stock stays intact and remaining units show as cancelled.
- [ ] Partial counts/status round-trip in backups and old fully Received purchases cannot be received again. Check the partial receipt form on phones/tablets.

## Purchase copies and overview

- [ ] Check open purchase count, outstanding units/cost, and overdue deliveries for the entire filtered list across pages.
- [ ] Expected delivery yesterday is overdue only for Ordered/Partially received purchases; today and missing dates are not. Use the Overdue filter.
- [ ] Download/print supplier copies with current business branding, reference, supplier, item costs, and delivery counts. Internal notes, account details, and maker footer must be absent.
- [ ] Cancelled remainders show cancelled units and zero outstanding estimate; original ordered item totals stay clearly labelled.
- [ ] Block print popups and verify the download alternative remains available. Long/HTML-like names wrap safely as text.
- [ ] Copies are read-only and are not sent automatically. Review summary cards and copy buttons on phones/tablets.

## Purchase payment records

- [ ] Expand Payment records; enter an already-paid deposit with date, method, reference, and private notes. Check recorded/unrecorded item balances and live updates.
- [ ] Reject zero/negative/fractional-cent/over-total amounts and invalid/future dates. A changed remote balance blocks an open entry form until reopened.
- [ ] Cancel record removal and confirm no change; confirm removal to correct the notebook without changing actual funds, stock, or overhead expenses.
- [ ] Cancel a partially received purchase with payments: retain payments and received stock, show credit to review when paid exceeds received item value, and block further payment entries.
- [ ] Supplier copies omit all payment references/notes; backups include payment records; other accounts cannot read them. Legacy purchases start without payments.
- [ ] Review payment forms and balances on phone/tablet sizes; sample deposits remain fictional and local.

## Floating quick create

- [ ] On all six tabs, open the floating Create menu and try product, sale, expense, supplier, and purchase-order shortcuts.
- [ ] All five shortcuts open modals after selecting the relevant tab. Check first-field focus, trapped Tab/Shift+Tab, Escape/backdrop/Cancel dismissal, and restored trigger focus. Cancelled drafts are discarded.
- [ ] Leave and return via normal navigation: an old shortcut must not reopen a cancelled form.
- [ ] Empty notebooks explain why sale/PO shortcuts are unavailable. Check disabled states while saving or offline.
- [ ] Escape dismisses and restores trigger focus; clicking/tabbing outside dismisses. Dialogs and mobile navigation hide the floating control.
- [ ] Check phone/tablet placement, dark/light themes, footer clearance, and keyboard access. Opening menus/forms must not save empty records.

## Supplier refunds received

- [ ] Confirm Pricing Calculator is the last sidebar tab on desktop and mobile.
- [ ] Cancel a partially received purchase with excess payments, open Payment records → Supplier refunds received, and record part of the credit already returned.
- [ ] Check gross payments stay intact while refunds/net paid/remaining credit reconcile. Record the remaining credit and verify further refunds are disabled.
- [ ] Reject over-credit amounts, invalid/future/pre-payment dates, and fractional cents. A remotely changed refund form must be reopened.
- [ ] Cancel/confirm correction of a refund record. Payment removal that would orphan recorded refunds must be blocked.
- [ ] Check private cross-device updates, backups, supplier-copy exclusions, unchanged stock/expenses, and phone/tablet layout.

## Consistent entry modals

- [ ] Product, sale, expense, supplier and purchase-order creation use the same modal shell from both floating and regular buttons. Expense/supplier editing also uses modals.
- [ ] Create and cancel from Overview, checking the destination tab or exposing background forms. Background scrolling/interactions stay locked until the modal closes.
- [ ] Save an expense from another tab; check persistence/live updates and the Expenses destination. Verify supplier/product links and multi-line PO validation in their dialogs.
- [ ] Check phone/tablet form scrolling, light/dark styles, keyboard trapping, first-field focus, and restored focus. Reopen cancelled forms with clean fields/errors.

## Financial FAB shortcuts and styled confirmations

- [ ] Floating Create includes Purchase payment and Supplier refund. Select the intended eligible PO, then use the normal entry fields/limits on the relevant tab.
- [ ] Empty/unpaid/full/cancelled-credit conditions enable or explain unavailable shortcuts correctly.
- [ ] In a financial-entry modal, cancel its styled confirmation: keep the entry and entered values. Confirm: save once, close, and restore background interaction/scrolling.
- [ ] Exercise removal, receipt, bulk order, payment/refund, disconnect, reload and restore confirmations; app styling should replace browser confirm boxes.
- [ ] Change the notebook from a second browser while confirmation is open: Continue must disable and the stale action must not apply.
- [ ] Check keyboard focus, Escape/backdrop cancellation, mobile/light/dark styling, and absence of native JS alert/confirm/prompt calls.

## Supplier statements

- [ ] Use Statement beside a supplier; the collapsed statement panel should open and select the correct supplier.
- [ ] Reconcile gross payments, supplier refunds, net paid, unrecorded item balances, and credits across multiple purchases. Balances and credits must remain separate rather than offset.
- [ ] Filter supplier/status and search by reference, supplier, product, or SKU. Change filters from later pages and verify page reset.
- [ ] Export includes every matching purchase, even when the screen shows 25 rows. Private payment/refund references and notes are absent.
- [ ] Delete a supplier contact and confirm historical purchases remain available under Archived supplier, including when suppliers share a name.
- [ ] Closed statements defer inner rows/controls. Check phone/tablet scrolling and confirm opening/filtering/exporting makes no notebook changes.

## Printable supplier statements

- [ ] Download statement copy and Print supplier statement reflect business branding, selected supplier/status/search, preparation time, every matching row, and reconciled totals.
- [ ] Export from a later page with 100 records and confirm the HTML includes all 100, rather than only visible rows.
- [ ] Keep item balances and credits separate; cancelled rows reconcile only received items. Private notes/references and maker footer are absent.
- [ ] Test archived suppliers and long/HTML-like names; show text safely, repeat table headers in print, and use landscape paper layout.
- [ ] Block popups and verify the styled print error/download fallback. Copies and print controls must leave cloud records unchanged and remain usable on phones/tablets.

## Delivery reminders and scheduling

- [ ] Expand Delivery reminders in Suppliers; check overdue, today, seven-day boundary, later, and undated purchases using Manila dates. Received/cancelled purchases must be excluded.
- [ ] Search/filter from a later page and confirm pagination resets. Partial deliveries show only outstanding units.
- [ ] Open purchase finds and opens its record across pages. Record delivery opens the existing receipt form without changing stock until confirmed; Statement selects the correct supplier.
- [ ] Set, change, and clear expected delivery dates; verify persistence/live updates and unchanged stock/payment/refund history. Edit from a second browser while the date modal is open: stale saving must be disabled.
- [ ] Overview due/overdue shortcut opens Suppliers and the reminder panel. Check phone/tablet layouts and light/dark themes. Reminders are in-app only.

- [ ] Filter Delivery reminders by supplier, including removed contacts with open purchases and suppliers sharing a name. Changing suppliers resets pagination.
- [ ] Export delivery follow-up from a later page: include every matching purchase, outstanding quantities/item estimates, and Manila dates. Exclude closed purchases, private notes and payment records; safely quote CSV cells and formula-like names. Empty results disable export. Verify filtered matching count and no changes to business data.

## Restock purchase drafts

- [ ] Inventory → Restock planner → choose one saved supplier → Prepare purchase order opens Suppliers and the regular modal with linked low-stock products, editable units, and current costs.
- [ ] Deduct outstanding units across all suppliers; subtract only unreceived units of partial purchases and ignore cancelled/received purchases. Fully covered plans show a notice. Over-100-line plans must not truncate.
- [ ] Cancel leaves purchases/stock unchanged; save uses normal purchase validation and persistence. Receive saved purchases through the existing delivery workflow.
- [ ] Change stock, supplier links/details, product planning fields, or open purchase items from another device while the draft is open. Saving is blocked until the draft is prepared again. Payment-only changes should not block it.
- [ ] Check phone modal layout, keyboard dismissal, destination tab, and disabled actions while cloud changes are pending. Planning CSV/table show stock shortfall, incoming units and additional buying separately.

## Incoming stock in restock planning

- [ ] Compare stock shortfall, on-order units across all suppliers, additional units to buy, and additional item estimates. Partial receipts count only unreceived units; cancelled/received orders count zero.
- [ ] Incoming coverage keeps low-stock rows visible, shows zero additional buying and disables preparing an empty purchase. Current stock must not increase until receipt.
- [ ] Supplier filtering changes product scope without excluding purchases from other suppliers for those products. CSV and summary cover every matching page and preserve cent totals; private purchase/payment notes stay absent.
- [ ] Check phone table swiping, summary wrapping, safe CSV quoting, and unchanged business records after viewing/exporting.

## Restock search and coverage views

- [ ] Combine Restock supplier, Restock view, and Search restock products. Search matches product names/SKUs, with trimmed case-insensitive text.
- [ ] From a later page, change each filter and verify the page resets. Needs buying excludes covered products; Covered by incoming stock keeps only zero-additional-buying rows.
- [ ] Totals, CSV exports, and prepared purchase drafts use every matching product across pages, without adding search-hidden products. Empty/covered results disable purchase creation.
- [ ] Check the three controls align on desktop and stack on phones/tablets; no horizontal page overflow.

## Bounded notebook reads and selective live refresh

- [ ] Open a populated cloud notebook: browser requests manifest and collection pages of at most 100 records, without a full GET `/api/notebook`. Every collection is complete before editing is enabled.
- [ ] Compare totals, exports, backup contents and stock with the complete legacy response. Page boundaries preserve the stored array order and never omit records.
- [ ] Change the notebook while pages are loading: stale pages return 409 and restart; repeated changes/failed/short pages show a recoverable loading error rather than opening partial data.
- [ ] A metadata-only change fetches no collection pages. A product-only change reloads products while reusing unchanged orders, expenses, suppliers and histories. Dirty local edits still trigger a conflict instead of overwrite.
- [ ] Anonymous requests reject access; another real account cannot read the owner's manifest/pages or reuse its memory cache. Reconnect, reload, sample switching and sign-out safely invalidate pending loads.
- [ ] Run `npm run verify:pagination`, `npm run verify:neon`, and `npm run verify:mobile` on the production build. Remember that initial hydration and writes are still full-collection operations; this phase does not yet provide truly on-demand table loading.

## Server reports and record saves

- [ ] On a cloud account, report totals/charts/channel revenue/counts/inventory/previews and summary CSV use `/api/notebook/report`. Verify all periods/channels, fractional fees/cents, future-date exclusion, whole-business overhead, and refunds recorded in a different period from the sale.
- [ ] Change filters quickly or save data while a report is loading: obsolete responses must not replace the current revision/filter results. Pending/error reports cannot export stale summaries; Retry report recovers. Sample mode remains local.
- [ ] Ordinary edits send PATCH changes containing affected records only. Test product edits, sale + stock, stock history, imports, refunds, suppliers, receipts, payments, notes and branding; untouched records/order stay intact.
- [ ] A failed linked-record validation changes nothing. Concurrent/stale PATCH requests cannot overwrite each other. Check anonymous/wrong-user/cross-origin rejection.
- [ ] Backup restore uses the existing confirmed PUT path and an identical restore does not create a redundant full save. Follow a restore/reload/sample switch with a normal edit: it should use PATCH.
- [ ] Run `npm run verify:server`, the complete Neon suite, unit tests and mobile checks. Storage is relational and the main lists open through on-demand queries. Check targeted reads and writes against the workflow sections below.

## On-demand Inventory and server downloads

- [ ] Open a populated cloud account: no collection-page requests before entering a tool. SQL report totals/previews and branding still display correctly.
- [ ] Inventory shows the manifest’s total product count and fetches only the requested SQL page. Search from a later page, clear it, and change page size; show correct counts/reset/clamping and current supplier names.
- [ ] Check literal percent/underscore search, no results, stale revisions, failed reads/retry, rapid search changes, live updates and 320/390/768px table swiping without page overflow.
- [ ] Inventory/order/expense CSV downloads contain all matching saved records across every page. Backups downloaded from partially loaded Inventory contain every collection; another account/anonymous request cannot access these files.
- [ ] Note/branding saves before full hydration preserve all unseen records. Opening edit/import/quick-create/stock/purchase tools waits for complete tool data; cancellation does not change data. Failed or account-switched loads cannot apply stale records.
- [ ] Confirm a downloaded-current backup becomes stale after any revision change, even when that collection is unloaded. Restore uses the reviewed full file and expected revision; repeat an identical marked restore without a redundant write.
- [ ] Other record tabs still hydrate complete collections; do not treat this phase as full on-demand conversion of every workflow. Specialized exports remain based on complete tool data.

## On-demand Orders

- [ ] Enter Orders from a freshly opened account: fetch only the active SQL page and reports, with no complete collection-page reads. Check 10/25/50/100 sizes and current-page clamping.
- [ ] Combine date/channel/status/search and all three sort choices. Search SKU, internal ID, marketplace source ID, customer and product; filtered totals/CSV include every matching page. Filter changes reset pagination.
- [ ] Live revisions refresh the page and clear selection. Change data on another device while a bulk confirmation is open on an unloaded notebook: Continue disables and cancellation leaves order/stock history unchanged.
- [ ] Invoke details/import/single/bulk status actions from a partially loaded list. Wait for related records, reject changed selections, and preserve all unseen records. Completion leaves stock unchanged; cancellation restores only reserved manual units.
- [ ] Check failed reads/retry, anonymous/wrong-account/stale-revision rejection, deterministic mixed-case ID ties and phone/tablet table swiping. Run verify:orders plus full cloud and mobile regression suites.

## On-demand Expenses

- [ ] A fresh Expenses visit fetches only its page and SQL report. Check title/notes search, literal percent/underscore, category, channel/date filters, full count/amount and 10/25/50/100 rows. Date ties preserve stored order.
- [ ] From a later page, enter and clear search or change category/reporting filters: return to page one. Live updates preserve the current page where possible. CSV includes every match and excludes future entries until their date.
- [ ] Open New/Edit/Delete from a partially loaded list: load required records safely. Cancel must leave data intact; deletion removes only its expense. An out-of-window expense change during confirmation disables Continue.
- [ ] Change an entry remotely with its edit modal open: preserve the draft and reject stale Save. A list refresh cannot unmount the editor or overwrite a newer amount.
- [ ] Verify retry/error states, disabled stale exports, account/revision/bounds guards, mobile table swiping and unchanged sample workflows. Run verify:expenses, verify:orders, full Neon and mobile suites.

## On-demand supplier contacts

- [ ] A fresh Suppliers visit fetches only the contact page. Header/list counts cover the full saved/matching collection; purchase/reminder/statement panels do not load until opened.
- [ ] Search name/contact/email/phone and linked product names/SKUs, including literal wildcard-looking text. Check accent/case/duplicate-name order, 10/25/50/100 sizes, search reset and live refresh.
- [ ] Supplier CSV export contains every match across pages, including links and safely quoted private fields. Anonymous/wrong-account/stale/bad-bounds requests are rejected.
- [ ] Open add/edit/import/delete from an unloaded contact list: wait for complete related data. Stale contact/link edits remain blocked, drafts survive refresh, and contact deletion preserves inventory/stock and archived purchase history.
- [ ] Change an unloaded purchase while delete confirmation is open: Continue disables. Statement shortcuts and purchase/reminder panels load correctly only when invoked; cancelling purchase entry creates nothing.
- [ ] Verify phone/tablet swiping and existing sample/financial workflows. Run verify:suppliers, full cloud and mobile checks; record implementation changes separately rather than marking unperformed manual checks complete.

## On-demand purchase, reminder, statement and history panels

- [ ] From a fresh account visit, expand each supplier tool and stock/customer-refund history. Network requests should use bounded `/view` pages without `/pages` collection hydration. Closed panels should defer their reads.
- [ ] Change search/status/supplier/page size, including clearing a search from a later page. Counts and totals cover every match; filters reset pagination. Remote changes refresh/clamp pages while preserving open drafts.
- [ ] Reconcile partial/legacy received/cancelled purchases, outstanding units, missing dates and seven-day Manila boundaries. Reminder summary counts remain global even with a supplier/search filter.
- [ ] Export all matching purchases, reminders and histories from later pages. Print/download a complete branded statement; omit private transaction fields and maker footer. Check blocked popup and failed-read/retry behavior.
- [ ] Expand multi-page payment/supplier-refund/grouped customer-refund records. Opening entry, receipt or date forms loads complete related data. Stale edits/confirmations must still reject remote changes; unseen records and stock must be preserved.
- [ ] Check stock and global customer-refund histories on phones/tablets, full CSVs, wrong-account/anonymous/stale-revision rejection and unchanged sample workflows. Automated evidence: views-e2e.json plus cloud/mobile/supplier regressions.

## Individual product and expense editors

- [ ] On a fresh cloud visit, open New/Edit product and New/Edit/Delete expense, including FAB creation. Only individual `/record` lookups/saves and manifest/visible page refreshes should occur; no `/pages` collection loading.
- [ ] Edit a product from a later page, try a duplicate SKU, and verify existing stock cannot be changed through the product editor. Unseen records, supplier links and purchase history must remain intact.
- [ ] Fail a save request: keep form values and retry with the same creation ID. Change/delete the selected record remotely with an open draft: keep typed inputs and reject the stale save. Unrelated revision changes must not silently overwrite records.
- [ ] Confirm expense deletion still invalidates on unseen live changes and removes only its selected entry. Check SQL totals/counts and full exports afterward.
- [ ] Verify phone/tablet forms, sample/local behavior, already-hydrated delta saves, wrong-account/anonymous/cross-origin/revision guards and saved-but-refresh-failed recovery. Evidence: records-e2e.json, expenses-e2e.json, cloud and mobile suites.

## Targeted sale entry and order details

- [ ] On a fresh cloud visit, open a sale from the regular button and FAB. Search by product/SKU, page the picker, keep the chosen product selected, and save. Only inventory pages and the sale command/manifest refresh should load; no full `/pages` hydration.
- [ ] Change the selected product's price or stock remotely. Keep buyer inputs and reject the stale sale; review latest stock and retry. Simultaneous requests at the same revision must commit only once. Failed creates must reuse their identity on retry.
- [ ] Open order details from Orders and global refund history. Include every line/refund in the selected group, retaining case/whitespace/channel identity rules; omit unrelated records. Check failed lookup retry and live refresh without lost drafts.
- [ ] Customer copies/printing include every grouped line and refund total, branding, and no private reasons/internal costs/maker credit. Disable stale copies while a new detail revision is loading or failed.
- [ ] Create and correct a customer refund, including a group with multiple history pages. Server caps use all recorded refunds; stock and expenses remain unchanged. Check confirmation invalidation, isolation, phone/tablet layout and sample/already-hydrated paths.

## Targeted order completion and cancellation

- [ ] From a fresh cloud Orders visit, complete/cancel one line and a selected page (up to 100). Requests should include only selected snapshots and make no collection `/pages` reads. Check refreshed counts/reports and cleared page selection.
- [ ] Complete processing lines: stock remains unchanged. Cancel shared-product manual reservations mixed with imported history: restore only manual quantities, once per product, and leave unrelated records/history unchanged.
- [ ] Change an unseen record during bulk confirmation: Continue disables. Changed/deleted/already-transitioned selections and duplicate/oversized requests must reject safely. A stock-limit failure rejects the entire batch.
- [ ] Race identical cancellation attempts: only one write succeeds and stock restores once. Check failed-write retry, anonymous/wrong-account/origin/revision guards, phone/tablet use and existing sample/already-loaded workflows. Automated evidence: orders-e2e.json and order-tools-e2e.json.

## Targeted supplier contacts and product linking

- [ ] On a fresh cloud visit, add/edit/delete suppliers from regular buttons and FAB. Opening a contact uses one `/record` lookup; saves/deletes preserve unseen contacts and make no collection `/pages` reads.
- [ ] Linked inventory starts collapsed and makes no product requests until expanded. Search, page and resize the picker; existing and newly checked links stay selected across pages/searches, including links not currently visible.
- [ ] Fail a create request: preserve contact fields and retry using the same ID. Change contact/link fields remotely with a draft open: preserve inputs and reject the stale save. Reject missing/duplicate product links and invalid contact details on the server.
- [ ] Delete a supplier after a styled confirmation: keep products, stock, files and historical purchases; the removed contact remains an archived statement option. Unloaded revision changes must still invalidate an open confirmation.
- [ ] Check 320/390/768px editor widths, keyboard use, empty product search, retry errors, limit behavior, real-account isolation and sample/already-loaded workflows. Supplier import still prepares complete data explicitly; evidence is in suppliers-e2e.json.

## Targeted purchase commands and financial pickers

- [ ] From a fresh cloud visit, create a purchase from the regular button and FAB. Search/page suppliers and linked products; preserve selected lines and failed-save draft/ID. Inventory and purchases outside the selected choices must not hydrate through `/pages`.
- [ ] Set/clear an expected date, receive part/all of a delivery and cancel its remainder. Save only the purchase, arrived stock and new history. Received stock, unrelated records and payment/refund histories must remain intact. Race receipts and reject stale/replayed requests.
- [ ] Record payments and cancelled-purchase refunds, including financial FAB pickers. Eligibility and limits cover every matching page. Preserve financial identities after failed saves and reject stale forms. Supporting payments cannot be removed until mistaken refunds are corrected first.
- [ ] Check live receipt/date/financial progress guards and lookup retry without lost drafts. Supplier copies omit internal notes/payment details and keep complete recorded items. Financial bookkeeping does not transfer funds or affect overhead.
- [ ] Verify phone/tablet creation, partial receipt and financial forms; owner/auth/origin/revision guards; sample/full-data paths; and restock-prepared drafts. Evidence: purchase-tools-e2e.json, views-e2e.json and cloud/mobile/supplier suites.
