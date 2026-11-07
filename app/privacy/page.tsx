import { publicPageMetadata } from "../../lib/site-metadata";
import { LegalDocument, type LegalSection } from "../../components/legal-document";
export const metadata = publicPageMetadata(
    "/privacy",
    "Privacy Policy — Seller’s Notebook",
    "How Seller’s Notebook handles account information, business records, files, marketplace connections and your privacy choices.",
);
const sections: LegalSection[] = [
    {
        id: "who-we-are",
        title: "Who we are",
        content: (
            <>
                <p>
                    This notice explains how the Seller’s Notebook service operator handles personal
                    information when you use this website and its business notebook. For account
                    information and operation of the service, the operator determines how
                    information is used. For customer and supplier records you enter, we process
                    information to provide the notebook under your instructions; you remain
                    responsible for your business’s own privacy obligations.
                </p>
                <p>
                    Contact the service operator about privacy at{" "}
                    <a href="mailto:ajmission28@gmail.com">ajmission28@gmail.com</a>. This notice
                    also applies to support messages you send us.
                </p>
            </>
        ),
    },
    {
        id: "information-we-handle",
        title: "Information we handle",
        content: (
            <ul>
                <li>
                    <strong>Account details:</strong> your name, email address, authentication
                    information, optional profile picture, and saved onboarding completion.
                    Authentication is handled through our authentication provider.
                </li>
                <li>
                    <strong>Business records:</strong> products, stock, orders, customer references
                    you enter, expenses, supplier contacts, purchases, deliveries, payments,
                    returns, refunds, notes and branding.
                </li>
                <li>
                    <strong>Files:</strong> uploaded receipts, product images and documents, plus
                    file names, sizes, ownership and links to your records.
                </li>
                <li>
                    <strong>Marketplace information:</strong> authorized shop identifiers, access
                    and refresh credentials, fetched or imported order information, and connection
                    or synchronization status when a connection is enabled and you authorize it.
                </li>
                <li>
                    <strong>Technical and support information:</strong> session information, request
                    and error information needed to run and secure the service, and messages you
                    send to support. Hosting providers may process technical connection details such
                    as IP addresses.
                </li>
            </ul>
        ),
    },
    {
        id: "why-we-use-information",
        title: "Why we use information",
        content: (
            <>
                <p>
                    We use information to create and authenticate your account, save and synchronize
                    records, deliver uploaded files, calculate reports, manage file uploads,
                    remember onboarding completion, run authorized marketplace features, handle
                    support requests and protect the service from misuse.
                </p>
                <p>
                    Processing needed to deliver your account and requested features is based on
                    providing the service under our agreement with you. Security and operational
                    processing may rely on legitimate interests, subject to your rights. Where an
                    activity requires consent or a legal obligation applies, we use that basis as
                    appropriate. Optional marketplace access starts only when you authorize it.
                </p>
                <p>
                    The current service does not use notebook content for advertising or sell your
                    personal information. Calculations and pricing suggestions assist your own
                    decisions; they do not make decisions with legal effects about you.
                </p>
            </>
        ),
    },
    {
        id: "providers-and-connections",
        title: "Providers and connections",
        content: (
            <>
                <p>
                    Neon provides the database, authentication, private file storage and live
                    synchronization used by the notebook. Application hosting and email providers
                    also process information needed to deliver the website and account emails. If
                    you email support, your message is handled by the support email provider as
                    well.
                </p>
                <p>
                    When you authorize an available marketplace connection, information is exchanged
                    with Shopee, Lazada or TikTok Shop to provide the features you request. Those
                    platforms separately handle information under their own privacy notices. We do
                    not ask for your marketplace password in the notebook.
                </p>
                <p>
                    Service providers may process information outside the Philippines according to
                    their service locations and contractual safeguards. Information may also be
                    disclosed when legally required or reasonably necessary to protect rights and
                    security. Access should be limited to what is needed for the relevant purpose.
                </p>
            </>
        ),
    },
    {
        id: "browser-storage",
        title: "Cookies and browser storage",
        content: (
            <>
                <p>
                    Authentication uses cookies and session information to keep you signed in and
                    protect your account. Browser storage remembers preferences such as theme and
                    pencil cursor, and may hold sample-notebook data, local working state or pending
                    recovery information used by notebook features.
                </p>
                <p>
                    Guided-tour practice entries exist only in temporary browser memory and are
                    discarded when the tour closes; they are not saved to your cloud notebook.
                    Separately, the sample notebook uses fictional data and can be edited locally in
                    your browser. Clearing browser storage removes local preferences and may remove
                    unsynchronized or sample data; it does not itself delete records already saved
                    to your cloud account. Export or synchronize work first. Signing out and
                    clearing browser data are recommended on shared devices.
                </p>
                <p>
                    The current application does not include advertising trackers. Your browser can
                    manage cookies and site storage, although blocking essential session storage can
                    prevent sign-in or saving features from working.
                </p>
            </>
        ),
    },
    {
        id: "retention-and-deletion",
        title: "Retention and deletion",
        content: (
            <>
                <p>
                    Account details, business records and uploaded files are generally kept while
                    your account is active, until you remove them or request account deletion,
                    subject to necessary legal and security retention. Stored marketplace
                    credentials remain until disconnected, replaced or removed through account
                    deletion. Disconnecting does not remove previously imported orders.
                </p>
                <p>
                    Deleting an account removes current account data and files through the service’s
                    deletion workflow. When the self-service option is unavailable, email us to
                    request assistance. Minimal deletion status can remain to complete interrupted
                    cleanup and prevent old sessions from recreating records.
                </p>
                <p>
                    Provider backups, restoration copies, security records and support
                    correspondence may remain under their separate configured retention schedules or
                    for a necessary legal purpose. Deletion of current records does not promise
                    immediate erasure from every backup. Contact us for retention details relating
                    to your request. Copies you export or records held independently by marketplaces
                    remain under their respective owners’ control.
                </p>
            </>
        ),
    },
    {
        id: "security-and-your-choices",
        title: "Security and your choices",
        content: (
            <>
                <p>
                    The application uses authenticated account access, ownership checks for records
                    and files, and encrypted storage of marketplace credentials. No online service
                    can guarantee absolute security. Use a strong, unique password and avoid sharing
                    your sign-in details.
                </p>
                <p>
                    You can edit your profile, correct business records, export supported CSV views
                    and notebook backups, delete uploaded files, change browser preferences, and
                    disconnect marketplace accounts. Download files separately when keeping a
                    complete backup. You may also revoke marketplace authorization directly with the
                    platform.
                </p>
            </>
        ),
    },
    {
        id: "your-privacy-rights",
        title: "Your privacy rights",
        content: (
            <>
                <p>
                    Depending on applicable law, including the Philippine Data Privacy Act of 2012
                    where it applies, you may have rights to be informed, access and correct your
                    information, object to processing, request erasure or blocking, obtain a
                    portable copy, and seek remedies or make a complaint. Some requests are subject
                    to legal conditions, required retention and the rights of others.
                </p>
                <p>
                    To make a request, email{" "}
                    <a href="mailto:ajmission28@gmail.com">ajmission28@gmail.com</a> from your
                    account email and describe what you need. We may ask for reasonable information
                    to verify that you are entitled to make the request. Do not include your
                    password or unnecessary identity documents in the initial message.
                </p>
                <p>
                    You can also contact the{" "}
                    <a
                        href="https://privacy.gov.ph/data-subject-rights/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        National Privacy Commission
                    </a>{" "}
                    about your rights or a privacy concern in the Philippines.
                </p>
            </>
        ),
    },
    {
        id: "updates-and-contact",
        title: "Updates and contact",
        content: (
            <>
                <p>
                    We may update this notice as the service changes. The date above shows the
                    current version. Where required, material changes will be communicated through
                    an appropriate notice before the new processing begins.
                </p>
                <p>
                    Questions about this policy, a privacy request or a suspected data exposure?
                    Contact <a href="mailto:ajmission28@gmail.com">ajmission28@gmail.com</a>. Read
                    our <a href="/terms">Terms &amp; Conditions</a> for the rules governing use of
                    the service.
                </p>
            </>
        ),
    },
];
export default function PrivacyPage() {
    return (
        <LegalDocument
            kind="YOUR NOTEBOOK, YOUR INFORMATION"
            title="Privacy Policy"
            intro="A clear look at the information your notebook uses, why it is needed, and the choices you have."
            sections={sections}
        />
    );
}
