# Application backup recovery

Open Account settings > Notebook > Backup & restore.

1. Choose the backup to restore and review its counts, including purchase payments, supplier goods returns (active and voided), and supplier cash refunds.
2. Download the current notebook checkpoint and keep the file. Confirm that replacement is intended, then approve the confirmation modal.
3. Wait for Saved to your account before closing the app.
4. To undo, choose the previous checkpoint, download another current checkpoint, and restore the previous one.

Backups contain notebook records, quantities, notes and branding. They exclude uploaded files, profile photos, sign-in credentials, marketplace tokens, staged sync batches and connection settings. Those resources need their own retention/recovery plan. Product links in stored files refer to the restored IDs.

## Automated evidence

`npm run verify:backup-recovery` creates a disposable account and seeds the large sample plus a paid physical supplier return and cash refund. It downloads an actual server backup, replaces every collection with an empty notebook, and restores the checkpoint. Fingerprints reconcile every normalized field and array order. It verifies stale-revision rejection, no-op identical restores, and rejection of broken stock-audit links without partial writes. Browser checks cover corrupt files, the checkpoint gate, Cancel, approved replacement, detailed return counts, phone/tablet widths and anonymous access rejection.

Fixtures are removed and the disposable Auth account is deleted in cleanup. Results are recorded in backup-recovery-e2e.json. Do not run the drill with a personal account or modify it to target an existing notebook.

## Release work still pending

This proves application JSON backup/restore against the current relational schema. It does not prove Neon point-in-time recovery, recovery of object storage, host redeployment, cross-region availability, monitoring or a retention/account-deletion policy. Configure those with the selected deployment and owner requirements, then rehearse recovery in an isolated environment.
