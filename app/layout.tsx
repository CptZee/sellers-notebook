import { siteUrl, siteName, siteTitle, siteDescription, shareImage } from "../lib/site-metadata";
import type { Metadata } from "next";
import "./globals.css";
import "./notebook.css";
import "./themes.css";
import "./cursor.css";
import { CursorToggle } from "../components/cursor-toggle";
import { SiteFooter } from "../components/site-footer";
export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    title: siteTitle,
    description: siteDescription,
    robots: { index: false, follow: false },
    openGraph: {
        type: "website",
        siteName,
        locale: "en_PH",
        url: siteUrl,
        title: siteTitle,
        description: siteDescription,
        images: [shareImage],
    },
    twitter: {
        card: "summary_large_image",
        title: siteTitle,
        description: siteDescription,
        images: [shareImage],
    },
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
