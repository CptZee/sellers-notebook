# Search and sharing

The public site uses https://ntbk.ajmission.dev as its canonical origin. Shared metadata lives in `lib/site-metadata.ts`; update that value when self-hosting on another domain, then rebuild.

The homepage, Terms and Privacy pages have canonical URLs and appear in `/sitemap.xml`. All other pages inherit noindex/nofollow. `/robots.txt` excludes API, account, authentication and notebook paths from crawling; these directives complement existing authentication and are not access controls.

Open Graph and Twitter summary cards use a self-contained 1200 × 630 PNG generated at `/opengraph-image`. Its notebook palette matches the website and does not depend on external fonts or image services. Homepage structured data describes the website and business app without invented reviews, ratings or prices.

After deploying:

1. Check the homepage source, `/robots.txt`, `/sitemap.xml` and `/opengraph-image` on the public domain.
2. Verify domain ownership in Google Search Console using a DNS record, then submit `https://ntbk.ajmission.dev/sitemap.xml`. Ownership verification and indexing happen outside the app.
3. Refresh an old link preview using the relevant platform’s sharing debugger; platforms may cache earlier previews.

Run `node scripts/verify-site-metadata.cjs` against a running production server (defaults to port 3200); set `VERIFY_BASE_URL` to another local server if necessary. This checks rendered HTML and generated endpoints, not search engine acceptance.
