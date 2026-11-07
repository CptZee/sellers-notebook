"use client";
import { useEffect, useState } from "react";
import { MousePointer2, Pencil } from "lucide-react";
import { usePathname } from "next/navigation";

export function CursorToggle({ inline = false }: { inline?: boolean }) {
    const pathname = usePathname();
    const [enabled, setEnabled] = useState(true);
    useEffect(() => {
        const sync = () => setEnabled(document.documentElement.dataset.cursor !== "off");
        const storage = (event: StorageEvent) => {
            if (event.key === "notebook-cursor" || event.key === null) {
                try {
                    document.documentElement.dataset.cursor =
                        localStorage.getItem("notebook-cursor") === "off" ? "off" : "on";
                } catch {}
                sync();
            }
        };
        sync();
        window.addEventListener("storage", storage);
        window.addEventListener("notebook-cursor-change", sync);
        return () => {
            window.removeEventListener("storage", storage);
            window.removeEventListener("notebook-cursor-change", sync);
        };
    }, []);
    function toggle() {
        const next = !enabled;
        setEnabled(next);
        document.documentElement.dataset.cursor = next ? "on" : "off";
        window.dispatchEvent(new Event("notebook-cursor-change"));
        try {
            localStorage.setItem("notebook-cursor", next ? "on" : "off");
        } catch {}
    }
    if (!inline && (pathname?.startsWith("/notebook") || pathname?.startsWith("/account")))
        return null;
    return (
        <button
            type="button"
            className={`cursor-toggle${inline ? " cursor-toggle-inline" : ""}`}
            aria-label="Pencil cursor"
            aria-pressed={enabled}
            onClick={toggle}
            title={enabled ? "Use the standard cursor" : "Use the pencil cursor"}
        >
            {enabled ? (
                <Pencil
                    size={15}
                    aria-hidden="true"
                />
            ) : (
                <MousePointer2
                    size={15}
                    aria-hidden="true"
                />
            )}
            <span>Pencil cursor: {enabled ? "on" : "off"}</span>
        </button>
    );
}
