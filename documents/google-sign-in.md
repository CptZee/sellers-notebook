# Google sign-in through Neon Auth

The sign-in and sign-up pages use the existing `@neon/auth` client with `signIn.social({ provider: "google" })`. The app landing URL is the current origin plus `/notebook`. Authentication cookies, the provider exchange and account handling remain managed by Neon; no Google secret is sent to the browser or stored by this app.

The currently configured Neon branch already has Google's **shared** provider enabled. It can be used for development and testing without creating another credential. Shared credentials show Neon's branding and are not the production setup for this service.

## Production configuration

1. Create your own Web application OAuth client in Google Cloud. Register `{NEON_AUTH_BASE_URL}/callback/google` as its authorized redirect URI, using the exact Auth base URL for the intended Neon branch. This is the provider callback, not `/notebook` on your website.
2. Add your deployed app origin to Neon Auth's trusted domains. The app callback URL must belong to a trusted origin.
3. In Neon Console → the intended branch → Settings → Auth → OAuth providers, configure Google with your own Client ID and Client Secret. Keep those credentials in Neon, not application `.env`, source control, chat or browser settings.
4. Complete the consent-screen and provider requirements for the intended audience, then test actual consent, return to `/notebook`, session restoration, sign-out and the behavior of an existing email/password account.

The app button and provider handoff can be verified without completing a Google login. That does not prove real consent or account linking; complete those checks yourself with a test account before launch. Cancelling or failing OAuth returns an actionable sign-in message, and email/password access remains available.

See [Neon's OAuth guide](https://neon.com/docs/auth/guides/setup-oauth) for provider configuration and the distinction between the Google callback and the app landing URL.
