// Generate DDL from the Drizzle schema; data conversion/drop is appended separately.
const fs = require("node:fs"),
    path = require("node:path"),
    Module = require("node:module"),
    esbuild = require("esbuild");
(async () => {
    const filename = path.resolve("db/schema.ts"),
        mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(
        esbuild.transformSync(fs.readFileSync(filename, "utf8"), {
            loader: "ts",
            format: "cjs",
            target: "es2022",
        }).code,
        filename,
    );
    const { generateDrizzleJson, generateMigration } = require("drizzle-kit/api"),
        previous = JSON.parse(fs.readFileSync("db/migrations/meta/0003_snapshot.json", "utf8")),
        current = generateDrizzleJson(mod.exports, previous.id),
        diff = structuredClone(previous);
    // Prevent an interactive rename prompt: this is deliberately a new schema,
    // and document is explicitly dropped only after migration reconciliation.
    delete diff.tables["public.seller_notebooks"].columns.document;
    const statements = await generateMigration(diff, current);
    fs.writeFileSync(
        "db/migrations/0004_relational_notebooks.sql",
        statements.join("\n--> statement-breakpoint\n") + "\n",
    );
    fs.writeFileSync(
        "db/migrations/meta/0004_snapshot.json",
        JSON.stringify(current, null, 2) + "\n",
    );
    const journal = JSON.parse(fs.readFileSync("db/migrations/meta/_journal.json", "utf8"));
    if (!journal.entries.some((entry) => entry.idx === 4)) {
        journal.entries.push({
            idx: 4,
            version: "7",
            when: Date.now(),
            tag: "0004_relational_notebooks",
            breakpoints: true,
        });
        fs.writeFileSync(
            "db/migrations/meta/_journal.json",
            JSON.stringify(journal, null, 2) + "\n",
        );
    }
    console.log("Generated relational Drizzle DDL and schema snapshot.");
})().catch((error) => {
    console.error(String(error.message).split("\n")[0]);
    process.exitCode = 1;
});
