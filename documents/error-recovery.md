# Runtime error recovery

`app/error.tsx` catches unexpected route rendering failures. `app/global-error.tsx` provides its own document and styling for root-layout failures. Both use `components/error-recovery.tsx`.

The screen offers Try again (the installed Next.js `retry` API) and Back to home. Focus moves to the recovery heading. It warns that unsaved changes may need to be entered again and asks users to check saved records before repeating a write. It does not automatically retry mutations or promise that an interrupted entry was saved.

Raw error messages, stack traces, URLs and payloads are not rendered or sent to a new telemetry service. A bounded numeric/hex error digest, when available, can be shown as an error reference for matching Next server logs. Existing Next/host logging still needs an appropriate production access and retention policy.

The root fallback supplies standalone styling and restores the stored light/dark preference without depending on the failed layout or external fonts.

## Verification

Run `npm run verify:error-recovery` while port 3002 is available. It builds a disposable production Next app under `.next/error-recovery-fixture`, copying the actual fallback source. Its routes deliberately throw server, client and root-layout errors with fixture-only private messages. The browser verifies that raw messages do not appear, retry works, the home action works, heading focus/keyboard actions are usable, dark preference survives root failure, and layouts fit 320/390/768px widths. No Auth/database access or real account fixtures are used. The browser and fixture server close in cleanup. Results: error-recovery-e2e.json.

This is not an external monitoring deployment. The host still needs server log retention, alert destinations, uptime/dependency monitoring and a reviewed incident/recovery procedure. Expected API errors and failed saves continue using their existing retry/draft flows; Next render boundaries do not catch every event-handler or background task failure.
