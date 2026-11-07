const fs = require("node:fs"),
    path = require("node:path"),
    crypto = require("node:crypto"),
    { execFileSync } = require("node:child_process");
const groups = [
    [
        "core",
        "Your notebook",
        "Connect the database and sign-in service provisioned for this installation.",
    ],
    ["storage", "Private file storage", "Credentials for the private assets bucket."],
    ["realtime", "Live sync", "Use the URLs and secrets provided by Neon."],
    [
        "marketplaces",
        "Marketplace connections",
        "Optional. Leave unused integrations blank and import switches off.",
    ],
    [
        "operations",
        "Operations & safety",
        "Optional readiness checks, worker settings and account deletion.",
    ],
];
const required = new Set([
    "DATABASE_URL",
    "DATABASE_URL_UNPOOLED",
    "NEON_AUTH_BASE_URL",
    "NEON_AUTH_COOKIE_SECRET",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_ENDPOINT_URL_S3",
    "AWS_REGION",
    "NEON_REALTIME_URL",
    "NEON_REALTIME_SECRET",
]);
const generated = new Set([
    "NEON_AUTH_COOKIE_SECRET",
    "SHOPEE_TOKEN_ENCRYPTION_KEY",
    "MARKETPLACE_TOKEN_ENCRYPTION_KEY",
    "MARKETPLACE_SYNC_SECRET",
    "HEALTH_CHECK_SECRET",
]);
const labels = {
    DATABASE_URL: "Database connection (pooled)",
    DATABASE_URL_UNPOOLED: "Database connection (direct)",
    NEON_BRANCH: "Neon branch",
    NEON_AUTH_BASE_URL: "Sign-in service URL",
    NEON_AUTH_JWKS_URL: "Sign-in discovery URL",
    NEON_AUTH_COOKIE_SECRET: "Session protection secret",
    AWS_ACCESS_KEY_ID: "Storage access key ID",
    AWS_SECRET_ACCESS_KEY: "Storage secret access key",
    AWS_ENDPOINT_URL_S3: "Storage endpoint URL",
    AWS_REGION: "Storage region",
    NEON_REALTIME_URL: "Live sync URL",
    NEON_REALTIME_SECRET: "Live sync secret",
};
function fields(root) {
    let note = [];
    return fs
        .readFileSync(path.join(root, ".env.example"), "utf8")
        .split(/\r?\n/)
        .flatMap((line) => {
            if (line.startsWith("#")) {
                note.push(line.replace(/^#\s?/, ""));
                return [];
            }
            const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
            if (!match) {
                if (!line.trim()) note = [];
                return [];
            }
            const [_, key, value] = match;
            const group = key.startsWith("AWS_")
                ? "storage"
                : key.startsWith("NEON_REALTIME_")
                  ? "realtime"
                  : /^(SHOPEE_|LAZADA_|TIKTOK_|MARKETPLACE_TOKEN)/.test(key)
                    ? "marketplaces"
                    : /^(HEALTH_|ACCOUNT_|NEON_ACCOUNT_|MARKETPLACE_SYNC_)/.test(key)
                      ? "operations"
                      : "core";
            const options = key.endsWith("_ENABLED")
                ? ["false", "true"]
                : key === "SHOPEE_ENVIRONMENT"
                  ? ["sandbox", "production"]
                  : null;
            const field = {
                key,
                group,
                label: labels[key] || key.toLowerCase().replaceAll("_", " "),
                help: note.join(" "),
                required: required.has(key),
                generate: generated.has(key),
                secret:
                    key.startsWith("DATABASE_") ||
                    (!options &&
                        !/(URL|URI|ORIGIN|REGION|BRANCH|PROJECT_ID|BRANCH_ID|PARTNER_ID|SERVICE_ID|ACCOUNT_IDS)$/.test(
                            key,
                        )),
                options,
                defaultValue: value,
            };
            note = [];
            return [field];
        });
}
function readValues(root, list) {
    // Read exactly as Next does, in a separate process so the wizard never mutates its own environment.
    const code =
        "const {loadEnvConfig}=require(" +
        JSON.stringify(require.resolve("@next/env")) +
        ");loadEnvConfig(process.argv[1],true,{info(){},error(){}},true);const keys=JSON.parse(process.argv[2]);process.stdout.write(JSON.stringify(Object.fromEntries(keys.map(k=>[k,process.env[k]||'']))));";
    return JSON.parse(
        execFileSync(process.execPath, ["-e", code, root, JSON.stringify(list.map((f) => f.key))], {
            cwd: root,
            env: process.env,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            maxBuffer: 1024 * 1024,
        }).toString(),
    );
}
function serialize(value) {
    if (/[\r\n\0]/.test(value)) throw Error("Use single-line values.");
    const quote = !value.includes("'")
        ? "'"
        : !value.includes('"')
          ? '"'
          : !value.includes("`")
            ? "`"
            : null;
    if (!quote) throw Error("This value contains unsupported quote characters.");
    return quote + value.replaceAll("$", "\\$") + quote;
}
function patchEnv(raw, changes) {
    let result = raw;
    for (const [key, value] of Object.entries(changes)) {
        const encoded = serialize(value),
            pattern = new RegExp("^(?:export\\s+)?" + key + "\\s*=.*$", "gm");
        const matches = [...result.matchAll(pattern)];
        if (matches.length > 1)
            throw Error("Duplicate setting " + key + " must be resolved before setup.");
        if (matches.length) result = result.replace(pattern, () => key + "=" + encoded);
        else result += (result && !result.endsWith("\n") ? "\n" : "") + key + "=" + encoded + "\n";
    }
    return result;
}
function validate(values, list) {
    const errors = {};
    for (const f of list) {
        const v = values[f.key] || "";
        if (f.required && !v) errors[f.key] = "Required to run the notebook.";
        if (v && (/[\r\n\0]/.test(v) || v.length > 8192))
            errors[f.key] = "Use a single-line value of at most 8,192 characters.";
        if (v && f.options && !f.options.includes(v))
            errors[f.key] = "Choose one of the listed options.";
        if (v && (f.key.startsWith("DATABASE_") || /(URL|URI|ORIGIN)$/.test(f.key))) {
            try {
                const url = new URL(v),
                    db = f.key.startsWith("DATABASE_");
                if (
                    db
                        ? !["postgres:", "postgresql:"].includes(url.protocol)
                        : !["https:", "wss:"].includes(url.protocol) &&
                          !(
                              ["http:", "ws:"].includes(url.protocol) &&
                              ["localhost", "127.0.0.1"].includes(url.hostname)
                          )
                )
                    throw Error();
                if (!db && (url.username || url.password)) throw Error();
                if (f.key.endsWith("_ORIGIN") && (url.pathname !== "/" || url.search || url.hash))
                    throw Error();
            } catch {
                errors[f.key] = "Enter a valid secure URL (or localhost for local testing).";
            }
        }
        if (v && generated.has(f.key)) {
            if (f.key.endsWith("_ENCRYPTION_KEY")) {
                if (!/^[A-Za-z0-9+/]{43}=$/.test(v) || Buffer.from(v, "base64").length !== 32)
                    errors[f.key] = "Use a 32-byte base64 key or Generate.";
            } else if (v.length < 32) errors[f.key] = "Use at least 32 characters or Generate.";
        }
    }
    try {
        if (values.DATABASE_URL && values.DATABASE_URL_UNPOOLED) {
            const a = new URL(values.DATABASE_URL),
                b = new URL(values.DATABASE_URL_UNPOOLED);
            if (
                a.hostname.replace("-pooler.", ".") !== b.hostname.replace("-pooler.", ".") ||
                a.pathname !== b.pathname
            )
                errors.DATABASE_URL_UNPOOLED =
                    "Use the same database and project as the pooled connection.";
        }
    } catch {}
    const need = (flag, keys) => {
        if (values[flag] === "true")
            for (const key of keys)
                if (!values[key]) errors[key] = "Required when this feature is enabled.";
    };
    need("MARKETPLACE_SYNC_ENABLED", ["MARKETPLACE_SYNC_SECRET"]);
    need("LAZADA_ORDER_IMPORT_ENABLED", [
        "LAZADA_APP_KEY",
        "LAZADA_APP_SECRET",
        "LAZADA_REDIRECT_URI",
        "MARKETPLACE_TOKEN_ENCRYPTION_KEY",
    ]);
    need("TIKTOK_SHOP_ORDER_IMPORT_ENABLED", [
        "TIKTOK_SHOP_APP_KEY",
        "TIKTOK_SHOP_APP_SECRET",
        "TIKTOK_SHOP_REDIRECT_URI",
        "MARKETPLACE_TOKEN_ENCRYPTION_KEY",
    ]);
    need("ACCOUNT_DELETION_ENABLED", [
        "NEON_ACCOUNT_DELETION_API_KEY",
        "NEON_ACCOUNT_DELETION_PROJECT_ID",
        "NEON_ACCOUNT_DELETION_BRANCH_ID",
    ]);
    return errors;
}
function randomValue(key) {
    return crypto.randomBytes(32).toString(key.endsWith("_ENCRYPTION_KEY") ? "base64" : "hex");
}
module.exports = { fields, groups, readValues, serialize, patchEnv, validate, randomValue };
