import test from "node:test";
import assert from "node:assert/strict";
import {
    createApiToken,
    hashApiToken,
    bearerToken,
    keyInput,
    readApiBody,
} from "../lib/api-token.mjs";
test("API body size is bounded even without a Content-Length header", async () => {
    const request = (body) => new Request("https://example.com", { method: "POST", body });
    assert.equal(new TextDecoder().decode(await readApiBody(request("abc"), 3)), "abc");
    await assert.rejects(readApiBody(request("abcd"), 3), RangeError);
});
test("API keys are random, hashed and accepted only as Bearer credentials", () => {
    const first = createApiToken(),
        second = createApiToken();
    assert.notEqual(first, second);
    assert.equal(bearerToken(`Bearer ${first}`), first);
    assert.equal(hashApiToken(first).length, 64);
    assert.notEqual(hashApiToken(first), hashApiToken(second));
    for (const value of [
        null,
        first,
        `Basic ${first}`,
        `Bearer ${first} extra`,
        "Bearer snb_short",
    ])
        assert.equal(bearerToken(value), null);
});
test("key creation validates purpose and scope rather than trusting client input", () => {
    assert.deepEqual(keyInput({ name: " Phone ", purpose: "mobile", scope: "read" }), {
        name: "Phone",
        purpose: "mobile",
        scope: "read",
    });
    for (const value of [
        null,
        {},
        { name: " ", purpose: "mobile", scope: "read" },
        { name: "A", purpose: "admin", scope: "write" },
        { name: "A", purpose: "public", scope: "admin" },
    ])
        assert.throws(() => keyInput(value));
});
