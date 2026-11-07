"use client";
import { LegalLinks } from "./legal-links";

import { useState } from "react";
import { NotebookPen, ArrowRight, ArrowLeft } from "lucide-react";
import { authClient } from "../lib/auth/client";

export function AuthForm({
    path,
    resetToken = "",
    resetLinkError = false,
    socialError = false,
}: {
    path: string;
    resetToken?: string;
    resetLinkError?: boolean;
    socialError?: boolean;
}) {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(
            socialError
                ? "Google sign-in could not be completed. Please try again or sign in with email."
                : "",
        ),
        [message, setMessage] = useState(""),
        [email, setEmail] = useState(""),
        [resendAt, setResendAt] = useState(0),
        [complete, setComplete] = useState(false);
    const signup = path === "sign-up",
        forgot = path === "forgot-password",
        reset = path === "reset-password",
        verify = path === "verify-email";
    async function signInWithGoogle() {
        if (busy) return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const result = await authClient.signIn.social({
                provider: "google",
                callbackURL: location.origin + "/notebook",
                errorCallbackURL: location.origin + "/auth/sign-in?oauth_error=google",
            });
            if (result.error)
                throw Error("Google sign-in is unavailable. Please retry or use email.");
            if (result.data?.redirect === false) {
                const session = await authClient.getSession();
                if (session.data?.user) location.assign("/notebook");
            }
        } catch {
            setError(
                "Google sign-in could not be completed. Please try again or sign in with email.",
            );
        } finally {
            setBusy(false);
        }
    }
    async function sendCode() {
        if (busy) return;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Enter your email address first.");
            return;
        }
        if (Date.now() < resendAt) {
            setError("Wait a minute before requesting another code.");
            return;
        }
        setBusy(true);
        setError("");
        setMessage("");
        try {
            const result = await authClient.emailOtp.sendVerificationOtp({
                email,
                type: "email-verification",
            });
            if (result.error) throw new Error(result.error.message || "Could not send the code.");
            setResendAt(Date.now() + 60000);
            setMessage(
                "If your account needs verification, a code is on its way. Check your inbox and spam folder.",
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not send the code.");
        } finally {
            setBusy(false);
        }
    }
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || complete) return;
        setBusy(true);
        setError("");
        setMessage("");
        const form = new FormData(event.currentTarget),
            email = String(form.get("email") || ""),
            password = String(form.get("password") || "");
        try {
            if ((signup || reset) && password !== String(form.get("confirmPassword") || ""))
                throw new Error("Passwords do not match. Please enter the same password twice.");
            if (forgot) {
                const result = await authClient.requestPasswordReset({
                    email,
                    redirectTo: location.origin + "/auth/reset-password",
                });
                if (result.error)
                    throw new Error(result.error.message || "Could not request a reset.");
                setMessage("If this email has an account, a reset link is on its way.");
            } else if (reset) {
                const token = resetToken;
                if (!token)
                    throw new Error("This reset link is missing its token. Request a new link.");
                const result = await authClient.resetPassword({ newPassword: password, token });
                if (result.error)
                    throw new Error(result.error.message || "Could not reset your password.");
                setComplete(true);
                setMessage("Password updated. Sign in with your new password.");
                history.replaceState(null, "", "/auth/reset-password");
            } else if (verify) {
                const result = await authClient.emailOtp.verifyEmail({
                    email,
                    otp: String(form.get("code") || ""),
                });
                if (result.error)
                    throw new Error(result.error.message || "That code could not be verified.");
                setComplete(true);
                setMessage("Email verified. You can sign in to your notebook.");
            } else {
                const result = signup
                    ? await authClient.signUp.email({
                          name: String(form.get("name")),
                          email,
                          password,
                          callbackURL: location.origin + "/notebook",
                      })
                    : await authClient.signIn.email({ email, password });
                if (result.error)
                    throw new Error(
                        result.error.message ||
                            (signup
                                ? "Could not create your account."
                                : "Invalid email or password."),
                    );
                const session = await authClient.getSession();
                if (session.data?.user) location.assign("/notebook");
                else
                    setMessage(
                        "Your account was created. Check your email for a verification code, then verify your email.",
                    );
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <main className="auth-page">
            <a
                className="auth-back"
                href="/"
            >
                <ArrowLeft size={15} />
                Back to home
            </a>
            <section className="card auth-card">
                <span className="account-book">
                    <NotebookPen size={32} />
                </span>
                <div className="eyebrow">SELLER’S NOTEBOOK</div>
                <h1>
                    {signup
                        ? "A fresh page for your business."
                        : forgot
                          ? "Let’s find your way back."
                          : reset
                            ? "A fresh start."
                            : verify
                              ? "One last little step."
                              : "Welcome back to your notebook."}
                </h1>
                <p>
                    {signup
                        ? "Create your account and keep your business beautifully organized."
                        : forgot
                          ? "Enter your email and we’ll send a reset link."
                          : reset
                            ? "Choose a new password for your notebook."
                            : verify
                              ? "Enter the verification code from your email."
                              : "Your products, sales, and ideas, right where you left them."}
                </p>
                {(path === "sign-in" || signup) && (
                    <div className="auth-social">
                        <button
                            type="button"
                            className="button secondary google-sign-in"
                            disabled={busy}
                            onClick={() => void signInWithGoogle()}
                        >
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                            >
                                <path
                                    fill="currentColor"
                                    d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36ZM12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22ZM6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59ZM12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
                                />
                            </svg>
                            Continue with Google
                        </button>
                        <span className="auth-social-divider">or use your email</span>
                    </div>
                )}
                {reset && (!resetToken || resetLinkError) ? (
                    <div className="auth-recovery-state">
                        <p
                            className="auth-error"
                            role="alert"
                        >
                            This reset link is missing or invalid. Request a fresh link to reset
                            your password.
                        </p>
                        <a
                            className="button primary"
                            href="/auth/forgot-password"
                        >
                            Request a new reset link
                        </a>
                    </div>
                ) : complete ? (
                    <div className="auth-recovery-state">
                        <p
                            className="auth-message"
                            role="status"
                        >
                            {message}
                        </p>
                        <a
                            className="button primary"
                            href="/auth/sign-in"
                        >
                            Back to sign in
                        </a>
                    </div>
                ) : (
                    <form onSubmit={submit}>
                        {signup && (
                            <label className="field">
                                <span>Your name</span>
                                <input
                                    name="name"
                                    autoComplete="name"
                                    required
                                    maxLength={100}
                                />
                            </label>
                        )}
                        {!reset && (
                            <label className="field">
                                <span>Email address</span>
                                <input
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </label>
                        )}
                        {!forgot && !verify && (
                            <label className="field">
                                <span>Password</span>
                                <input
                                    name="password"
                                    type="password"
                                    autoComplete={
                                        signup || reset ? "new-password" : "current-password"
                                    }
                                    required
                                    minLength={8}
                                    maxLength={128}
                                />
                            </label>
                        )}
                        {(signup || reset) && (
                            <label className="field">
                                <span>Confirm password</span>
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    minLength={8}
                                    maxLength={128}
                                />
                            </label>
                        )}
                        {verify && (
                            <>
                                <label className="field">
                                    <span>Verification code</span>
                                    <input
                                        name="code"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        required
                                        pattern="[0-9]{6}"
                                        maxLength={6}
                                    />
                                </label>
                                <button
                                    className="text-button"
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void sendCode()}
                                >
                                    Send or resend code
                                </button>
                            </>
                        )}
                        {error && (
                            <p
                                className="auth-error"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}
                        {message && (
                            <p
                                className="auth-message"
                                role="status"
                            >
                                {message}
                            </p>
                        )}
                        <button
                            className="button primary"
                            type="submit"
                            disabled={busy}
                        >
                            {busy
                                ? "One moment…"
                                : signup
                                  ? "Create account"
                                  : forgot
                                    ? "Send reset link"
                                    : reset
                                      ? "Save new password"
                                      : verify
                                        ? "Verify email"
                                        : "Sign in"}
                            <ArrowRight size={16} />
                        </button>
                    </form>
                )}
                <div className="auth-links">
                    {signup ? (
                        <a href="/auth/sign-in">Already have a notebook? Sign in</a>
                    ) : (
                        <a href="/auth/sign-up">New here? Create your notebook</a>
                    )}
                    {!signup && !complete && (forgot || reset || verify) && (
                        <a href="/auth/sign-in">Back to sign in</a>
                    )}
                    {!forgot && !signup && !verify && !complete && (
                        <a href="/auth/forgot-password">
                            {reset ? "Request a new reset link" : "Forgot your password?"}
                        </a>
                    )}
                    {!verify && <a href="/auth/verify-email">Verify your email</a>}
                </div>
                <p className="auth-footnote">
                    {signup
                        ? "By creating an account, you agree to the Terms & Conditions. Our Privacy Policy explains how information is handled."
                        : "Your own account. Your own notebook."}
                </p>
                <LegalLinks />
            </section>
        </main>
    );
}
