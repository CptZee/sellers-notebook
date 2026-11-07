# Free-edition file storage

This edition has no application-enforced total storage quota per account. Usage is measured for transparency and cleanup, without paid tiers or upgrade actions. Capacity and cost still depend on the deployment's storage provider.

Individual attachments retain their 5 MB safety limit and WebP profile pictures their 1 MB limit. Owner-scoped upload reservations, private file access, failure cleanup and abandoned-upload recovery remain active. Business records keep their existing validation limits.

`GET /api/account/storage` returns attachment, profile, unfinished-upload and total byte counts. Its POST accepts only the recovery action. It never returns a subscription or storage allowance.

Run `npm run verify:storage-branch` with an ignored `.env.storage-test` pointing at a separate migrated free-edition database. The harness uses real SQL and route handlers with fake identity/object storage. It verifies uploads and profile changes above 40 GB, concurrent uploads, per-file safety, ownership and cleanup. `npm run verify:storage` checks the real signed-in usage display with a disposable account.

Use a separate database/deployment for each edition. Do not mix this branch's migrations with the subscription edition's history. The installer and actual environment values are local to the installation and are not switched automatically by Git.
