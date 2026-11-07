export type ExerciseKind =
    | "product"
    | "stock"
    | "sale"
    | "complete"
    | "refund"
    | "expense"
    | "supplier"
    | "purchase"
    | "receive"
    | "payment"
    | "pricing";
export type NotebookTourStep = {
    page: string;
    chapter: string;
    title: string;
    description: string;
    tip: string;
    selector: string;
    exercise?: ExerciseKind;
};
export const tourSteps: NotebookTourStep[] = [
    {
        page: "Overview",
        chapter: "Welcome",
        title: "Learn by doing, at your own pace",
        description:
            "This longer tour explains the everyday workflow and gives you a disposable practice notebook inside the guide. Try fictional entries as you learn.",
        tip: "Practice entries exist only in this open tour. They never enter your notebook, uploads, marketplace accounts, or database. Skip or close whenever you like.",
        selector: "",
    },
    {
        page: "Overview",
        chapter: "Overview",
        title: "Read the business overview",
        description:
            "Revenue includes completed order lines. Estimated net profit subtracts recorded product costs, selling costs, refunds and overhead. Processing and cancelled orders do not count as completed revenue.",
        tip: "These are estimates from your records. Marketplace payouts, unrecorded costs and tax obligations may differ.",
        selector: ".stats",
    },
    {
        page: "Overview",
        chapter: "Overview",
        title: "Choose the period and sales channel",
        description:
            "Use the channel selector and date range to narrow sales reports. Custom dates set a specific window; All time includes saved history. Refunds follow the date they were recorded.",
        tip: "Inventory and supplier summary cards show current notebook totals. Searching a list or changing sales filters does not change those totals.",
        selector: ".toolbar",
    },
    {
        page: "Inventory",
        chapter: "Inventory",
        title: "Create a practice product",
        description:
            "A product needs a name, a unique SKU, unit cost, selling price and opening stock. Cost is what one unit costs you; selling price is what you charge. Try a fictional tote bag below.",
        tip: "In your real notebook, choose Add product. Changing a saved product’s price does not rewrite existing order costs or prices.",
        selector: ".page-heading > .button",
        exercise: "product",
    },
    {
        page: "Inventory",
        chapter: "Inventory",
        title: "Understand stock alerts and targets",
        description:
            "The alert level flags products at or below that quantity. The target tells the restock planner how many units you want on hand. Low-stock products are a prompt to review, not an automatic purchase.",
        tip: "Edit a product to change its alert and target. Stock value is current units × recorded unit cost, not expected sales revenue.",
        selector: ".inventory-card",
    },
    {
        page: "Inventory",
        chapter: "Inventory",
        title: "Practice a stock adjustment",
        description:
            "Use New stock adjustment inside Restock planner or Stock adjustments. Restock adds units, Damage removes them, and Correction replaces the count. Each change needs a reason.",
        tip: "A manual restock changes quantity only. It does not record a supplier purchase, payment or overhead expense.",
        selector: ".stock-adjustments > summary",
        exercise: "stock",
    },
    {
        page: "Inventory",
        chapter: "Inventory",
        title: "Plan purchases without double buying",
        description:
            "Restock planner compares current stock with alert and target levels, then accounts for quantities already on open purchases. Filter by supplier and prepare a purchase for the units still needed.",
        tip: "Incoming units are not available stock until you record delivery. A prepared purchase still needs review before saving.",
        selector: ".restock-plan > summary",
    },
    {
        page: "Inventory",
        chapter: "Inventory",
        title: "Keep receipts and files with products",
        description:
            "Open Tucked between the pages to attach a receipt, image, PDF, CSV or text file. Use a product’s Files action to select it, or leave a file unlinked and link it later.",
        tip: "Files are private to your account and count toward its allowance. Attachments are limited to 5 MB each. This tour does not upload any file.",
        selector: "#product-attachments > summary",
    },
    {
        page: "Inventory",
        chapter: "Inventory",
        title: "Import and export inventory carefully",
        description:
            "Import inventory CSV opens a column-mapping and preview workflow. Review errors and SKU matches before confirming. Export downloads the matching saved records, including results beyond the visible page.",
        tip: "Inventory import adds products; use stock adjustments or received purchases for later quantity changes. Keep independent backups of important records and files.",
        selector: ".inventory-card",
    },
    {
        page: "Orders",
        chapter: "Orders",
        title: "Record a practice sale",
        description:
            "Choose an in-stock product, customer, channel, quantity and date. Enter your actual fee percentage, packaging cost and shipping cost. A manual sale starts as Processing and reserves its units immediately.",
        tip: "Order costs use unit cost × quantity, percentage fees on revenue, and the packaging/shipping amounts entered for the order line.",
        selector: ".page-heading > .button",
        exercise: "sale",
    },
    {
        page: "Orders",
        chapter: "Orders",
        title: "Complete the sale to count revenue",
        description:
            "Use Complete or an order’s details when the sale is ready to count as completed. The order then contributes revenue and estimated profit to the selected reporting period.",
        tip: "Completing a processing sale does not deduct the stock a second time. Completion records your business status; it does not collect payment from the buyer.",
        selector: ".cloud-orders, .order-tools",
        exercise: "complete",
    },
    {
        page: "Orders",
        chapter: "Orders",
        title: "Cancellations and refunds are different",
        description:
            "Cancel an eligible order to release its reserved stock. A refund record documents money already refunded outside the notebook. It reduces estimated profit but does not move money or automatically restock a product.",
        tip: "Record only the remaining refundable amount. Deleting a mistaken refund corrects notebook history; it does not reverse a real-world payment.",
        selector: ".customer-refund-history > summary",
        exercise: "refund",
    },
    {
        page: "Orders",
        chapter: "Orders",
        title: "Review marketplace history before importing",
        description:
            "Import orders CSV supports marketplace history without connecting a shop. Map columns and inspect the preview. Available connections can fetch authorized shop orders into a review step instead.",
        tip: "Imported historical orders preserve current inventory stock, unlike a new manual sale. Existing imported lines are skipped to help prevent duplicates.",
        selector: ".marketplace-connections-card > summary",
    },
    {
        page: "Expenses",
        chapter: "Expenses",
        title: "Record a practice overhead expense",
        description:
            "Expenses are costs of running the business, such as ads, software or rent. Add a title, amount, date, category and whether the expense belongs to the whole business or one channel.",
        tip: "Do not enter product costs, fees, packaging or shipping here if they are already on an order. Recording the same cost twice understates profit.",
        selector: ".page-heading > .button",
        exercise: "expense",
    },
    {
        page: "Expenses",
        chapter: "Expenses",
        title: "Find and correct expense records",
        description:
            "Filter expense entries by category, channel, date or search text. Edit an incorrect entry or delete a duplicate after checking it. Exports follow the current list filters across all matching pages.",
        tip: "Whole-business overhead is separate from a single-channel view. Changing a notebook expense never changes a bank transaction.",
        selector: ".expense-list-filters",
    },
    {
        page: "Suppliers",
        chapter: "Suppliers",
        title: "Add and link a practice supplier",
        description:
            "Save a supplier’s contact information and lead time, then link the products they supply. Product links help you prepare purchases and compare supplier options in Restock planner.",
        tip: "Saving contact details does not send a message, place an order or authorize a payment to the supplier.",
        selector: ".supplier-manager .section-summary",
        exercise: "supplier",
    },
    {
        page: "Suppliers",
        chapter: "Suppliers",
        title: "Create a practice purchase",
        description:
            "Purchases & deliveries keeps the supplier, product lines, quantities, agreed unit costs and expected delivery date together. Saving a purchase records what is on order; it does not add available stock yet.",
        tip: "Review a prepared purchase before saving. Its item cost is separate from overhead and its payment history.",
        selector: ".purchase-orders > summary",
        exercise: "purchase",
    },
    {
        page: "Suppliers",
        chapter: "Suppliers",
        title: "Receive a partial delivery",
        description:
            "Record the quantity that actually arrived on each purchase line. A partial receipt increases stock by those units and keeps the remainder outstanding. A full receipt closes the delivery.",
        tip: "Record arrivals against the purchase instead of making a second manual restock for the same delivery. That would double-count stock.",
        selector: ".purchase-orders > summary",
        exercise: "receive",
    },
    {
        page: "Suppliers",
        chapter: "Suppliers",
        title: "Record a supplier payment",
        description:
            "Payments document money you already paid outside the notebook. Record the amount, payment date, method and reference. Partial payments reduce the purchase’s remaining recorded balance.",
        tip: "No money is transferred. Recording a payment does not receive goods, change stock or create a second overhead expense.",
        selector: ".purchase-orders > summary",
        exercise: "payment",
    },
    {
        page: "Suppliers",
        chapter: "Suppliers",
        title: "Handle returns and supplier credit",
        description:
            "For received goods, record an eligible supplier return against the purchase. It adjusts returned stock and item credit. Record money actually returned by the supplier separately as a refund.",
        tip: "Cancelling outstanding units, returning received goods, and recording a cash refund are distinct actions. Review the purchase’s latest quantities and financial history first.",
        selector: ".purchase-orders > summary",
    },
    {
        page: "Suppliers",
        chapter: "Suppliers",
        title: "Follow up deliveries and statements",
        description:
            "Delivery reminders group open purchases as overdue, due today, coming soon or missing a date. Supplier statements bring purchases, payments, refunds, outstanding balances and credit together.",
        tip: "Delivery dates use Asia/Manila. The Suppliers overview totals include all saved suppliers and open purchases, rather than only the visible list page.",
        selector: ".delivery-reminders > summary",
    },
    {
        page: "Pricing calculator",
        chapter: "Pricing",
        title: "Try a price with room to grow",
        description:
            "Enter unit cost, packaging, shipping, platform fee, tax allowance and target margin. The calculator divides your base costs by the portion of the selling price left after these percentages.",
        tip: "Margin is a percentage of selling price, not a markup on cost. Fees + tax allowance + target margin must total less than 100%. This is a planning estimate.",
        selector: ".price-result h2",
        exercise: "pricing",
    },
    {
        page: "Overview",
        chapter: "Account & tools",
        title: "Use Quick create for everyday entries",
        description:
            "The plus button offers shortcuts to products, sales, expenses, suppliers and purchase-related records. Add a product before a sale, and link products to a supplier before preparing a purchase.",
        tip: "Disabled shortcuts explain which prerequisite is missing. Each entry still needs review and confirmation before it is saved.",
        selector: ".quick-create-trigger",
    },
    {
        page: "Overview",
        chapter: "Account & tools",
        title: "Find your account tools",
        description:
            "Open Account settings for Profile, Branding, Connections and Notebook. Profile includes Sign out; Branding includes the cursor preference. Connections manages authorized shops. Notebook contains storage, backup and account-deletion tools.",
        tip: "A notebook backup and CSV exports do not replace downloading your uploaded files. Paid upgrades and unconfigured marketplace integrations remain unavailable until enabled.",
        selector: ".profile-button",
    },
    {
        page: "Overview",
        chapter: "Finish",
        title: "Ready for your own little business",
        description:
            "Your practice entries will now be discarded. Start with a real product when you are ready, and reopen Take a tour whenever you need a refresher.",
        tip: "Finishing saves only the tutorial-completion flag. None of the fictional products, sales, expenses, suppliers or purchases in this tour are saved.",
        selector: "[data-tour-replay]",
    },
];
