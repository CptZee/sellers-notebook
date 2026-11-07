"use client";
import { ErrorRecovery } from "../components/error-recovery";
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
    return (
        <ErrorRecovery
            error={error}
            retry={retry}
        />
    );
}
