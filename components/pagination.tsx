import { pageSizes } from "../lib/pagination.mjs";
export function Pagination({
    label,
    page,
    pages,
    pageSize,
    start,
    end,
    total,
    setPage,
    setPageSize,
}: {
    label: string;
    page: number;
    pages: number;
    pageSize: number;
    start: number;
    end: number;
    total: number;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
}) {
    return (
        <nav
            className="pagination"
            aria-label={`${label} pagination`}
        >
            <span aria-live="polite">
                {total ? start + 1 : 0}–{end} of {total}
            </span>
            <label>
                Rows per page
                <select
                    aria-label={`${label} rows per page`}
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                >
                    {pageSizes.map((size) => (
                        <option key={size}>{size}</option>
                    ))}
                </select>
            </label>
            <div>
                <button
                    className="button secondary"
                    type="button"
                    aria-label={`${label}: Previous page`}
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                >
                    Previous
                </button>
                <span>
                    Page {page} of {pages}
                </span>
                <button
                    className="button secondary"
                    type="button"
                    aria-label={`${label}: Next page`}
                    disabled={page >= pages}
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </div>
        </nav>
    );
}
