import type { Metadata } from "next";

export const siteUrl = "https://ntbk.ajmission.dev";
export const siteName = "Seller’s Notebook";
export const siteTitle = "Seller’s Notebook — Your business, beautifully kept";
export const siteDescription =
    "Keep inventory, orders, expenses, suppliers and pricing together in a private business notebook, with live sync across your signed-in devices.";
export const shareImage = {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: "Seller’s Notebook — Your business, beautifully kept. Inventory, orders, expenses, suppliers and pricing in one place.",
};

export function publicPageMetadata(path: string, title: string, description: string): Metadata {
    return {
        title,
        description,
        alternates: { canonical: path },
        robots: { index: true, follow: true },
        openGraph: {
            type: "website",
            siteName,
            locale: "en_PH",
            url: path,
            title,
            description,
            images: [shareImage],
        },
        twitter: { card: "summary_large_image", title, description, images: [shareImage] },
    };
}
