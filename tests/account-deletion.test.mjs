import test from "node:test";
import assert from "node:assert/strict";
import {
    resumeHash,
    matchesResume,
    validDeletionRequest,
    deletionConfig,
    ownsDeletionKey,
} from "../lib/account-deletion.mjs";
const token = "a".repeat(43);
test("deletion requires a password, exact confirmation and explicit acknowledgement", () => {
    const valid = { password: "current-password", confirmation: "DELETE", acknowledged: true };
    assert.ok(validDeletionRequest(valid));
    for (const invalid of [
        null,
        {},
        [],
        { ...valid, password: "" },
        { ...valid, password: "a".repeat(1025) },
        { ...valid, confirmation: "delete" },
        { ...valid, acknowledged: false },
        { ...valid, owner: "another-user" },
    ])
        assert.equal(validDeletionRequest(invalid), false);
});
test("resume credentials are hashed and compared without accepting malformed values", () => {
    const hash = resumeHash(token);
    assert.notEqual(hash, token);
    assert.ok(matchesResume(token, hash));
    for (const value of ["", null, token + "a", "b".repeat(43), "a".repeat(42)])
        assert.equal(matchesResume(value, hash), false);
    assert.equal(matchesResume(token, "not-a-hash"), false);
});
test("identity deletion uses only a fixed Neon management origin with scoped configuration", () => {
    assert.equal(deletionConfig({}), null);
    const env = {
        NEON_ACCOUNT_DELETION_API_KEY: "fixture-project-scoped-key",
        NEON_ACCOUNT_DELETION_PROJECT_ID: "test-project",
        NEON_ACCOUNT_DELETION_BRANCH_ID: "br-test",
    };
    assert.equal(
        deletionConfig(env).base,
        "https://console.neon.tech/api/v2/projects/test-project/branches/br-test/auth",
    );
    assert.equal(deletionConfig({ ...env, NEON_ACCOUNT_DELETION_BRANCH_ID: "../another" }), null);
});
test("file cleanup stays inside the exact owner prefixes", () => {
    for (const key of ["notebooks/user-a/document", "profiles/user-a/avatar.webp"])
        assert.ok(ownsDeletionKey("user-a", key));
    for (const key of [
        "notebooks/user-ab/document",
        "profiles/user-b/avatar.webp",
        "notebooks/user-a/../user-b/document",
        "notebooks/user-a/../../document",
        "notebooks/user-a/\\other",
    ])
        assert.equal(ownsDeletionKey("user-a", key), false);
});
