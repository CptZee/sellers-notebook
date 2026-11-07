"use client";
import { useEffect, useId, useRef, useState } from "react";
import Tour, { type TourStepProps, type TourStepInfo } from "@rc-component/tour";
import { placements } from "@rc-component/tour/es/placements";
import { ArrowLeft, ArrowRight, BookOpen, CircleHelp, X } from "lucide-react";
import { tourSteps } from "../lib/notebook-tour-steps";
import { TourPractice, emptyPractice, type PracticeState } from "./tour-practice";
import "./notebook-tour.css";

function TourPanel({
    step,
    index,
    onFinish,
    onClose,
    practice,
    onPractice,
    saving,
    error,
}: {
    step: TourStepProps;
    index: number;
    onFinish: () => void;
    onClose: () => void;
    practice: PracticeState;
    onPractice: (value: PracticeState) => void;
    saving: boolean;
    error: string;
}) {
    const panel = useRef<HTMLElement>(null),
        heading = useId(),
        description = useId(),
        lesson = tourSteps[index],
        needsPractice = !!lesson.exercise && !practice.results[lesson.exercise];
    useEffect(() => {
        panel.current?.scrollTo({ top: 0, behavior: "instant" });
        panel.current?.focus({ preventScroll: true });
    }, [index]);
    return (
        <section
            ref={panel}
            className="notebook-tour-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={heading}
            aria-describedby={description}
            tabIndex={-1}
            onKeyDown={(event) => {
                if (
                    event.target instanceof HTMLElement &&
                    event.target.matches("input,select,textarea") &&
                    event.key !== "Escape"
                )
                    event.stopPropagation();
                if (event.key !== "Tab") return;
                const controls = Array.from(
                        event.currentTarget.querySelectorAll<HTMLElement>(
                            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
                        ),
                    ).filter((el) => el.tabIndex >= 0),
                    first = controls[0],
                    last = controls.at(-1);
                if (
                    event.shiftKey &&
                    (document.activeElement === first || document.activeElement === panel.current)
                ) {
                    event.preventDefault();
                    last?.focus();
                } else if (
                    !event.shiftKey &&
                    (document.activeElement === last || document.activeElement === panel.current)
                ) {
                    event.preventDefault();
                    first?.focus();
                }
            }}
        >
            <div className="notebook-tour-eyebrow">
                <BookOpen size={16} />
                <span>{lesson.chapter.toUpperCase()} · GUIDED PRACTICE</span>
                <button
                    type="button"
                    className="icon-button"
                    aria-label="Close tutorial"
                    onClick={onClose}
                >
                    <X size={18} />
                </button>
            </div>
            <h2 id={heading}>{step.title}</h2>
            <p id={description}>{step.description}</p>
            {lesson.exercise && (
                <TourPractice
                    key={index}
                    kind={lesson.exercise}
                    state={practice}
                    onChange={onPractice}
                />
            )}
            <p className="tour-lesson-tip">
                <strong>Remember</strong>
                {lesson.tip}
            </p>
            <div
                className="notebook-tour-progress"
                aria-label={`Step ${index + 1} of ${tourSteps.length}`}
            >
                <span>
                    {index + 1} / {tourSteps.length}
                </span>
                <progress
                    max={tourSteps.length}
                    value={index + 1}
                    aria-label="Tutorial progress"
                />
            </div>
            {error && (
                <p
                    role="alert"
                    className="tour-save-error"
                >
                    {error}
                </p>
            )}
            {needsPractice && (
                <p className="tour-next-hint">
                    Try the practice step to continue, or skip the tour whenever you like.
                </p>
            )}
            <div className="notebook-tour-actions">
                <button
                    type="button"
                    className="text-button"
                    onClick={onClose}
                >
                    Skip tour
                </button>
                <div>
                    {index > 0 && (
                        <button
                            type="button"
                            className="button secondary"
                            disabled={saving}
                            onClick={step.onPrev}
                        >
                            <ArrowLeft size={14} />
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        className="button primary"
                        disabled={saving || needsPractice}
                        aria-busy={saving}
                        onClick={index === tourSteps.length - 1 ? onFinish : step.onNext}
                    >
                        {saving
                            ? "Saving…"
                            : index === 0
                              ? "Let’s practice"
                              : index === tourSteps.length - 1
                                ? "Finish tour"
                                : "Next"}
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </section>
    );
}

export function NotebookTour({
    ready,
    userId,
    page,
    blocked,
    onNavigate,
}: {
    ready: boolean;
    userId?: string;
    page: string;
    blocked: boolean;
    onNavigate: (page: string) => void;
}) {
    const [open, setOpen] = useState(false),
        [current, setCurrent] = useState(0),
        [checked, setChecked] = useState(false),
        [firstVisit, setFirstVisit] = useState(false),
        [saving, setSaving] = useState(false),
        [error, setError] = useState(""),
        [practice, setPractice] = useState<PracticeState>(emptyPractice);
    const [, refreshTargets] = useState(0),
        navigate = useRef(onNavigate);
    navigate.current = onNavigate;
    const opener = useRef<HTMLElement | null>(null),
        originalPage = useRef(page),
        originalScroll = useRef({ x: 0, y: 0 }),
        openRef = useRef(false),
        autoOffered = useRef(false);
    const key = `sellers-notebook-tour-v2:${userId || "sample"}`;
    useEffect(() => {
        if (!ready || !userId) return;
        const controller = new AbortController();
        void fetch("/api/account/tour", {
            cache: "no-store",
            headers: { "X-Notebook-User": userId },
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw Error();
                if (!controller.signal.aborted) {
                    setFirstVisit(!data.completed);
                    setChecked(true);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setFirstVisit(false);
                    setChecked(true);
                }
            });
        return () => controller.abort();
    }, [ready, userId]);
    function start() {
        if (!ready || blocked) return;
        opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        originalPage.current = page;
        originalScroll.current = { x: window.scrollX, y: window.scrollY };
        autoOffered.current = true;
        setError("");
        setCurrent(0);
        setPractice(emptyPractice());
        navigate.current("Overview");
        openRef.current = true;
        setOpen(true);
    }
    function close() {
        if (!openRef.current) return;
        openRef.current = false;
        autoOffered.current = true;
        try {
            localStorage.setItem(key, "dismissed");
        } catch {}
        setOpen(false);
        setPractice(emptyPractice());
        navigate.current(originalPage.current);
    }
    async function finish() {
        if (!openRef.current || saving) return;
        if (firstVisit && userId) {
            setSaving(true);
            setError("");
            try {
                const response = await fetch("/api/account/tour", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Notebook-User": userId },
                    body: JSON.stringify({ completed: true }),
                });
                const data = await response.json();
                if (!response.ok)
                    throw Error(
                        data.error || "Could not save tutorial completion. Retry or skip to leave.",
                    );
                setFirstVisit(false);
            } catch (error) {
                setError(error instanceof Error ? error.message : "Please retry or skip.");
                return;
            } finally {
                setSaving(false);
            }
        }
        close();
    }
    useEffect(() => {
        if (!checked || !firstVisit || !ready || blocked || open || autoOffered.current) return;
        try {
            if (localStorage.getItem(key)) {
                autoOffered.current = true;
                return;
            }
        } catch {}
        start();
    });
    useEffect(() => {
        if (open && (!ready || blocked)) close();
    });
    useEffect(() => {
        if (!open) return;
        const shell = document.querySelector<HTMLElement>(".shell"),
            wasInert = shell?.inert ?? false;
        if (shell) shell.inert = true;
        const containFocus = (event: FocusEvent) => {
            const panel = document.querySelector<HTMLElement>(".notebook-tour-panel");
            if (panel && event.target instanceof Node && !panel.contains(event.target))
                panel.focus({ preventScroll: true });
        };
        document.addEventListener("focusin", containFocus);
        return () => {
            document.removeEventListener("focusin", containFocus);
            if (shell) shell.inert = wasInert;
            requestAnimationFrame(() => {
                window.scrollTo({
                    left: originalScroll.current.x,
                    top: originalScroll.current.y,
                    behavior: "instant",
                });
                const target =
                    opener.current?.isConnected && !opener.current.closest("[inert]")
                        ? opener.current
                        : document.querySelector<HTMLElement>("[data-tour-replay]");
                target?.focus({ preventScroll: true });
            });
        };
    }, [open]);
    useEffect(() => {
        const selector = tourSteps[current].selector,
            content = document.querySelector(".notebook-content");
        if (!open || !selector || !content) return;
        let target = document.querySelector(selector);
        const observer = new MutationObserver(() => {
            const next = document.querySelector(selector);
            if (next !== target) {
                target = next;
                refreshTargets((value) => value + 1);
            }
        });
        observer.observe(content, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [open, current]);
    const steps: TourStepInfo[] = tourSteps.map((step) => ({
        title: step.title,
        description: step.description,
        target: step.selector
            ? () =>
                  document.querySelector<HTMLElement>(step.selector) ||
                  document.querySelector<HTMLElement>(".page-heading") ||
                  document.body
            : null,
        placement: step.selector === ".quick-create-trigger" ? "topRight" : undefined,
    }));
    const alignedPlacements = {
        center: { points: ["cc", "cc"], offset: [0, 0] },
        ...Object.fromEntries(
            Object.entries(placements).map(([name, value]) => [
                name,
                { ...value, overflow: { adjustX: 1, adjustY: 1, shiftX: true, shiftY: true } },
            ]),
        ),
    };
    function change(index: number) {
        if (saving || index < 0 || index >= tourSteps.length || Math.abs(index - current) !== 1)
            return;
        const exercise = tourSteps[current].exercise;
        if (index > current && exercise && !practice.results[exercise]) return;
        navigate.current(tourSteps[index].page);
        setCurrent(index);
        setError("");
    }
    return (
        <>
            <button
                type="button"
                className="notebook-tour-trigger"
                data-tour-replay
                disabled={!ready || blocked}
                onClick={start}
            >
                <CircleHelp size={17} />
                <span>Take a tour</span>
            </button>
            {open && (
                <Tour
                    open
                    current={current}
                    steps={steps}
                    onChange={change}
                    onClose={close}
                    mask={{ color: "rgba(31, 44, 35, 0.55)" }}
                    disabledInteraction
                    gap={{ offset: 8, radius: 8 }}
                    animated={false}
                    zIndex={1100}
                    rootClassName={`notebook-tour detailed-tour${current === 0 || tourSteps[current].exercise ? " notebook-tour-center" : ""}${tourSteps[current].selector === ".quick-create-trigger" ? " notebook-tour-top" : ""}`}
                    builtinPlacements={alignedPlacements}
                    scrollIntoViewOptions={{
                        block: "center",
                        inline: "nearest",
                        behavior: "instant",
                    }}
                    renderPanel={(step, index) => (
                        <TourPanel
                            step={step}
                            index={index}
                            practice={practice}
                            onPractice={setPractice}
                            saving={saving}
                            error={error}
                            onClose={close}
                            onFinish={() => void finish()}
                        />
                    )}
                />
            )}
        </>
    );
}
