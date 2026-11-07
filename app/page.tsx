import { SiteFooter } from "../components/site-footer";
import { LandingPreview } from "../components/landing-preview";
import {
    ArrowRight,
    BookOpen,
    NotebookPen,
    Package,
    PencilLine,
    Check,
    Paperclip,
    Sprout,
    RefreshCw,
    ChartNoAxesCombined,
    ReceiptText,
    Truck,
    Calculator,
    Cloud,
    Quote,
} from "lucide-react";
import "./landing.css";
import "./landing-sections.css";

const routineSteps = [
    {
        title: "Make a home for your products.",
        description:
            "Add what you sell, what it costs, and how much you have. Set stock targets before your shelves run low.",
    },
    {
        title: "Write down the little wins.",
        description:
            "Record a manual sale and its fees to reserve stock. Complete the order to include it in revenue and estimated profit.",
    },
    {
        title: "Keep the little costs close.",
        description:
            "Log overhead, group expenses by category, and keep receipts with the products they belong to.",
    },
    {
        title: "Plan the next good delivery.",
        description:
            "Link suppliers to your products, arrange purchases, and record arrivals. Keep payments and returns with their purchase records.",
    },
    {
        title: "Find a price that works.",
        description:
            "Bring your costs, fees, and target margin together in the pricing calculator. Explore a selling price with a little room to grow.",
    },
    {
        title: "Turn the page with a clearer picture.",
        description:
            "Review revenue, overhead, and estimated net profit. Pick up your saved notebook on another signed-in device.",
    },
];

