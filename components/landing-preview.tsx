export function LandingPreview() {
    return (
        <figure className="landing-preview">
            <img
                src="/media/sellers-notebook-landing-poster.jpg"
                width={1920}
                height={1080}
                alt="Seller’s Notebook sample business dashboard"
                aria-describedby="notebook-preview-description"
            />
            <figcaption id="notebook-preview-description">
                <span>Overview, inventory, orders, expenses, suppliers, and pricing.</span>
                <span>Sample notebook with fictional figures</span>
            </figcaption>
        </figure>
    );
}
