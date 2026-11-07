const fs = require("node:fs"),
    path = require("node:path"),
    http = require("node:http"),
    crypto = require("node:crypto");
const {
    fields,
    groups,
    readValues,
    patchEnv,
    validate,
    randomValue,
} = require("./setup/config.cjs");
const { migrateLegacyEnv, requireLocalSetup } = require("./setup/environment-file.cjs");
async function startSetup({
    root = process.cwd(),
    port = 0,
    onReady = () => {},
    shutdown = true,
} = {}) {
    requireLocalSetup();
    root = path.resolve(root);
    migrateLegacyEnv(root);
    const directory = path.join(root, ".setup"),
        complete = path.join(directory, "completed.json"),
        running = path.join(directory, "running.json");
    if (fs.existsSync(complete))
        throw Error("Installation setup is already complete. It cannot be opened again.");
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const acquire = () => {
        try {
            return fs.openSync(running, "wx", 0o600);
        } catch (error) {
            if (error.code !== "EEXIST") throw error;
            let pid;
            try {
                pid = JSON.parse(fs.readFileSync(running, "utf8")).pid;
            } catch {
                throw Error(
                    "An installation lock exists. Inspect .setup/running.json on the server before continuing.",
                );
            }
            if (!Number.isSafeInteger(pid) || pid <= 0) throw Error("Invalid installation lock.");
            try {
                process.kill(pid, 0);
                throw Error(
                    "Installation setup is already running. Use its existing terminal link.",
                );
            } catch (error) {
                if (error.code !== "ESRCH") throw error;
            }
            fs.unlinkSync(running);
            return fs.openSync(running, "wx", 0o600);
        }
    };
    let server,
        finished = false,
        saving = false;
    const token = crypto.randomBytes(32).toString("base64url"),
        slug = crypto.randomBytes(18).toString("hex"),
        base = "/install/" + slug,
        list = fields(root),
        existing = readValues(root, list),
        known = new Map(list.map((f) => [f.key, f]));
    const release = () => {
        try {
            if (JSON.parse(fs.readFileSync(running, "utf8")).pid === process.pid)
                fs.unlinkSync(running);
        } catch {}
    };
    const authorized = (req) => {
        const value = Buffer.from(req.headers.authorization || ""),
            expected = Buffer.from("Bearer " + token);
        return value.length === expected.length && crypto.timingSafeEqual(value, expected);
    };
    const nonce = crypto.randomBytes(18).toString("base64");
    const html = fs
        .readFileSync(path.join(__dirname, "setup/index.html"), "utf8")
        .replaceAll("__NONCE__", nonce);
    const fd = acquire();
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
    fs.closeSync(fd);
    if (fs.existsSync(complete)) {
        release();
        throw Error("Installation setup is already complete.");
    }
    server = http.createServer(async (req, res) => {
        const origin = `http://127.0.0.1:${server.address().port}`;
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader(
            "Content-Security-Policy",
            `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
        );
        const send = (status, data) => {
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data));
        };
        if (req.headers.host !== new URL(origin).host || finished || fs.existsSync(complete)) {
            res.writeHead(404);
            res.end();
            return;
        }
        if (req.url === base && req.method === "GET") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(html);
            return;
        }
        if (req.url !== base + "/configuration" || !authorized(req)) {
            res.writeHead(404);
            res.end();
            return;
        }
        if (req.method === "GET") {
            send(200, {
                groups,
                fields: list.map((f) => ({
                    ...f,
                    configured: !!existing[f.key],
                    external: Object.hasOwn(process.env, f.key),
                })),
            });
            return;
        }
        if (req.method !== "POST") {
            send(405, { error: "Method not allowed." });
            return;
        }
        if (req.headers.origin !== origin || req.headers["content-type"] !== "application/json") {
            send(403, { error: "Use the local setup page." });
            return;
        }
        if (saving) {
            send(409, { error: "Setup is already being saved." });
            return;
        }
        saving = true;
        try {
            let bytes = 0,
                chunks = [];
            for await (const part of req) {
                bytes += part.length;
                if (bytes > 131072) {
                    send(413, { error: "Configuration is too large." });
                    saving = false;
                    return;
                }
                chunks.push(part);
            }
            let body;
            try {
                body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            } catch {
                send(400, { error: "Invalid configuration." });
                saving = false;
                return;
            }
            if (
                !body ||
                Object.keys(body).sort().join(",") !== "acknowledged,generate,values" ||
                body.acknowledged !== true ||
                !body.values ||
                typeof body.values !== "object" ||
                Array.isArray(body.values) ||
                !Array.isArray(body.generate)
            ) {
                send(400, { error: "Review and acknowledge the one-time setup." });
                saving = false;
                return;
            }
            const changes = {};
            for (const [key, value] of Object.entries(body.values)) {
                if (
                    !known.has(key) ||
                    typeof value !== "string" ||
                    value.length > 8192 ||
                    Object.hasOwn(process.env, key)
                )
                    throw Error("Invalid setting.");
                if (value !== "") changes[key] = value;
            }
            for (const key of body.generate) {
                if (
                    !known.get(key)?.generate ||
                    Object.hasOwn(process.env, key) ||
                    existing[key] ||
                    changes[key]
                )
                    throw Error("Only missing app-owned secrets can be generated.");
                changes[key] = randomValue(key);
            }
            for (const f of list)
                if (!existing[f.key] && changes[f.key] === undefined && f.defaultValue)
                    changes[f.key] = f.defaultValue;
            const values = { ...existing, ...changes },
                errors = validate(values, list);
            if (Object.keys(errors).length) {
                send(422, { error: "Check the highlighted fields.", fields: errors });
                saving = false;
                return;
            }
            const destination = path.join(root, ".env"),
                raw = fs.existsSync(destination) ? fs.readFileSync(destination, "utf8") : "",
                updated = patchEnv(raw, changes),
                staging = path.join(directory, "environment.tmp");
            if (fs.existsSync(staging)) fs.unlinkSync(staging);
            fs.writeFileSync(staging, updated, { mode: 0o600, flag: "wx" });
            fs.chmodSync(staging, 0o600);
            fs.renameSync(staging, destination);
            fs.chmodSync(destination, 0o600);
            // The marker is independent of the build folder and must persist across deployments.
            fs.writeFileSync(
                complete,
                JSON.stringify({ completedAt: new Date().toISOString(), version: 1 }) + "\n",
                { mode: 0o600, flag: "wx" },
            );
            finished = true;
            release();
            send(200, {
                complete: true,
                message:
                    "Settings saved. This installer is now permanently closed. Start or restart the app to load them. For a fresh database, apply the documented migrations before using the notebook.",
            });
            if (shutdown) setTimeout(() => server.close(), 250).unref();
        } catch {
            send(400, {
                error: "Could not save setup. Existing values are not displayed. Check the local configuration and try again.",
            });
            saving = false;
        }
    });
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    server.on("close", release);
    try {
        await new Promise((resolve, reject) => {
            server.once("error", reject);
            server.listen(port, "127.0.0.1", resolve);
        });
    } catch (error) {
        release();
        throw error;
    }
    const url = `http://127.0.0.1:${server.address().port}${base}#${token}`;
    onReady({ url, server });
    return { server, url, release };
}
async function main() {
    const args = process.argv.slice(2),
        root = process.cwd(),
        complete = fs.existsSync(path.join(root, ".setup/completed.json"));
    if (args.includes("--check")) {
        const values = readValues(root, fields(root));
        if (Object.keys(validate(values, fields(root))).length)
            throw Error(
                "Installation configuration is incomplete. Run npm run setup on the installation machine before building.",
            );
        return;
    }
    requireLocalSetup();
    if (migrateLegacyEnv(root)) console.log("Preserved the existing configuration in .env.");
    if (complete) {
        if (args.includes("--ensure")) return;
        throw Error("Installation setup is already complete and cannot be reopened.");
    }
    const result = await startSetup({
        onReady: ({ url }) => {
            console.log(
                "\nPrivate installation setup — open this link on this machine:\n\n" +
                    url +
                    "\n\nThis link works only for this setup session. Do not share it.\n",
            );
        },
    });
    const stop = () => {
        result.server.close();
        result.release();
        process.exit(1);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    await new Promise((resolve) => result.server.once("close", resolve));
    if (!fs.existsSync(path.join(root, ".setup/completed.json"))) process.exitCode = 1;
}
module.exports = { startSetup };
if (require.main === module)
    main().catch((error) => {
        if (["ENV_FILE_CONFLICT", "LOCAL_SETUP_REQUIRED"].includes(error.code)) {
            console.error(error.message);
            process.exitCode = 1;
            return;
        }
        console.error(
            "Setup could not start. It may already be completed/running, or installation configuration is incomplete. Run npm run setup from the installation directory; keep .setup on persistent private storage.",
        );
        process.exitCode = 1;
    });
