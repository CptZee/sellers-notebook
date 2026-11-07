"use client";
import { ErrorRecovery } from "../components/error-recovery";
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
    return (
        <html lang="en">
            <body style={{ margin: 0 }}>
                <title>Reopen your notebook — Seller’s Notebook</title>
                <ErrorRecovery
                    error={error}
                    retry={retry}
                />
            </body>
        </html>
    );
}
