import { SiteFooter } from "./site-footer";
import type { ReactNode } from "react";
import { ArrowLeft, NotebookPen, Mail } from "lucide-react";
import "./legal-document.css";
export type LegalSection = { id: string; title: string; content: ReactNode };
export function LegalDocument({
    kind,
    title,
    intro,
    sections,
}: {
    kind: string;
    title: string;
    intro: string;
    sections: LegalSection[];
}) {
    return (
        <div className="legal-page">
            <header className="legal-header">
                <a
                    href="/"
                    className="legal-brand"
                >
                    <NotebookPen size={25} />
                    Seller’s Notebook
                </a>
                <a
                    href="/notebook"
                    className="legal-open"
                >
                    Open your notebook
                </a>
            </header>
            <main className="legal-main">
                <a
                    className="legal-back"
                    href="/"
                >
                    <ArrowLeft size={15} />
                    Back to home
                </a>
                <div className="legal-title">
                    <span>{kind}</span>
                    <h1>{title}</h1>
                    <p>{intro}</p>
                    <small>
                        Last updated <time dateTime="2026-11-07">November 7, 2026</time>
                    </small>
                </div>
                <div className="legal-layout">
                    <aside className="legal-contents">
                        <nav aria-label="On this page">
                            <strong>On this page</strong>
                            {sections.map((section, index) => (
                                <a
                                    key={section.id}
                                    href={"#" + section.id}
                                >
                                    <span>{String(index + 1).padStart(2, "0")}</span>
                                    {section.title}
                                </a>
                            ))}
                        </nav>
                        <a
                            className="legal-email"
                            href="mailto:ajmission28@gmail.com"
                        >
                            <Mail size={16} />
                            Questions? Write to us
                        </a>
                    </aside>
                    <article className="legal-paper">
                        {sections.map((section, index) => (
                            <section
                                key={section.id}
                                id={section.id}
                            >
                                <span className="legal-number">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <h2>{section.title}</h2>
                                {section.content}
                            </section>
                        ))}
                    </article>
                </div>
                <div className="legal-contact">
                    <NotebookPen size={25} />
                    <div>
                        <h2>A question about your notebook?</h2>
                        <p>
                            Contact the Seller’s Notebook service operator at{" "}
                            <a href="mailto:ajmission28@gmail.com">ajmission28@gmail.com</a>.
                        </p>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
