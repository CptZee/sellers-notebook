const fs = require("node:fs"),
    { spawn } = require("node:child_process");
require("@next/env").loadEnvConfig(process.cwd());
const content = fs.readFileSync(".env.migration-test", "utf8");
for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED"])
    process.env[key] = content.match(new RegExp("^" + key + "=(.+)$", "m"))[1].trim();
const [command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
