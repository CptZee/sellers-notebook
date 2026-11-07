# Self-service account deletion

Status: implemented, **disabled pending live acceptance**. ACCOUNT_DELETION_ENABLED=false remains in the local environment. No existing user account was deleted. Production deployment remains owner-managed.

## User flow

Account settings > Notebook > Delete my account opens /account/delete. The user enters the current password, types DELETE, acknowledges permanent removal and confirms in a modal. Failed password checks and Cancel start no cleanup. Backups and needed files should be saved first.

After verification, a private receipt is saved in sessionStorage for that tab. New account activity is blocked. The page removes files in small resumable batches, then notebook/connection/sync records, then sign-in access. A paused step can be retried; reload of the same tab resumes it. Keep the tab open until completion. If the receipt is lost while identity still exists, visit /account/delete and confirm again to rotate the receipt and resume.

Uploads include the owner paths notebooks/{userId}/ and profiles/{userId}/, including orphan objects not represented by attachment metadata. Other users' prefixes are rejected. Stored marketplace tokens, OAuth states and staged sync data are deleted. This removes app-side connections; it does not delete marketplace accounts/orders or promise to revoke remote grants. Revoke app access in the seller portals separately if required.

The server requires Node.js 22 or newer for the native WebSocket connection used by lifecycle locks.

## Storage and concurrency

Migrations 0008/0009 add the typed deletion job and write barriers. A shared owner advisory lock serializes uploads, SQL writes and preparation. Once prepared, triggers reject later inserts/updates for that owner. Common API session checks reject pending/deleted owners even when an Auth cookie remains cached. The verified cleanup transaction has an owner-scoped internal bypass for FK-driven changes.

Each step is idempotent and progress persists independently of the notebook. Files and identity are external services, so the entire operation is not one transaction. Service failures pause remaining work; already removed data is not rolled back. A storage batch has a 20-second request budget and SQL/management operations have bounded timeouts.

The completion receipt retains only opaque owner/job IDs, a resume-token hash, phase and timestamps. It contains no password, email, name, shop token, file contents or notebook document. This minimal barrier prevents old sessions from recreating records and supports interrupted cleanup. Its eventual retention/purge policy, provider backups, branch copies and downloaded user backups remain separate owner release decisions. Deletion does not erase historical backup copies automatically.

## Identity configuration

Managed Auth password verification was confirmed to accept the correct password and reject the wrong password. The existing self-delete endpoint returned 404, so identity removal uses the documented branch user-deletion management API after file/record cleanup.

A dedicated project-scoped key named sellers-notebook-account-deletion was created and stored in ignored .env. It was not displayed. Server-only variables:

- NEON_ACCOUNT_DELETION_API_KEY
- NEON_ACCOUNT_DELETION_PROJECT_ID
- NEON_ACCOUNT_DELETION_BRANCH_ID
- ACCOUNT_DELETION_ENABLED (false until live acceptance passes)

The management Auth target must match NEON_AUTH_BASE_URL before preparation/identity removal. Never expose the management credential via NEXT_PUBLIC variables or send it to the browser. Copy it privately to the host when deploying. Disabling new requests does not disable valid existing cleanup receipts.

Official management API reference: https://neon.com/docs/auth/guides/manage-auth-api and https://neon.com/docs/cli/neon-auth (branch user deletion). No auth schema rows are manually deleted by this feature.

## Verification and blocker

Passed: production build, TypeScript, Drizzle metadata check and 194 unit tests. The isolated relational suite verifies in-flight upload serialization, write fencing, other-owner isolation, receipt rotation, storage/identity failure retries, full relational cleanup and terminal idempotence. Actual route-handler tests use stubbed dependencies to verify session/origin/password/confirmation/receipt safeguards. Browser tests with simulated API responses verify mobile forms, confirmation, Cancel, wrong-password draft retention and resume after reload.

Live acceptance failed before deletion testing: disposable signup requests timed out connecting to the public Neon Auth endpoint. Direct Auth requests, all resolved Auth addresses, management requests and a project-scoped CLI connectivity check also timed out from this machine. This is an observed connectivity blocker, not a claim about a global provider outage. No successful live identity-deletion proof is claimed.

Commands:

- npm run verify:account-deletion-branch (temporary isolated .env.migration-test branch; current branch expires 2026-11-08)
- npm run verify:account-deletion-api (stubbed identity/worker, no live mutations)
- npm run verify:account-deletion-ui (running app, simulated responses, no live mutations)
- npm run verify:account-deletion-worker (new management-created disposable identity, real database/storage/identity cleanup)
- npm run verify:account-deletion (owns a temporary server on port 3002 with the flag enabled only in that process; normal .env remains unchanged)

When connectivity recovers, rerun the real worker and full live suite. Verify cleanup, identity removal, old-password rejection, other-account preservation and uploads before enabling ACCOUNT_DELETION_ENABLED=true in the normal environment. Tests must use only identities they create; never supply an existing account ID as a fixture. Review account-deletion-e2e.json, account-deletion-api.json and account-deletion-ui.json for their respective test scopes.
