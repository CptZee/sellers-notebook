import type { MetadataRoute } from "next";
import { siteUrl } from "../lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
    return ["/", "/terms", "/privacy", "/developers"].map((path) => ({ url: siteUrl + path }));
}
