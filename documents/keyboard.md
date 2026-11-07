# Keyboard and modal verification

Account settings now uses the same portal-based modal stack as entry forms. The background becomes inert and body scrolling is locked until the last modal closes. A nested confirmation makes its parent inert; closing it restores focus to its parent trigger. Escape closes only the top dialog. Closing Account settings returns focus to the account button when available.

Shared Tab loops include visible enabled controls, including textareas and summaries, and exclude inactive tabs (negative tabindex). Profile/Branding/Notebook tabs support Left/Right, Home and End with the selected tab as the only tab stop.

Run `npm run verify:keyboard` against the local production app. The suite creates a temporary account and sample notebook, checks forward/reverse focus wrapping and restoration, cancels a nested backup confirmation, checks 320/390/768px layouts, and exercises a supplier entry with textarea controls and FAB focus restoration. Test accounts and notebook data are removed in cleanup. Results: keyboard-e2e.json.

Human screen-reader checks and complete keyboard acceptance across all business workflows remain release checks; this focused suite does not replace them.
