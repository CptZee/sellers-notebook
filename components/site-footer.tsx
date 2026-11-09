"use client";
import { usePathname } from "next/navigation";
import { LegalLinks } from "./legal-links";
import { MakerCredit } from "./maker-credit";
import "./site-footer.css";
export function SiteFooter({ fallback = false }: { fallback?: boolean }) {
    const pathname = usePathname();
    if (fallback && ["/", "/terms", "/privacy", "/notebook"].includes(pathname || "")) return null;
    return (
        <footer className="site-footer">
            <div className="site-footer-row">
                <span className="site-footer-tagline">Your business, beautifully kept.</span>
                <LegalLinks includeApi />
            </div>
            <MakerCredit />
        </footer>
    );
}
