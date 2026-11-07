const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { bundle } = require("@remotion/bundler");
const { selectComposition, renderMedia, renderStill } = require("@remotion/renderer");
const dir = path.join(__dirname, "dist");
const browserExecutable = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
(async () => {
    const serveUrl = await bundle({
        entryPoint: path.resolve(__dirname, "src/index.jsx"),
        publicDir: path.resolve(__dirname, "public"),
    });
    const results = [];
    const jobs = process.argv.includes("--operations")
        ? [
              ["LandingLoop", "landing-loop", 1920, 1080],
              ["OperationsPromo", "expenses-suppliers-vertical", 1080, 1920],
          ]
        : [
              ["LandingLoop", "landing-loop", 1920, 1080],
              ["SocialVertical", "social-vertical", 1080, 1920],
          ];
    for (const [id, name, width, height] of jobs) {
        const composition = await selectComposition({ serveUrl, id, browserExecutable });
        for (const frame of id === "OperationsPromo"
            ? [0, 100, 225, 345, 449]
            : [0, 190, 250, 320, 360, 449])
            await renderStill({
                serveUrl,
                composition,
                browserExecutable,
                frame,
                output: path.join(dir, `${name}-${frame}.png`),
            });
        const posterName =
            name === "landing-loop"
                ? "sellers-notebook-landing-poster.jpg"
                : id === "OperationsPromo"
                  ? "sellers-notebook-expenses-suppliers-cover.jpg"
                  : "sellers-notebook-social-cover.jpg";
        const poster = spawnSync(
            "ffmpeg",
            [
                "-y",
                "-i",
                path.join(dir, `${name}-0.png`),
                "-frames:v",
                "1",
                "-q:v",
                "2",
                path.join(dir, posterName),
            ],
            { encoding: "utf8" },
        );
        if (poster.status !== 0) throw Error(poster.stderr);
        if (
            name === "landing-loop" &&
            !fs
                .readFileSync(path.join(dir, `${name}-0.png`))
                .equals(fs.readFileSync(path.join(dir, `${name}-449.png`)))
        )
            throw Error("Landing loop endpoint mismatch");
        let last = -1;
        await renderMedia({
            serveUrl,
            composition,
            browserExecutable,
            codec: "h264",
            crf: 16,
            pixelFormat: "yuv420p",
            outputLocation: path.join(dir, `${name}-master.mp4`),
            concurrency: 3,
            onProgress: (p) => {
                const n = Math.floor(p.progress * 5);
                if (n !== last) {
                    last = n;
                    console.log(id, n * 20 + "%");
                }
            },
        });
        const output = path.join(dir, `sellers-notebook-${name}.mp4`);
        const args = [
            "-y",
            "-i",
            path.join(dir, `${name}-master.mp4`),
            "-an",
            "-vf",
            "scale=in_range=full:out_range=tv:out_color_matrix=bt709",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-b:v",
            "2100k",
            "-pix_fmt",
            "yuv420p",
            "-color_range",
            "tv",
            "-colorspace",
            "bt709",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-profile:v",
            "high",
            "-level",
            "4.1",
            "-r",
            "30",
            "-passlogfile",
            path.join(dir, name + "-pass"),
        ];
        for (const pass of [1, 2]) {
            const r = spawnSync(
                "ffmpeg",
                [
                    ...args,
                    "-pass",
                    String(pass),
                    ...(pass === 1 ? ["-f", "null", "NUL"] : ["-movflags", "+faststart", output]),
                ],
                { encoding: "utf8" },
            );
            if (r.status !== 0) throw Error(r.stderr);
        }
        const r = spawnSync(
            "ffprobe",
            [
                "-v",
                "error",
                "-count_frames",
                "-show_entries",
                "stream=codec_name,width,height,pix_fmt,avg_frame_rate,nb_read_frames:format=duration,size",
                "-of",
                "json",
                output,
            ],
            { encoding: "utf8" },
        );
        if (r.status !== 0) throw Error(r.stderr);
        const info = JSON.parse(r.stdout);
        const s = info.streams[0];
        if (
            s.width !== width ||
            s.height !== height ||
            s.pix_fmt !== "yuv420p" ||
            s.nb_read_frames !== "450" ||
            +info.format.duration !== 15 ||
            +info.format.size >= 5000000
        )
            throw Error(r.stdout);
        const bytes = fs.readFileSync(output);
        if (bytes.indexOf(Buffer.from("moov")) > bytes.indexOf(Buffer.from("mdat")))
            throw Error("Faststart missing");
        const decode = spawnSync("ffmpeg", ["-v", "error", "-i", output, "-f", "null", "NUL"], {
            encoding: "utf8",
        });
        if (decode.status !== 0 || decode.stderr.trim()) throw Error(decode.stderr);
        results.push({ name, ...info, faststart: true, decode: "passed" });
        fs.writeFileSync(
            path.join(
                dir,
                process.argv.includes("--operations")
                    ? "operations-verification.json"
                    : "variants-verification.json",
            ),
            JSON.stringify(results, null, 2),
        );
        console.log("VERIFIED", name, info.format.size);
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
