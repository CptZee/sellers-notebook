# Private first-launch setup

Install dependencies with `npm install`, then start `npm run dev`. If setup has never been completed, the startup script pauses and prints a private, temporary installer link in that machine’s terminal. Open the complete link **on the same machine**. You can also start it explicitly with `npm run setup` before running the app.

The wizard runs separately from Next.js so it works before authentication, database and storage credentials exist. There is no setup route, menu entry or admin link on the public website. The server binds only to `127.0.0.1` on a random available port, uses an unpredictable path and a 256-bit bearer token, and rejects cross-origin writes and unexpected Host headers. The token is in the URL fragment, is removed from browser history immediately, is never written to disk, and is valid only for that running setup process. Do not share the terminal link.

## Before opening the wizard

Provision or select the intended Neon project and branch first. The app needs Postgres, Managed Auth, Realtime and the private `assets` bucket declared in `neon.ts`. Use the service dashboard or your existing Neon CLI workflow to obtain their connection settings. The wizard does not create a new project or management API credential.

Use the pooled database URL for app traffic and the matching direct URL for migrations. Configure the app origin in both Auth trusted domains and Realtime allowed origins. Local development uses `http://127.0.0.1:3000` or `http://localhost:3000`; production requires its own approved origin.

After saving the wizard, run `npm run db:migrate` for a fresh database, then `npm run dev`. Test migration changes on an isolated branch before applying them to an existing production database. The current application uses relational Postgres migrations in `db/migrations`.

## What it configures

The fields come from `.env.example`, grouped into database/sign-in, private storage, live sync, marketplaces, and operations. Required runtime fields are marked. Optional fields can stay empty, and optional integrations stay off by default.

Provision your services separately, then enter their supplied URLs and credentials. The installer does not create cloud accounts, management API keys, database branches or billable services. It validates formats and configuration dependencies, not whether credentials work with a remote provider.

Existing secrets are never returned to the browser. A configured field displays a status only; leaving it blank preserves its value. Existing comments, unknown variables, and unrelated empty placeholders in `.env` are preserved. The wizard can generate missing app-owned session/encryption/worker/readiness secrets, but never replaces an existing secret through the Generate button. Generated values are saved on the server without being returned to the page. Never rotate token-encryption keys without handling previously encrypted tokens.

Values supplied directly by the host process are shown as host-managed and cannot be overwritten by the installer. Avoid simultaneous environment-specific files such as `.env.development.local` that override `.env`; maintain such settings through their original configuration source instead. Next.js loads environment variables at startup, so restart any already-running app after saving.

Existing installations using `.env.local` are migrated to `.env` when setup or the development launcher runs, even if setup was already completed. The file contents are preserved byte-for-byte, including unknown settings and comments, and completion does not reset. If both files have different contents, the launcher stops without overwriting either one. Merge them privately into `.env` and remove `.env.local` before continuing; Next.js otherwise gives `.env.local` higher priority.

## Save once

Review the groups and acknowledge completion. A successful save atomically replaces `.env` and creates `.setup/completed.json`. The installer immediately rejects further access and shuts down; running `npm run setup` again refuses to reopen it, even after an app restart or rebuild. There is no browser reset endpoint.

Keep both `.env` and `.setup` private, backed up and on persistent storage. Both are excluded from Git. File permissions are restricted where supported by the operating system; on Windows, also protect the installation directory with the appropriate account permissions. Losing/deleting the completion marker is an operator-level action that removes the persistent lock, so do not place it in a temporary deployment directory.

A running-process lock prevents two installers on the same installation from saving concurrently. An interrupted installer can be restarted after its process exits; a completed installer stays closed. Failed validation does not save settings or complete setup.

For a fresh database, follow the project’s migration procedure before using the notebook. The wizard does not run migrations against an unverified database. Run the app’s health and acceptance checks before enabling marketplace imports, background sync, or account deletion.

## Production hosts

This is an **installation-machine tool**, not a publicly accessible hosted admin portal. On a remote server, use an SSH tunnel to the loopback port printed by the installer, or perform setup on the installation machine. Do not expose its port publicly.

For serverless/read-only hosting, run setup locally and transfer the required configuration to the deployment provider’s private environment settings. A local filesystem write cannot update a hosting provider’s secret manager. Provision the host’s secrets before building; `npm run build` checks configuration and fails if required values are missing. Already configured CI/hosting environments can build without opening an interactive wizard. Share the persistent completion state deliberately across installations if you require one completion for the entire deployment rather than one per filesystem installation.

Later configuration changes are an operator task through the original private environment/host settings, followed by a restart. They do not reopen the initial wizard.

### Vercel

Vercel supports the Next.js app and supplies project environment variables during builds and function execution. The local wizard is not a deployed Vercel setup page and cannot persist `.env` or the setup lock there.

1. Run `npm run setup` locally to prepare the private `.env` file, or use the existing file after migration.
2. In Vercel Project Settings → Environment Variables, add the required values from `.env` to the intended Production/Preview/Development environments. Keep secrets server-only; do not commit the file or prefix private values with `NEXT_PUBLIC_`.
3. Deploy or redeploy. The noninteractive build check reads Vercel's injected values, so no installer needs to run on the deployed site. Register the deployed origin with Auth, Realtime and any enabled provider callbacks separately.

Environment changes apply to new deployments, so redeploy after updating them. See [Vercel environment settings](https://vercel.com/docs/environment-variables/managing-environment-variables). Actual hosting acceptance remains a deployment check; local tests do not constitute a Vercel deployment.

## Verification

`node --test tests/first-launch.test.mjs` runs a fake installation in an isolated temporary directory. It checks unauthorized and cross-origin requests, secret redaction, required configuration, injection rejection, preservation of existing values, generated-secret round trips through Next.js, and permanent closure after restart. It never edits this installation’s `.env` or contacts providers.
