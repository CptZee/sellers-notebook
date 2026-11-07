# Physical supplier returns

Open Suppliers > Purchase orders > a purchase > Goods returns & return refunds.

Return received goods after sending them back. Whole units are capped by current stock and unreturned received quantities. Gross deliveries remain historical; returns do not reopen purchases or schedule replacements.

Credit uses the original purchase cost. Unpaid credit reduces the balance. Record returned-goods cash separately only after money arrives; supporting payment and return dates/caps are enforced. Cancelled unreceived-unit refunds remain separate.

Void mistaken returns only after the goods are back in inventory. Correct supporting cash entries first. Voids retain history and add linked stock corrections.

Supplier copies show returned units and credit while excluding private reasons and cash notes. Backups include the full return and audit history.

Migration 0007 adds typed return headers, lines and cash refund tables with owned purchase/stock foreign keys. No document column is introduced.

Verification: 186 unit tests, production build, db:check, verify:goods-returns and the existing verify:views suite (168 SQL combinations). Goods-return checks cover API writes, stock/history reconciliation, SQL statements, private copies, backups, refund/void limits, stale commands, browser retry retention, targeted loading, phone/tablet widths and authentication.

Live marketplace credentials and scheduler/webhook activation remain pending separate setup.
