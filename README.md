# Seller’s Notebook

[Visit Seller’s Notebook](https://ntbk.ajmission.dev/)

The free edition of a private business notebook for small sellers, built with Next.js, React, TypeScript and Neon. Keep inventory, orders, expenses, suppliers, purchases and pricing together, with private attachments and live synchronization across signed-in devices.

## Install and set up

Use Node.js 22 or newer and npm. Provision the Neon services for your installation first: Postgres, Managed Auth, Realtime and a private `assets` bucket. Their configuration is declared in `neon.ts`; the installer accepts the credentials supplied by those services and does not provision them for you.

```sh
npm install
npm run setup
```

Open the complete private link printed in the installation machine’s terminal. The wizard groups the settings into database/sign-in, storage, live sync, payments, marketplaces and operations. It preserves existing values when fields are left blank, supports optional empty fields, and can generate missing app-owned secrets without displaying them.

Saving writes `.env` and permanently closes setup for that installation using `.setup/completed.json`. Keep both private and on persistent storage. There is no public setup route or browser reset option. `npm run dev` also starts the wizard automatically if it has not been completed.

For a fresh database, apply the migrations before opening the notebook:

```sh
npm run db:migrate
npm run dev
```

The local app runs at `http://127.0.0.1:3000`. The public homepage is `/`; signed-in users work in `/notebook`. Before applying new migrations to an existing production database, test them on an isolated Neon branch.

See [first-launch setup](documents/first-launch.md) for access protection, configuration ownership and hosting details. `.env.example` remains the value-free configuration reference; do not copy its blank values over an existing installation.

## Production deployment

Use a host that supports a full Next.js server. Configure private environment values and the public origin in the host, Neon Auth, Realtime and any enabled provider callbacks before deployment.

```sh
npm run build
npm run start
```

Build and startup check required configuration. The development preview uses `.next-dev`, separate from the `.next` production build. Stop a running production server before rebuilding its output.

The setup wizard runs locally on the installation machine. For serverless or read-only hosting, transfer the settings into the hosting provider’s private environment configuration; the wizard cannot update that provider’s secret manager. Never expose secrets with a `NEXT_PUBLIC_` prefix. Keep encryption keys stable so existing marketplace connections remain readable.

For **Vercel**, run setup locally, add the values from `.env` under Project Settings → Environment Variables, then deploy or redeploy. Vercel supplies these values to the build and server functions; it does not run the local file-writing wizard. See [the Vercel setup steps](documents/first-launch.md#vercel).

## Notebook features

| Page               | What it keeps                                                                   |
| ------------------ | ------------------------------------------------------------------------------- |
| Overview           | Revenue, recorded costs, estimated profit and channel reports                   |
| Inventory          | Products, stock levels, restock planning, stock adjustments and private files   |
| Orders             | Manual sales, marketplace CSV imports, order status and customer refund records |
| Expenses           | Business overhead, categories and channel-specific costs                        |
| Suppliers          | Contacts, purchase orders, partial deliveries, payments, returns and statements |
| Pricing calculator | Selling-price estimates using your costs, fees and target margin                |

Account settings include profile and branding controls, marketplace connections, storage usage, backup/restore and account actions. The optional guided tour includes fictional practice entries that are not saved to the database. Light/dark themes, a switchable pencil cursor, responsive layouts and CSV exports are included.

Sign-in supports email/password and Google through Neon Auth. Google's shared provider is configured for development; use your own Google OAuth credentials in Neon before production. See [Google sign-in](documents/google-sign-in.md).

Business records use owner-scoped relational tables, revision checks and transactional writes. Private uploads are stored separately; exports and backups do not automatically include attachment files. Financial records are bookkeeping entries, not transfers of money or tax filings.

## Free access and file storage

All six notebook pages are free to use. This edition has no application-enforced total storage quota, paid plans, upgrade buttons or payment checkout. Usage remains visible in Account settings and product files, and unfinished uploads can still be recovered safely.

Individual attachments retain their 5 MB safety limit, and profile pictures their 1 MB limit. Business records have separate validation limits. Storage-provider capacity and hosting costs still apply; the app does not promise unlimited infrastructure.

See [file storage and recovery](documents/storage.md). Use this edition’s migration history with its own deployment/database; do not mix it with another edition’s schema. Git does not switch ignored environment files when you change branches.

See [the edition workflow](documents/edition-workflow.md) before maintaining or publishing multiple editions.

## Optional services and release checks

The setup wizard collects configuration; it does not establish provider approval, validate remote credentials or enable every integration automatically.

- Obtain approved marketplace app credentials and test seller authorization, scopes, callbacks, token refresh and order previews before enabling live fetching. CSV imports remain independent of live connections.
- Deploy and test a protected scheduler before enabling automated marketplace fetching. Prepared batches still require review before import; provider webhook intake is separate work.
- Complete actual email-verification and password-reset flows with a disposable account. Decide verification policy and sender configuration before release.
- Complete live account-deletion acceptance before enabling self-service deletion. Configure backup/file recovery, retention, monitoring and alert delivery for the production host.
- Check real seller CSV formats, keyboard/screen-reader use, mobile layouts and the financial assumptions used in estimates.

Use the [manual release checklist](documents/review-checklist.md) for acceptance. An automated test or a configured credential does not mark an unperformed manual check complete.

## Development commands

| Command                                   | Purpose                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `npm run setup`                           | Run the private installer once                           |
| `npm run dev`                             | Start the local preview, running initial setup if needed |
| `npm run build` / `npm run start`         | Build and serve the production app                       |
| `npm test`                                | Run unit and isolated installer integration tests        |
| `npm run typecheck`                       | Check TypeScript                                         |
| `npm run db:check`                        | Check migration metadata                                 |
| `npm run format` / `npm run format:check` | Format supported files or check formatting               |
| `npm run format:css` / `npm run lint:css` | Format and validate stylesheets                          |
| `npm run verify:setup`                    | Test the wizard in an isolated fake installation         |
| `npm run marketplaces:check`              | Inspect marketplace readiness without exposing secrets   |

Prettier and EditorConfig use four spaces for code, double quotes, semicolons and a 100-column wrapping target. JSON and Markdown use two spaces. CSS keeps spacing between rule blocks and its existing cascade order. Python and SQL are outside Prettier’s supported formatting scope.

Additional `verify:*` commands are listed in `package.json`. Some create disposable accounts or require an isolated database branch, a running app, browser dependencies or provider configuration; read their guide before running them. Generated JSON reports, screenshots and logs remain local and ignored by Git. Keep reusable test scripts and written acceptance guides in source control.

## Operational guides

| Topic                                           | Guide                                                         |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Initial configuration and hosting               | [First launch](documents/first-launch.md)                     |
| Production marketplace callbacks and activation | [Marketplace activation](documents/marketplace-activation.md) |
| Shopee authorization, fetching and CSV import   | [Shopee](documents/shopee-connection-setup.md)                |
| Lazada/TikTok fetching and token refresh        | [Marketplace preparation](documents/marketplace-setup.md)     |
| Scheduled fetching and review queues            | [Marketplace sync](documents/marketplace-sync.md)             |
| Verification codes and password resets          | [Account recovery](documents/account-recovery.md)             |
| Account deletion                                | [Deletion](documents/account-deletion.md)                     |
| Record backup and restore                       | [Backup recovery](documents/backup-recovery.md)               |
| Uptime and readiness checks                     | [Monitoring](documents/monitoring.md)                         |
| Runtime failure handling                        | [Error recovery](documents/error-recovery.md)                 |
| Relational schema and migration behavior        | [Database schema](documents/relational-schema.md)             |
| Supplier goods returns                          | [Supplier returns](documents/supplier-returns.md)             |
| Focus and keyboard acceptance                   | [Keyboard checks](documents/keyboard.md)                      |

## Promotional videos

The homepage uses the silent 15-second loop in `public/media/`. Promotional source code, approved storyboards, narration/music information and rebuild instructions are maintained in [the video library](documents/promotional-videos.md). Its generated exports are ignored separately from the public website assets needed for deployment.

## Support and policies

Public policies are served at `/terms` and `/privacy`. Support: [ajmission28@gmail.com](mailto:ajmission28@gmail.com).
