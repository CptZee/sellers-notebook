import { publicPageMetadata } from "../../lib/site-metadata";
export const metadata = publicPageMetadata(
    "/developers",
    "Developer API — Seller’s Notebook",
    "Connect public integrations and mobile devices to your own notebook.",
);
export default function Developers() {
    return (
        <main style={{ maxWidth: 850, margin: "auto", padding: "48px 24px" }}>
            <a href="/">Seller’s Notebook</a>
            <h1>Developer API v1</h1>
            <p>
                Public integrations and our dedicated mobile client share the account-scoped API at{" "}
                <code>/api/v1</code>. Public availability does not make anyone’s business records
                public.
            </p>
            <h2>Getting access</h2>
            <p>
                Sign in and open <a href="/account/api">API access</a>. Create a separate key for
                each integration or mobile device. Choose read-only access unless it needs to change
                records. Keys expire after 90 days and can be revoked immediately from your account.
            </p>
            <p>
                Send <code>Authorization: Bearer YOUR_KEY</code> over HTTPS. Never embed a key in a
                shared mobile build, public source code or a URL. A mobile user creates their own
                device key in the website and stores it in the device’s secure credential storage.
                This initial release uses personal device keys; automated mobile sign-in and refresh
                tokens are not provided.
            </p>
            <pre
                style={{ overflowX: "auto" }}
            >{`curl https://YOUR_HOST/api/v1/notebook \\\n  -H "Authorization: Bearer $NOTEBOOK_API_KEY"`}</pre>
            <h2>Resources</h2>
            <p>
                All paths below start with <code>/api/v1</code>. Write access includes read access.
            </p>
            <table>
                <thead>
                    <tr>
                        <th>Path</th>
                        <th>Methods</th>
                        <th>Purpose</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <code>/notebook</code>
                        </td>
                        <td>GET, PUT, PATCH</td>
                        <td>Read snapshot; replace document or apply changes</td>
                    </tr>
                    <tr>
                        <td>
                            <code>/notebook/manifest</code>
                        </td>
                        <td>GET</td>
                        <td>Read notebook revision and metadata</td>
                    </tr>
                    <tr>
                        <td>
                            <code>/notebook/inventory</code>, <code>/notebook/orders</code>,{" "}
                            <code>/notebook/expenses</code>, <code>/notebook/suppliers</code>
                        </td>
                        <td>GET</td>
                        <td>Filtered, paginated lists</td>
                    </tr>
                    <tr>
                        <td>
                            <code>/notebook/record</code>
                        </td>
                        <td>GET, POST</td>
                        <td>Read or change a product, expense or supplier</td>
                    </tr>
                    <tr>
                        <td>
                            <code>/notebook/order</code>, <code>/notebook/purchase</code>
                        </td>
                        <td>GET, POST</td>
                        <td>Read records or run order and purchase commands</td>
                    </tr>
                    <tr>
                        <td>
                            <code>/notebook/stock</code>
                        </td>
                        <td>POST</td>
                        <td>Run stock commands</td>
                    </tr>
                    <tr>
                        <td>
                            <code>/notebook/overview</code>, <code>/notebook/report</code>
                        </td>
                        <td>GET</td>
                        <td>Business summaries and reports</td>
                    </tr>
                </tbody>
            </table>
            <h2>Revisions and writes</h2>
            <p>
                First GET <code>/notebook</code> for the current <code>document</code> and{" "}
                <code>revision</code>. PUT a JSON object containing that revision and your edited
                document. PATCH accepts{" "}
                <code>{'{ "revision": 12, "changes": { "sidebarNote": "My note" } }'}</code>.
                Collection changes use <code>remove</code> (IDs) and <code>upsert</code> (objects
                with <code>index</code> and <code>record</code>); an optional <code>order</code>{" "}
                lists the final IDs. Existing validation and linked-record rules apply. The notebook
                document is limited to 4,000,000 bytes.
            </p>
            <p>
                For paginated resources, send <code>revision</code> from the latest notebook read,{" "}
                <code>page</code> (starting at 1), <code>size</code> and optional{" "}
                <code>search</code>. On 409, fetch the latest notebook and reconcile your changes
                before retrying. Do not retry commands blindly after a network interruption: inspect
                the saved records first.
            </p>
            <h2>Limits and errors</h2>
            <p>
                Each key allows 60 requests per minute across all server instances. A 429 response
                includes <code>Retry-After: 60</code>. Errors use a JSON <code>error</code> message:
                400 invalid input, 401 invalid or expired key, 403 insufficient access, 404 unknown
                resource, 405 unsupported method, 409 revision conflict, 413 oversized document, and
                503 temporary failure.
            </p>
            <p>
                Browser integrations may use CORS with a Bearer key. Cookie authentication is not
                accepted on v1. Account deletion and key management are not exposed to API keys.
                Each device or integration can access only its key owner’s notebook. Revoking a key
                blocks subsequent requests; work already in progress may finish.
            </p>
            <p>
                <a href="/terms">Terms and file limits</a> ·{" "}
                <a href="/account/api">Manage API access</a>
            </p>
        </main>
    );
}
