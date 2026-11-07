// Enable deletion only in this temporary verification server; leave .env unchanged.
const { spawn } = require("node:child_process"),
    path = require("node:path");
const base = "http://127.0.0.1:3002";
(async () => {
    let server;
    try {
        try {
            await fetch(base + "/api/health", { signal: AbortSignal.timeout(500) });
            throw Error("Port 3002 is occupied. Stop that server first.");
        } catch (error) {
            if (error.message.includes("occupied")) throw error;
        }
        const env = {
            ...process.env,
            ACCOUNT_DELETION_ENABLED: "true",
            ACCOUNT_DELETION_E2E_BASE_URL: base,
        };
        server = spawn(
            process.execPath,
            [
                path.resolve("node_modules/next/dist/bin/next"),
                "start",
                "--hostname",
                "127.0.0.1",
                "--port",
                "3002",
            ],
            { env, windowsHide: true, stdio: "ignore" },
        );
        server.on("error", () => {});
        let ready = false;
        for (let i = 0; i < 100; i++) {
            if (server.exitCode !== null) throw Error("Verification server failed to start.");
            try {
                if ((await fetch(base + "/api/health")).ok) {
                    ready = true;
                    break;
                }
            } catch {}
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (!ready) throw Error("Verification server did not start.");
        const test = spawn(process.execPath, ["scripts/verify-account-deletion.cjs"], {
            env,
            windowsHide: true,
            stdio: "inherit",
        });
        process.exitCode = await new Promise((resolve, reject) => {
            test.on("exit", (code) => resolve(code ?? 1));
            test.on("error", reject);
        });
    } catch (error) {
        console.error("FAIL", String(error.message).split("\n")[0]);
        process.exitCode = 1;
    } finally {
        if (server && server.exitCode === null) {
            server.kill();
            await new Promise((resolve) => server.once("exit", resolve));
        }
    }
})();
