# Account recovery checks

Implemented UI behavior:

- Signup and reset both require matching password confirmation.
- Missing, duplicate or provider-rejected reset tokens show instructions for requesting another link.
- Failed resets retain the password draft and expose the provider error with a fresh-link option.
- Successful resets hide the password form and remove the token from the address bar.
- Verification validates the email and six-digit code, limits repeat resend requests for one minute after a successful request, retains failed drafts and shows explicit success.
- Forgot-password confirmation avoids claiming that a particular email exists.

`npm run verify:auth-recovery` intercepts Auth POST requests in a temporary browser. It checks request payloads, success/failure/retry states, missing/invalid links, confirmation, resend cooldown and 320/390/768px layouts. It does not send emails, change accounts or prove real email-token redemption. Results: auth-recovery-e2e.json.

## Remaining real mailbox acceptance

Use a disposable review account, not an existing working account.

1. Request a code at /auth/verify-email, then enter the code delivered to that account. Confirm success and verification state in Neon.
2. Request a password-reset link at /auth/forgot-password and open the delivered link. Enter matching new passwords; confirm success and token removal.
3. Sign out, sign in with the new password and reload. Confirm that the old password fails and notebook data is preserved.
4. Try the already-used reset link; it should fail with an actionable message. Request a fresh link if an expired code/link is encountered.

Email arrival was previously confirmed by the owner. Actual delivered-code/link completion remains pending. Mandatory verification and a custom sender have not been enabled; those require the owner's release decisions.

The existing setup uses the shared Neon email sender. Visit `/auth/verify-email` for verification-code entry and `/auth/forgot-password` to request a reset link. Do not include verification codes or reset links in issue reports. The initial-setup wizard configures service access; it does not complete these mailbox acceptance checks or configure an SMTP sender automatically.
