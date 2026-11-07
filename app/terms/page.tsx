import { publicPageMetadata } from "../../lib/site-metadata";
import { LegalDocument, type LegalSection } from "../../components/legal-document";
export const metadata = publicPageMetadata(
    "/terms",
    "Terms & Conditions — Seller’s Notebook",
    "Terms for your Seller’s Notebook account, business records, storage and optional marketplace connections.",
);
const sections: LegalSection[] = [
    {
        id: "using-your-notebook",
        title: "Using your notebook",
        content: (
            <>
                <p>
                    These Terms &amp; Conditions govern your use of Seller’s Notebook, a business
                    recordkeeping service. By creating an account or using the service, you agree to
                    these terms. If you do not agree, do not use the service.
                </p>
                <p>
                    You must be legally able to enter this agreement and authorized to manage the
                    business information you enter. The service operator can be reached at{" "}
                    <a href="mailto:ajmission28@gmail.com">ajmission28@gmail.com</a>.
                </p>
            </>
        ),
    },
    {
        id: "your-account",
        title: "Your account",
        content: (
            <>
                <p>
                    Provide accurate account details, keep your password private, and use only
                    accounts and shops you are authorized to access. You are responsible for
                    activity through your account and for keeping your sign-in email accessible.
                </p>
                <p>
                    An optional guided tour offers temporary practice entries that are discarded
                    when you leave it. Report suspected unauthorized access to our support email
                    promptly. Never send us your password or marketplace credentials by email.
                </p>
            </>
        ),
    },
    {
        id: "your-records",
        title: "Your records and files",
        content: (
            <>
                <p>
                    You retain ownership of the business records and files you submit. You give us
                    permission to store, process, transmit and display them as needed to provide the
                    service and its features. This permission does not transfer ownership of your
                    content.
                </p>
                <p>
                    Only upload information you have the right to use. You are responsible for
                    giving any required notices and obtaining any required permission for customer,
                    supplier or other personal information you enter. Keep records relevant to your
                    business and avoid uploading unnecessary sensitive information.
                </p>
                <p>
                    Use available CSV exports and notebook backups to maintain your own copies.
                    Download important uploaded files separately; a notebook backup does not replace
                    a backup of every uploaded file.
                </p>
            </>
        ),
    },
    {
        id: "storage",
        title: "Free access and file storage",
        content: (
            <>
                <p>
                    This edition is free to use and has no application-enforced total storage quota
                    per account. It does not offer paid upgrades or recurring charges.
                </p>
                <p>
                    Individual attachments are limited to 5 MB and profile pictures to 1 MB.
                    Business records have separate validation limits. Service availability and the
                    hosting provider’s technical capacity still apply. You may download or remove
                    your existing files at any time.
                </p>
            </>
        ),
    },
    {
        id: "marketplace-connections",
        title: "Marketplace connections",
        content: (
            <>
                <p>
                    Shopee, Lazada and TikTok Shop connections depend on platform approval,
                    configuration and availability. A feature marked coming soon or unavailable is
                    not an active connection. CSV imports and manually recorded orders can be used
                    independently.
                </p>
                <p>
                    Connecting a shop authorizes access within the permissions you approve. Review
                    fetched orders before importing. Imported history does not automatically
                    reproduce every platform adjustment, charge, refund or stock movement. Check the
                    original marketplace records for accuracy.
                </p>
                <p>
                    Disconnecting removes the stored connection from the notebook, while previously
                    imported orders remain. Revoke the app’s authorization in the marketplace as
                    well if you want to withdraw platform access. Those services have their own
                    terms and privacy policies.
                </p>
            </>
        ),
    },
    {
        id: "responsible-use",
        title: "Responsible use",
        content: (
            <>
                <p>
                    Do not use the service to break the law, upload malicious or unlawful content,
                    infringe another person’s rights, attempt to access another account, bypass
                    usage limits, or disrupt the service. Do not submit payment-card credentials or
                    use the notebook as a payment-processing service.
                </p>
                <p>
                    We may restrict access where reasonably necessary to address abuse, security
                    threats, legal requirements or violations of these terms. Where practicable, we
                    will explain the restriction and provide an opportunity to resolve it.
                </p>
            </>
        ),
    },
    {
        id: "calculations-and-availability",
        title: "Calculations and availability",
        content: (
            <>
                <p>
                    Reports, estimated profit, stock values and pricing suggestions depend on the
                    records and assumptions you provide. They are planning tools, not professional
                    accounting, tax, financial or legal advice. You remain responsible for verifying
                    figures, tax filings and business decisions.
                </p>
                <p>
                    We aim to keep the notebook useful and available, but do not promise
                    uninterrupted access, error-free calculations or compatibility with every
                    marketplace change. To the extent permitted by law, the service is provided as
                    available. Nothing in these terms excludes rights or liabilities that applicable
                    law does not allow us to exclude.
                </p>
            </>
        ),
    },
    {
        id: "closing-your-account",
        title: "Closing your account",
        content: (
            <>
                <p>
                    You may stop using the service at any time. Export your records and download
                    your files before requesting account deletion. When enabled, self-service
                    deletion is available from Account settings → Notebook → Delete my account; if
                    it is unavailable, contact support for assistance.
                </p>
                <p>
                    Deletion removes current notebook data, uploaded files, profile picture and
                    stored marketplace connections through the deletion process. It does not delete
                    your marketplace accounts or copies you exported. Backups, necessary security
                    records and minimal deletion status may follow separate retention rules, as
                    explained in our <a href="/privacy">Privacy Policy</a>.
                </p>
            </>
        ),
    },
    {
        id: "changes-and-contact",
        title: "Changes and contact",
        content: (
            <>
                <p>
                    We may update the service and these terms. The date above identifies the current
                    version. Material changes will be brought to users’ attention through an
                    appropriate service notice before they take effect where required by law. Review
                    the updated terms before continuing to use the changed service.
                </p>
                <p>
                    Applicable law and mandatory consumer and data-protection rights continue to
                    apply. For questions, a problem with your account, or a dispute you would like
                    us to resolve, email{" "}
                    <a href="mailto:ajmission28@gmail.com">ajmission28@gmail.com</a>.
                </p>
            </>
        ),
    },
];
export default function TermsPage() {
    return (
        <LegalDocument
            kind="A LITTLE CLARITY"
            title="Terms & Conditions"
            intro="The ground rules for keeping your business beautifully organized, together."
            sections={sections}
        />
    );
}
