"use client";

import { useEffect, useRef, useState } from "react";

export function LandingPreview() {
    const video = useRef<HTMLVideoElement>(null);
    const [autoplay, setAutoplay] = useState(false);

    useEffect(() => {
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const applyPreference = () => {
            setAutoplay(!preference.matches);
            if (preference.matches) video.current?.pause();
            else
                void video.current?.play().catch(() => {
                    /* The poster and controls remain available if autoplay is blocked. */
                });
        };
        applyPreference();
        preference.addEventListener("change", applyPreference);
        return () => preference.removeEventListener("change", applyPreference);
    }, []);

    return (
        <figure className="landing-preview">
            <video
                ref={video}
                autoPlay={autoplay}
                muted
                loop
                playsInline
                controls
                preload="metadata"
                poster="/media/sellers-notebook-landing-poster.jpg"
                width={1920}
                height={1080}
                aria-label="A 15-second tour of Seller’s Notebook"
                aria-describedby="notebook-preview-description"
            >
                <source
                    src="/media/sellers-notebook-landing-loop.mp4"
                    type="video/mp4"
                />
                <a href="/media/sellers-notebook-landing-loop.mp4">Watch the notebook preview</a>.
            </video>
            <figcaption id="notebook-preview-description">
                <span>Overview, inventory, orders, expenses, suppliers, and pricing.</span>
                <span>15 seconds · Sample notebook with fictional figures</span>
            </figcaption>
        </figure>
    );
}
