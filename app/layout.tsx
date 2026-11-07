import type { Metadata } from "next";
import "./globals.css";
import "./notebook.css";
import "./themes.css";
import "./cursor.css";
import { CursorToggle } from "../components/cursor-toggle";
import { SiteFooter } from "../components/site-footer";
export const metadata: Metadata = {
    title: "Seller’s Notebook — Your business, beautifully kept",
    description:
        "Your private business notebook for inventory, orders, expenses, suppliers, purchases, and pricing, with live sync across your signed-in devices.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
        >
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: "try{document.documentElement.dataset.theme=localStorage.getItem('notebook-theme')==='dark'?'dark':'light'}catch{document.documentElement.dataset.theme='light'}try{document.documentElement.dataset.cursor=localStorage.getItem('notebook-cursor')==='off'?'off':'on'}catch{document.documentElement.dataset.cursor='on'}",
                    }}
                />
            </head>
            <body>
                {children}
                <SiteFooter fallback />
                <CursorToggle />
            </body>
        </html>
    );
}
