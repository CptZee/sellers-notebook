"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const sync = () => setDark(document.documentElement.dataset.theme === "dark");
        sync();
        window.addEventListener("notebook-theme-change", sync);
        return () => window.removeEventListener("notebook-theme-change", sync);
    }, []);
    function change() {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? "dark" : "light";
        window.dispatchEvent(new Event("notebook-theme-change"));
        try {
            localStorage.setItem("notebook-theme", next ? "dark" : "light");
        } catch {}
    }
    return (
        <button
            type="button"
            className={compact ? "theme-switch theme-switch-compact" : "theme-switch"}
            onClick={change}
            aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
            title={`Switch to ${dark ? "light" : "dark"} theme`}
        >
            <span aria-hidden="true">{dark ? <Sun size={16} /> : <Moon size={16} />}</span>
            {!compact && (dark ? "Light paper" : "Dark paper")}
        </button>
    );
}
