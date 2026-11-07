# Marketplace activation handoff

Production origin: https://ntbk.ajmission.dev
Deployment is owner-managed. Real mailbox acceptance is deferred by request.

App credentials are not configured yet. Existing encryption keys are preserved. Connection features remain gated and live import/scheduled-worker flags remain off. CSV imports remain usable.

## Register these exact callbacks

| Platform    | Callback                                                    |
| ----------- | ----------------------------------------------------------- |
| Shopee      | https://ntbk.ajmission.dev/api/shopee/callback              |
| Lazada      | https://ntbk.ajmission.dev/api/marketplaces/lazada/callback |
| TikTok Shop | https://ntbk.ajmission.dev/api/marketplaces/tiktok/callback |

These callbacks have been added to the local environment and the public example. Register them in each approved app's configuration. The domain must serve this app before real authorization can complete; deployment itself is left to the owner.

## Private configuration

Add approved credentials to `.env` for local work and to the hosting provider's server environment for deployment. Local file: `D:\AJ\Documents\ChatGPT\Ecom\.env`. Do not put keys in chat, source control, browser settings, or NEXT_PUBLIC variables.

| Platform    | Required app variables                                              | Activation setting                                                                                                          |
| ----------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Shopee      | SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY                               | Set SHOPEE_ENVIRONMENT=production when using approved live credentials; sandbox credentials must keep sandbox.              |
| Lazada      | LAZADA_APP_KEY, LAZADA_APP_SECRET                                   | LAZADA_ORDER_IMPORT_ENABLED=true only during controlled shop validation, then after successful validation for release.      |
| TikTok Shop | TIKTOK_SHOP_APP_KEY, TIKTOK_SHOP_APP_SECRET, TIKTOK_SHOP_SERVICE_ID | TIKTOK_SHOP_ORDER_IMPORT_ENABLED=true only during controlled shop validation, then after successful validation for release. |

SHOPEE_TOKEN_ENCRYPTION_KEY and MARKETPLACE_TOKEN_ENCRYPTION_KEY already exist locally. Preserve them and copy them privately to the deployed server environment. Replacing them prevents decryption of existing connections. Neither value is reported by the setup checker.

The app-wide credentials identify this application. Each user separately selects Connect for their marketplace and grants access to their own shop; the app does not ask users for seller passwords or app-wide secrets.

## Check and activate one platform at a time

1. Obtain app approval and seller/order-read access for the intended PH integration. Use the appropriate seller app in the provider portal.
2. Register the matching callback above and enter the required server variables privately.
3. Run `npm run marketplaces:check -- shopee`, `-- lazada`, or `-- tiktok`. With no argument, all three are checked. Exit 1 means missing/invalid production setup; 0 means local app configuration passes, not that the provider has approved or tested it.
4. Configure the same environment on the app host and restart. Auth/Realtime origins must match the deployed site; this checklist does not deploy or modify remote settings.
5. For Lazada/TikTok controlled validation, enable only that provider's order-import flag and restart. Leave MARKETPLACE_SYNC_ENABLED=false.
6. Sign in to the notebook as the test user. Open Orders > Marketplace connections and connect that user's consenting shop. Complete seller authorization in the marketplace, returning to the notebook callback.
7. Fetch a small date range and compare quantities, prices, dates and statuses against the seller export. Review the preview before saving. Reimport to verify duplicate protection and confirm inventory stock remains unchanged by history imports.
8. Test refresh/reconnect/disconnect, another user's isolation and revoked access. Disable the fetch flag if validation fails. Follow marketplace-setup.md for the full contract/reconciliation checks.

## Official references

- Shopee Open Platform: https://open.shopee.com/ (portal access may require login).
- Lazada seller authorization: https://open.lazada.com/apps/doc/doc?docId=108260&nodeId=10533
- TikTok Shop app onboarding: https://partner.tiktokshop.com/docv2/page/create-your-app
- Official TikTok Shop server sample: https://github.com/tiktok/ttspc-server-sample

TikTok Shop credentials are for the Shop integration; TikTok Login Kit credentials are a different integration. Consult the provider's current portal for the applicable app type, review requirements and approved permissions. No registrations, approvals, seller connections, hosted scheduler or webhooks were activated by this preparation.
