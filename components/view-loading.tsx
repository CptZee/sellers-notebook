export function ViewLoading({ error, retry }: { error?: string; retry: () => void }) {
    return (
        <p
            className="empty"
            role="status"
        >
            {error || "Opening saved records…"}
            {error && (
                <button
                    className="text-button"
                    onClick={retry}
                >
                    Retry records
                </button>
            )}
        </p>
    );
}
