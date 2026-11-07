# Seller’s Notebook — 15-second promo

Inspection: the local production site has a public notebook illustration and a signed-in workspace with Overview, Inventory, Orders, Expenses, Suppliers and Pricing calculator. Recording uses the existing sample notebook from the account dialog, with fictional figures and no changes to existing business records. Marketplace API connections are setup-dependent and will not be advertised as connected.

| Time     | Actual website footage / action                                  | Caption                                  |
| -------- | ---------------------------------------------------------------- | ---------------------------------------- |
| 0–2s     | Landing page, gentle push toward the hero                        | A fresh page for your business.          |
| 2–5s     | Sample overview: revenue, estimated profit and channel breakdown | Your business, at a glance.              |
| 5–8s     | Inventory: type a product search and show matching stock         | Find products. Follow your stock.        |
| 8–11s    | Orders: filter an existing sales channel                         | Every sale, in one place.                |
| 11–13.5s | Pricing calculator: change target margin; result updates         | Price with a little room to grow.        |
| 13.5–15s | Cream paper end card, sage green CTA                             | Seller’s Notebook / Start your notebook. |

Art direction: existing cream #eeeadd / warm paper #faf9ef, ink #364a3f, sage #466d50, pale yellow and rose details. Notebook rules, small page numbers, short captions, soft crossfades, restrained 2–4% pushes. Actual site footage sits in a rounded paper frame with generous caption space. Sample figures disclosed on feature scenes.

Technical: Playwright viewport and video 1920×1080. Preload each feature before recording useful sections; edit out navigation waits. Remotion at 30 fps / 450 frames; FFmpeg H.264, yuv420p, faststart, two-pass compression targeting less than 5 MB. Silent autoplay-friendly delivery.

## Purpose-specific versions

### Revision: expenses and suppliers

Landing loop stays 15 seconds: 0–2.4 overview, 2.4–4.8 inventory search, 4.8–7.2 order channel filter, 7.2–9.6 expenses category filter, 9.6–12 suppliers search, 12–14.4 pricing calculator, 14.4–15 return to the opening overview. Each feature gets a short caption. The last and first rendered frames must match.

New vertical operations promo, 15 seconds: 0–2 “The little costs. The good people.” hook; 2–6 expenses ledger with category filtering and overhead/net-profit context; 6–10 supplier search showing contacts, linked products and lead times; 10–13 purchase/delivery view filtered to overdue items; 13–15 Seller’s Notebook closing invitation. The existing general social video stays available. Record new real interactions with the built-in sample notebook; no saved business records are changed. Preserve the same cream/sage identity, soft transitions, large phone captions and silent playback. Export 1080×1920 H.264 MP4 under 5 MB.

Landing autoplay: 1920×1080, silent, 15 seconds. Overview → inventory search → order channel filtering → pricing → opening overview. Soft overlapping transitions. Last frames repeat the exact opening view for a clean loop. No closing CTA card. Deliver a matching poster and embed example with autoplay, muted, loop and playsinline; website integration is separate from asset preparation.

Social sharing: user selected vertical 9:16, 1080×1920. 0–2s “Less scattered. More settled.” with actual landing footage; 2–5s business overview; 5–8s inventory search; 8–11s order filtering; 11–13s calculator; 13–15s branded “Start your notebook” invitation. Large captions and a full-interface inset plus a closer crop preserve real website context and phone readability. Content stays inside generous top/bottom margins. Caption-led silent version; no music rights required.
