import "./legal-links.css";
export function LegalLinks({ includeApi = false }: { includeApi?: boolean }) {
    return (
        <nav
            className="legal-links"
            aria-label={includeApi ? "Footer navigation" : "Legal"}
        >
            {includeApi && <a href="/developers">API documentation</a>}
            <a href="/terms">Terms &amp; Conditions</a>
            <a href="/privacy">Privacy Policy</a>
        </nav>
    );
}
