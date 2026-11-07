import test from "node:test";
import assert from "node:assert/strict";
import { notebookCollections, parseNotebookPage } from "../lib/notebook-pages.mjs";
import { loadNotebookPages, NotebookReadError } from "../lib/load-notebook.mjs";
const response = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const source = (length = 251) =>
    Object.fromEntries(
        Object.keys(notebookCollections).map((key) => [
            key,
            Array.from(
                { length: key === "orders" ? length : key === "products" ? 2 : 0 },
                (_, i) => ({ id: key + "-" + i }),
            ),
        ]),
    );
function backend(document = source(), user = "owner", revision = 1) {
    const calls = [];
    let concurrent = 0,
        peak = 0;
    const fetcher = async (url, options) => {
        calls.push({ url, options });
        assert.equal(options.cache, "no-store");
        if (options.headers["X-Notebook-User"] && options.headers["X-Notebook-User"] !== user)
            return response({ error: "Wrong session" }, 401);
        if (url.endsWith("/manifest"))
            return response({
                user: { id: user, name: "Owner", email: "owner@example.com" },
                revision,
                metadata: { sidebarNote: "Note", branding: null },
                collections: Object.fromEntries(
                    Object.entries(document).map(([key, items]) => [
                        key,
                        { count: items.length, hash: JSON.stringify(items) },
                    ]),
                ),
            });
        const page = parseNotebookPage(new URL(url, "http://local").searchParams);
        concurrent++;
        peak = Math.max(peak, concurrent);
        await new Promise((resolve) => setTimeout(resolve, 2));
        concurrent--;
        return response({
            ...page,
            items: document[page.collection].slice(page.offset, page.offset + page.limit),
        });
    };
    return {
        fetcher,
        calls,
        get peak() {
            return peak;
        },
    };
}
test("notebook page parameters whitelist collections and bound offsets, revisions and batch size", () => {
    assert.deepEqual(
        parseNotebookPage(new URLSearchParams("collection=orders&revision=2&offset=100&limit=50")),
        { collection: "orders", revision: 2, offset: 100, limit: 50 },
    );
    for (const query of [
        "collection=owner_id&revision=1",
        "collection=__proto__&revision=1",
        "collection=orders",
        "collection=orders&revision=-1",
        "collection=orders&revision=1&limit=101",
        "collection=orders&revision=1&limit=0",
        "collection=orders&revision=1&offset=1.5",
        "collection=orders&revision=1&offset=15001",
        "collection=orders&revision=99999999999999999999",
    ])
        assert.throws(() => parseNotebookPage(new URLSearchParams(query)));
});
test("paged loading assembles every collection in stable order with at most four bounded requests in flight", async () => {
    const document = source(601),
        server = backend(document),
        progress = [];
    const result = await loadNotebookPages({
        fetcher: server.fetcher,
        onProgress: (done, total) => progress.push([done, total]),
    });
    for (const key of Object.keys(document)) assert.deepEqual(result.document[key], document[key]);
    assert.equal(result.document.sidebarNote, "Note");
    assert.equal(server.peak, 4);
    assert.ok(server.calls.every((call) => call.url !== "/api/notebook"));
    assert.equal(server.calls.filter((call) => call.url.includes("/pages?")).length, 8);
    assert.deepEqual(progress.at(-1), [603, 603]);
    assert.ok(
        server.calls
            .filter((call) => call.url.includes("/pages?"))
            .every((call) => call.options.headers["X-Notebook-User"] === "owner"),
    );
});
test("unchanged collection hashes reuse memory without another page download, including metadata-only revisions", async () => {
    const document = source(),
        first = backend(document),
        initial = await loadNotebookPages({ fetcher: first.fetcher });
    const second = backend(document, "owner", 2),
        next = await loadNotebookPages({
            fetcher: second.fetcher,
            cache: initial.cache,
            userId: "owner",
        });
    assert.equal(second.calls.length, 1);
    assert.equal(next.document.orders, initial.document.orders);
    const changed = { ...document, products: [{ id: "changed" }] },
        third = backend(changed, "owner", 3),
        final = await loadNotebookPages({
            fetcher: third.fetcher,
            cache: next.cache,
            userId: "owner",
        });
    assert.equal(third.calls.length, 2);
    assert.equal(final.document.orders, next.document.orders);
    assert.deepEqual(final.document.products, [{ id: "changed" }]);
    assert.ok(third.calls.every((call) => call.options.headers["X-Notebook-User"] === "owner"));
});
test("cache is account scoped and changed sessions are rejected", async () => {
    const initial = await loadNotebookPages({ fetcher: backend().fetcher });
    const other = backend(source(), "other");
    const result = await loadNotebookPages({ fetcher: other.fetcher, cache: initial.cache });
    assert.equal(result.user.id, "other");
    assert.ok(other.calls.length > 1);
    assert.notEqual(result.document.orders, initial.document.orders);
    await assert.rejects(
        loadNotebookPages({ fetcher: other.fetcher, userId: "owner" }),
        (error) => error instanceof NotebookReadError && error.status === 401,
    );
});
test("a revision conflict discards partial pages and restarts without mixing versions", async () => {
    const old = backend(source(151), "owner", 1),
        newDoc = source(103);
    newDoc.orders[0] = { id: "NEW" };
    const next = backend(newDoc, "owner", 2);
    let manifests = 0,
        conflicted = false;
    const fetcher = async (url, options) => {
        if (url.endsWith("/manifest")) manifests++;
        if (manifests === 1 && url.includes("/pages?") && !conflicted) {
            conflicted = true;
            return response({ error: "Changed" }, 409);
        }
        return (manifests > 1 ? next : old).fetcher(url, options);
    };
    const result = await loadNotebookPages({ fetcher });
    assert.equal(result.revision, 2);
    assert.deepEqual(result.document.orders, newDoc.orders);
    assert.equal(manifests, 2);
});
test("persistent conflicts have a bounded retry limit and incomplete pages never return a usable notebook", async () => {
    const server = backend();
    let attempts = 0;
    await assert.rejects(
        loadNotebookPages({
            fetcher: async (url, options) =>
                url.endsWith("/manifest")
                    ? (attempts++, server.fetcher(url, options))
                    : response({ error: "Changed" }, 409),
        }),
        (error) => error.status === 409,
    );
    assert.equal(attempts, 3);
    await assert.rejects(
        loadNotebookPages({
            fetcher: async (url, options) => {
                const result = await server.fetcher(url, options);
                if (url.includes("/pages?")) {
                    const body = await result.json();
                    body.items = [];
                    return response(body);
                }
                return result;
            },
        }),
        /incomplete/,
    );
});
test("malformed manifests fail before issuing collection reads", async () => {
    let calls = 0;
    await assert.rejects(
        loadNotebookPages({
            fetcher: async () => {
                calls++;
                return response({
                    user: { id: "owner" },
                    revision: 1,
                    collections: { products: { count: 3001, hash: "h" } },
                });
            },
        }),
        /manifest/,
    );
    assert.equal(calls, 1);
});
test("a session changing between manifest and first page cannot assemble another account at the same revision", async () => {
    const first = backend(),
        other = backend(source(), "other");
    await assert.rejects(
        loadNotebookPages({
            fetcher: (url, options) =>
                (url.endsWith("/manifest") ? first : other).fetcher(url, options),
        }),
        (error) => error.status === 401,
    );
});
test("cancelled loads stop before fetching and cannot return a partially fetched notebook", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await assert.rejects(
        loadNotebookPages({
            signal: controller.signal,
            fetcher: async () => {
                calls++;
                return response({});
            },
        }),
        (error) => error.name === "AbortError",
    );
    assert.equal(calls, 0);
    const mid = new AbortController(),
        server = backend();
    await assert.rejects(
        loadNotebookPages({
            signal: mid.signal,
            fetcher: async (url, options) => {
                const result = await server.fetcher(url, options);
                if (url.includes("/pages?")) mid.abort();
                return result;
            },
        }),
        (error) => error.name === "AbortError",
    );
});
test("manifest-only opening downloads no collection pages and later hydration preserves every record", async () => {
    const server = backend(source(301)),
        opened = await loadNotebookPages({ fetcher: server.fetcher, collections: [] });
    assert.equal(server.calls.length, 1);
    assert.deepEqual(opened.document.orders, []);
    assert.equal(opened.collections.orders.count, 301);
    const hydrated = await loadNotebookPages({
        fetcher: server.fetcher,
        cache: opened.cache,
        userId: "owner",
    });
    assert.equal(hydrated.document.orders.length, 301);
    const before = server.calls.length,
        reopened = await loadNotebookPages({
            fetcher: server.fetcher,
            cache: hydrated.cache,
            collections: [],
        });
    assert.equal(server.calls.length, before + 1);
    assert.deepEqual(reopened.document.orders, []);
    const again = await loadNotebookPages({ fetcher: server.fetcher, cache: reopened.cache });
    assert.equal(again.document.orders, hydrated.document.orders);
    assert.equal(server.calls.length, before + 2);
});
