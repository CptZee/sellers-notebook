# Health checks and monitoring handoff

Intended production origin: https://ntbk.ajmission.dev. No deployment, external monitor or alert service has been configured.

## Liveness

GET https://ntbk.ajmission.dev/api/health

A running app returns HTTP 200 with {"status":"ok"}. This endpoint does not query the database, read account data or require a session. Use it to distinguish app availability from dependency availability. Health routes bypass the Auth page middleware and use their own access rules.

## Private database readiness

GET https://ntbk.ajmission.dev/api/health/ready

Configure HEALTH_CHECK_SECRET as a separate random server secret with at least 32 characters. Store it privately in the hosting environment and the monitor's secret header configuration. Send Authorization: Bearer followed by that secret. Do not put it in a URL, NEXT_PUBLIC variable, browser code or a public monitoring dashboard. Do not reuse Auth, marketplace, encryption or sync-worker secrets.

- 200 / {"status":"ready"}: the authenticated read-only SELECT 1 probe succeeded.
- 401 / {"status":"unauthorized"}: authorization was absent or incorrect; no database query ran.
- 503 / {"status":"unavailable"}: the monitoring secret is unconfigured/too short or the database probe failed. Raw errors and configuration values are not returned.

The database request has a five-second abort timeout. Responses are no-store and vary on Authorization. Readiness is disabled until a valid secret is configured; no persistent monitoring secret was generated during development. The test uses a temporary in-memory secret.

A successful probe proves database connectivity, not application schema completeness, email delivery, marketplace approval, object-storage access, Realtime subscriptions, backup recovery or every business workflow. Keep those separate checks. Database probing can wake compute; choose the monitor frequency according to your operational needs. Avoid using private readiness as a public high-frequency ping.

## Deployment handoff

1. Configure the health secret in the server and monitor environments, then restart/redeploy the app.
2. Point a liveness monitor at /api/health. Configure the separate authorized readiness monitor if required.
3. Verify both on the deployed domain. Check that a request without the readiness header returns 401 after setup.
4. Choose alert recipients, escalation rules and log retention privately. Test alert delivery in a controlled environment; these endpoints do not send alerts themselves.
5. Keep host/database/file recovery and account/data-retention policies as separate release tasks.

## Automated verification

`npm run verify:health` expects a completed production build and free port 3002. It owns temporary app servers, checks liveness/unsupported methods, rejects missing/wrong credentials, performs one authorized real Neon SELECT 1, and restarts with invalid database and missing-secret settings to verify sanitized failures. It performs no account or business-data writes. Servers close in cleanup. Results: health-e2e.json.

Unit tests additionally prove unauthorized requests cannot invoke the injected database probe and that dependency errors do not appear in response bodies. The production build, TypeScript and all 190 unit tests pass.
