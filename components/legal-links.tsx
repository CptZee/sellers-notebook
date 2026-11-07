import "./legal-links.css";
export function LegalLinks() {
    return (
        <nav
            className="legal-links"
            aria-label="Legal"
        >
            <a href="/terms">Terms &amp; Conditions</a>
            <a href="/privacy">Privacy Policy</a>
        </nav>
    );
}
