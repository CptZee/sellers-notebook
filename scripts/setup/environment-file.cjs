const fs = require("node:fs");
const path = require("node:path");

function conflict() {
    const error = new Error(
        "Both .env and .env.local exist with different contents. Merge them privately into .env and remove .env.local before continuing; neither file was overwritten.",
    );
    error.code = "ENV_FILE_CONFLICT";
    return error;
}

/** Preserve the complete legacy file, including unknown settings and comments. */
function migrateLegacyEnv(root) {
    const legacy = path.join(root, ".env.local");
    const destination = path.join(root, ".env");
    if (!fs.existsSync(legacy)) return false;
    const original = fs.readFileSync(legacy);
    if (fs.existsSync(destination)) {
        if (!original.equals(fs.readFileSync(destination))) throw conflict();
    } else {
        try {
            fs.copyFileSync(legacy, destination, fs.constants.COPYFILE_EXCL);
            fs.chmodSync(destination, 0o600);
        } catch (error) {
            if (error.code === "EEXIST") throw conflict();
            throw error;
        }
    }
    if (
        !original.equals(fs.readFileSync(legacy)) ||
        !original.equals(fs.readFileSync(destination))
    ) {
        throw conflict();
    }
    fs.unlinkSync(legacy);
    return true;
}

function requireLocalSetup() {
    if (process.env.VERCEL !== "1") return;
    const error = new Error(
        "Run setup locally, then import .env into Vercel Project Settings → Environment Variables and redeploy. The interactive installer cannot persist configuration on Vercel.",
    );
    error.code = "LOCAL_SETUP_REQUIRED";
    throw error;
}

module.exports = { migrateLegacyEnv, requireLocalSetup };
