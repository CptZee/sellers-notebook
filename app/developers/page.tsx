import { publicPageMetadata } from "../../lib/site-metadata";
import "./developers.css";
export const metadata = publicPageMetadata(
    "/developers",
    "Developer API — Seller’s Notebook",
    "Connect public integrations and mobile devices to your own notebook.",
);
export default function Developers() {
    return (
        <main className="api-docs">
            <a href="/">Seller’s Notebook</a>
            <p className="api-docs-eyebrow">DEVELOPER RESOURCES · VERSION 1</p>
            <h1>API documentation</h1>
            <p>
                Public integrations and our dedicated mobile client share the account-scoped API at{" "}
                <code>/api/v1</code>. Public availability does not make anyone’s business records
                public.
            </p>
            <nav
                className="api-docs-nav"
                aria-label="API documentation sections"
            >
                <a href="#access">Getting access</a>
                <a href="#examples">Quick start</a>
                <a href="#resources">Resources</a>
                <a href="#writes">Writing data</a>
                <a href="#errors">Limits and errors</a>
            </nav>
            <h2 id="access">Getting access</h2>
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
            <h2 id="examples">Quick start</h2>
            <p>
                Set <code>NOTEBOOK_API_KEY</code> in your private environment, replace{" "}
                <code>YOUR_HOST</code> with your installation’s hostname, and read your notebook:
            </p>
            <pre
                style={{ overflowX: "auto" }}
            >{`curl https://YOUR_HOST/api/v1/notebook \\\n  -H "Authorization: Bearer $NOTEBOOK_API_KEY"`}</pre>
            <p>In a JavaScript server application, use the same Bearer key:</p>
            <pre>
                <code>{`const response = await fetch("https://YOUR_HOST/api/v1/notebook", {
  headers: { Authorization: \`Bearer \${process.env.NOTEBOOK_API_KEY}\` },
});
const notebook = await response.json();
if (!response.ok) throw new Error(notebook.error);
console.log(notebook.revision, notebook.document.products);`}</code>
            </pre>
            <p>
                The JSON response includes <code>user</code>, <code>document</code>,{" "}
                <code>revision</code> and <code>updatedAt</code>. The document contains products,
                orders, expenses, suppliers, purchase orders and record histories.
            </p>
            <h3>Read a page of inventory</h3>
            <p>
                Use the revision from your notebook response. Supported page sizes are 10, 25, 50
                and 100; pages start at 1.
            </p>
            <pre>
                <code>{`curl "https://YOUR_HOST/api/v1/notebook/inventory?revision=12&page=1&size=25" \\\n  -H "Authorization: Bearer $NOTEBOOK_API_KEY"`}</code>
            </pre>
            <h2 id="resources">Resources</h2>
            <p>
                All paths below start with <code>/api/v1</code>. Write access includes read access.
            </p>
            <div
                className="api-docs-table"
                tabIndex={0}
                role="region"
                aria-label="API resources"
            >
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
            </div>
            <h2 id="writes">Revisions and writes</h2>
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
                For example, update your sidebar note with a read/write key. Replace <code>12</code>{" "}
                with the revision you just read:
            </p>
            <pre>
                <code>{`curl -X PATCH "https://YOUR_HOST/api/v1/notebook" \\\n  -H "Authorization: Bearer $NOTEBOOK_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  --data '{"revision":12,"changes":{"sidebarNote":"My integration is connected"}}'`}</code>
            </pre>
            <p>
                For paginated resources, send <code>revision</code> from the latest notebook read,{" "}
                <code>page</code> (starting at 1), <code>size</code> and optional{" "}
                <code>search</code>. On 409, fetch the latest notebook and reconcile your changes
                before retrying. Do not retry commands blindly after a network interruption: inspect
                the saved records first.
            </p>
            <h2 id="errors">Limits and errors</h2>
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