export default function Landing() {
    return (
        <div className="landing">
            <header className="landing-nav">
                <a
                    className="landing-brand"
                    href="/"
                    aria-label="Seller’s Notebook home"
                >
                    <span>
                        <NotebookPen size={25} />
                    </span>
                    Seller’s Notebook
                </a>
                <nav aria-label="Main navigation">
                    <a
                        className="landing-about"
                        href="#how-it-works"
                    >
                        How it works
                    </a>
                    <a
                        className="landing-about"
                        href="#free"
                    >
                        Free notebook
                    </a>
                    <a href="/auth/sign-in">Sign in</a>
                    <a
                        className="button primary"
                        href="/auth/sign-up"
                    >
                        Start your notebook
                        <ArrowRight size={15} />
                    </a>
                </nav>
            </header>
            <main className="landing-main">
                <section className="landing-hero">
                    <div className="hero-copy">
                        <span className="landing-kicker">
                            <span className="live-dot" />A LITTLE ORDER FOR YOUR LITTLE BUSINESS
                        </span>
                        <h1>
                            Your business deserves
                            <br />a <span>fresh page.</span>
                        </h1>
                        <p>
                            All the charm of a notebook.
                            <br />A little less doing the math.
                        </p>
                        <div className="hero-description">
                            Keep your products, orders, expenses, and suppliers together in one calm
                            place. Follow your stock, plan your next restock, and make sense of the
                            numbers.
                        </div>
                        <div className="hero-actions">
                            <a
                                className="button primary"
                                href="/auth/sign-up"
                            >
                                Create your notebook
                                <ArrowRight size={17} />
                            </a>
                            <a
                                className="hero-text-link"
                                href="#inside-your-notebook"
                            >
                                Take a little look inside
                                <ArrowRight size={15} />
                            </a>
                        </div>
                        <div className="hero-footnote">
                            <Check size={14} />
                            Your own account. Your own pages.
                        </div>
                    </div>
                    <div
                        className="notebook-illustration"
                        aria-label="An illustrated business notebook with fictional sample entries"
                    >
                        <span className="illustration-note">
                            a place for the things you’re growing ↴
                        </span>
                        <div className="notebook-volume">
                            <div
                                className="book-page-stack"
                                aria-label="Six bookmarked notebook sections"
                            >
                                {[
                                    "Overview",
                                    "Inventory",
                                    "Orders",
                                    "Expenses",
                                    "Suppliers",
                                    "Pricing calculator",
                                ].map((name) => (
                                    <div
                                        className="book-leaf"
                                        key={name}
                                    >
                                        <span className="book-tab">{name}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="illustrated-book">
                                <div className="book-top">
                                    <NotebookPen size={18} />
                                    <span>my little business</span>
                                    <small>01</small>
                                </div>
                                <div className="illustrated-title">Good things are adding up.</div>
                                <p className="illustrated-date">a good day, on paper</p>
                                <div className="illustrated-sticky">
                                    <span>today’s little wins</span>
                                    <strong>
                                        3 orders packed <Check size={21} />
                                    </strong>
                                    <small>and a little room to grow.</small>
                                </div>
                                <div className="illustrated-ledger">
                                    <div>
                                        <span>the everyday tote</span>
                                        <span>₱349</span>
                                    </div>
                                    <div>
                                        <span>the cloud mug</span>
                                        <span>₱289</span>
                                    </div>
                                    <div>
                                        <span>the linen journal</span>
                                        <span>₱249</span>
                                    </div>
                                </div>
                                <div className="illustrated-sum">
                                    <span>little sales, big smiles</span>
                                    <strong>₱887</strong>
                                </div>
                                <div className="illustrated-caption">
                                    <Sprout size={18} />
                                    one small step at a time.
                                </div>
                            </div>
                        </div>
                        <div className="automation-note">
                            <RefreshCw size={16} />
                            <span>
                                You log the sale.
                                <br />
                                <strong>The numbers follow.</strong>
                            </span>
                        </div>
                        <span className="illustration-disclaimer">
                            Illustration · sample figures
                        </span>
                    </div>
                </section>
                <section
                    className="landing-tour"
                    id="inside-your-notebook"
                    aria-labelledby="landing-tour-title"
                >
                    <div className="landing-section-heading">
                        <div>
                            <span className="landing-kicker">YOUR BUSINESS, BEAUTIFULLY KEPT</span>
                            <h2 id="landing-tour-title">A little look inside.</h2>
                        </div>
                        <p>
                            Six useful pages. One calm place.
                            <br />
                            See your notebook in action.
                        </p>
                    </div>
                    <LandingPreview />
                </section>
                <section
                    className="landing-features"
                    aria-label="Six pages for your business"
                >
                    <div>
                        <ChartNoAxesCombined size={23} />
                        <h2>A clearer picture of your shop.</h2>
                        <p>
                            See revenue, refunds, recorded overhead, and estimated net profit.
                            Explore your numbers by date and sales channel.
                        </p>
                    </div>
                    <div>
                        <Package size={23} />
                        <h2>A shelf for every product.</h2>
                        <p>
                            Keep prices, costs, and stock in order. Follow stock movements, spot low
                            supplies, and plan your next restock. Bring products in with a CSV.
                        </p>
                    </div>
                    <div>
                        <PencilLine size={23} />
                        <h2>A page for every sale.</h2>
                        <p>
                            Record orders manually or preview a CSV import from Shopee, Lazada, or
                            TikTok Shop. Track completion, cancellations, and customer refunds.
                        </p>
                    </div>
                    <div>
                        <ReceiptText size={23} />
                        <h2>The little costs count, too.</h2>
                        <p>
                            Organize business expenses by category and channel. Search, filter, and
                            export your ledger, with overhead included in estimated net profit.
                        </p>
                    </div>
                    <div>
                        <Truck size={23} />
                        <h2>Good people. Neatly kept.</h2>
                        <p>
                            Keep supplier contacts, linked products, and lead times together. Track
                            purchase orders, partial deliveries, payments, and supplier returns.
                        </p>
                    </div>
                    <div>
                        <Calculator size={23} />
                        <h2>Find your pricing sweet spot.</h2>
                        <p>
                            Enter product costs, fees, packaging, shipping, and your target margin.
                            Explore a suggested selling price with room for your business to grow.
                        </p>
                    </div>
                </section>
                <section
                    className="landing-details"
                    aria-label="The little details, taken care of"
                >
                    <div>
                        <Paperclip size={21} />
                        <div>
                            <h2>A place for your receipts.</h2>
                            <p>
                                Keep receipts and product files in your private notebook, right
                                alongside the things they belong to.
                            </p>
                        </div>
                    </div>
                    <div>
                        <Cloud size={21} />
                        <div>
                            <h2>Pick up where you left off.</h2>
                            <p>
                                Your saved changes update live across your signed-in devices. Your
                                own account, wherever the day takes you.
                            </p>
                        </div>
                    </div>
                </section>
                <section
                    className="landing-how"
                    id="how-it-works"
                >
                    <div className="how-intro">
                        <span className="landing-kicker">LESS SCATTERED. MORE SETTLED.</span>
                        <h2>
                            Your routine,
                            <br />
                            with a little more ease.
                        </h2>
                        <p>
                            From your first product to your next supplier delivery, keep the
                            everyday pieces of your business together.
                        </p>
                        <div
                            className="landing-channels"
                            aria-label="Supported sales channels"
                        >
                            <span>Shopee</span>
                            <span>Lazada</span>
                            <span>TikTok Shop</span>
                            <span>Direct sales</span>
                        </div>
                    </div>
                    <ol>
                        {routineSteps.map((step, index) => (
                            <li key={step.title}>
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <div>
                                    <h3>{step.title}</h3>
                                    <p>{step.description}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>
                <section
                    className="landing-free"
                    id="free"
                    aria-labelledby="free-title"
                >
                    <div>
                        <span className="landing-kicker">A LITTLE ROOM TO GROW</span>
                        <h2 id="free-title">Your notebook, freely yours.</h2>
                        <p>
                            All six notebook pages, private files and live sync. Free to use, with
                            no account storage quota.
                        </p>
                    </div>
                    <div>
                        <ul>
                            {[
                                "Inventory, orders and everyday expenses",
                                "Suppliers, purchases and pricing tools",
                                "Private attachments, CSV imports and exports",
                            ].map((feature) => (
                                <li key={feature}>
                                    <Check size={15} />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <a
                            className="button primary"
                            href="/auth/sign-up"
                        >
                            Start your free notebook
                            <ArrowRight size={16} />
                        </a>
                        <small>
                            Attachments up to 5 MB; profile pictures up to 1 MB. Business records
                            have separate validation limits.
                        </small>
                    </div>
                </section>

                <section
                    className="landing-stories"
                    aria-labelledby="stories-title"
                >
                    <div className="landing-section-heading">
                        <div>
                            <span className="landing-kicker">
                                THE PEOPLE BEHIND THE LITTLE BUSINESSES
                            </span>
                            <h2 id="stories-title">Good things, shared.</h2>
                        </div>
                        <p>
                            Every shop has a story.
                            <br />
                            There’s a place for yours here.
                        </p>
                    </div>
                    <div className="testimonial-placeholder">
                        <span
                            className="testimonial-mark"
                            aria-hidden="true"
                        >
                            <Quote size={31} />
                        </span>
                        <div>
                            <span className="testimonial-status">
                                CUSTOMER TESTIMONIAL COMING SOON
                            </span>
                            <h3>A little room for your story.</h3>
                            <p>
                                We’re saving this page for a real seller’s experience, shared with
                                their permission.
                            </p>
                        </div>
                        <span
                            className="testimonial-doodle"
                            aria-hidden="true"
                        >
                            <Sprout size={37} />
                        </span>
                    </div>
                </section>
                <section className="landing-cta">
                    <span className="cta-doodle">
                        <BookOpen size={35} />
                    </span>
                    <div>
                        <h2>Good things start with a blank page.</h2>
                        <p>Make a little space for your business to grow.</p>
                    </div>
                    <a
                        className="button primary"
                        href="/auth/sign-up"
                    >
                        Let’s start your notebook
                        <ArrowRight size={17} />
                    </a>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
