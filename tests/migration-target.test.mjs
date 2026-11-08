import test from "node:test";
import assert from "node:assert/strict";
import targets from "../scripts/migration-target.cjs";
const production = "postgresql://user:password@ep-prod.example.com/neondb";
test("test migrations reject production endpoints including pooled aliases and other database names", () => {
    for (const target of [production, production.replace("neondb", "other")])
        assert.throws(
            () => targets.assertTestDatabaseTarget(target, [production]),
            /matches a production/,
        );
    assert.throws(
        () =>
            targets.assertTestDatabaseTarget(production, [
                production.replace("ep-prod.", "ep-prod-pooler."),
            ]),
        /matches a production/,
    );
});
test("test migrations require a verified distinct direct endpoint", () => {
    const distinct = production.replace("ep-prod", "ep-test");
    assert.doesNotThrow(() => targets.assertTestDatabaseTarget(distinct, [production]));
    assert.throws(
        () => targets.assertTestDatabaseTarget(distinct, []),
        /production connection is missing/,
    );
    assert.throws(
        () =>
            targets.assertTestDatabaseTarget(distinct.replace("ep-test.", "ep-test-pooler."), [
                production,
            ]),
        /unpooled/,
    );
    assert.throws(() => targets.assertTestDatabaseTarget("invalid", [production]));
});
