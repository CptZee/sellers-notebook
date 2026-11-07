"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
const activeModals: HTMLElement[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow = "",
    originalShellInert = false,
    lockedShell: HTMLElement | null = null;
function syncModalLocks() {
    const top = activeModals.at(-1);
    if (top) {
        if (lockedShell) lockedShell.inert = true;
        document.body.style.overflow = "hidden";
        for (const element of document.querySelectorAll<HTMLElement>(".modal-backdrop")) {
            if (!originalInert.has(element)) originalInert.set(element, element.inert);
            element.inert = element !== top;
        }
    } else {
        if (lockedShell?.isConnected) lockedShell.inert = originalShellInert;
        document.body.style.overflow = originalOverflow;
        originalInert.forEach((value, element) => {
            if (element.isConnected) element.inert = value;
        });
        originalInert.clear();
        lockedShell = null;
    }
}
function focusableControls(panel: HTMLElement) {
    return Array.from(
        panel.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,summary,a[href],[tabindex]",
        ),
    ).filter(
        (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            !element.closest("[inert]") &&
            element.getClientRects().length > 0,
    );
}
export function EntryModal({
    title,
    description,
    className = "",
    closeLabel = "Close dialog",
    onClose,
    children,
}: {
    title: string;
    description: string;
    className?: string;
    closeLabel?: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const heading = useId(),
        panel = useRef<HTMLElement>(null),
        close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null,
            backdrop = panel.current?.closest<HTMLElement>(".modal-backdrop");
        if (!backdrop) return;
        if (!activeModals.length) {
            lockedShell = document.querySelector<HTMLElement>(".shell,[data-modal-root]");
            originalShellInert = lockedShell?.inert ?? false;
            originalOverflow = document.body.style.overflow;
        }
        activeModals.push(backdrop);
        syncModalLocks();
        const controls = panel.current ? focusableControls(panel.current) : [];
        (
            controls.find((element) => element.matches("input,select,textarea")) || controls[0]
        )?.focus();
        return () => {
            const index = activeModals.indexOf(backdrop);
            if (index >= 0) activeModals.splice(index, 1);
            syncModalLocks();
            queueMicrotask(() => {
                const top = activeModals.at(-1);
                const usable =
                    previous?.isConnected &&
                    previous !== document.body &&
                    previous !== document.documentElement &&
                    !previous.matches(":disabled") &&
                    !previous.closest("[inert]") &&
                    (!top || top.contains(previous));
                const target = usable
                    ? previous
                    : top?.querySelector<HTMLElement>(
                          "input:not(:disabled),select:not(:disabled),button:not(:disabled)",
                      ) || document.querySelector<HTMLElement>(".quick-create-trigger");
                target?.focus({ preventScroll: true });
            });
        };
    }, []);
    return createPortal(
        <div
            className="modal-backdrop entry-modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) close.current();
            }}
        >
            <section
                ref={panel}
                className={`modal entry-modal ${className}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={heading}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        close.current();
                    }
                    if (event.key === "Tab") {
                        const controls = focusableControls(event.currentTarget);
                        const first = controls[0],
                            last = controls.at(-1);
                        if (!first) {
                            event.preventDefault();
                            return;
                        }
                        if (
                            event.shiftKey &&
                            (document.activeElement === first ||
                                !controls.includes(document.activeElement as HTMLElement))
                        ) {
                            event.preventDefault();
                            last?.focus();
                        } else if (!event.shiftKey && document.activeElement === last) {
                            event.preventDefault();
                            first?.focus();
                        }
                    }
                }}
            >
                <div className="card-header">
                    <div>
                        <h2 id={heading}>{title}</h2>
                        <p>{description}</p>
                    </div>
                    <button
                        type="button"
                        className="icon-button"
                        aria-label={closeLabel}
                        onClick={() => close.current()}
                    >
                        <X size={20} />
                    </button>
                </div>
                {children}
            </section>
        </div>,
        document.body,
    );
}
