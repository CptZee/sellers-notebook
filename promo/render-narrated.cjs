const path = require("node:path"),
    fs = require("node:fs"),
    { spawnSync } = require("node:child_process");
const { bundle } = require("@remotion/bundler"),
    { selectComposition, renderMedia, renderStill } = require("@remotion/renderer");
const root = __dirname,
    dir = path.join(root, "dist"),
    browserExecutable = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
function run(cmd, args) {
    const r = spawnSync(cmd, args, { encoding: "utf8" });
    if (r.status !== 0) throw Error(r.stderr);
    return r;
}
(async () => {
    const crypto = require("node:crypto");
    const operationsOnly = process.argv.includes("--operations-only");
    const preserved = [
        "sellers-notebook-landing-loop.mp4",
        "sellers-notebook-social-vertical.mp4",
        "sellers-notebook-expenses-suppliers-vertical.mp4",
        ...(operationsOnly ? ["sellers-notebook-social-narrated.mp4"] : []),
    ];
    const hash = (name) =>
        crypto
            .createHash("sha256")
            .update(fs.readFileSync(path.join(dir, name)))
            .digest("hex");
    const originalHashes = Object.fromEntries(preserved.map((n) => [n, hash(n)]));
    const serveUrl = await bundle({
        entryPoint: path.join(root, "src/index.jsx"),
        publicDir: path.join(root, "public"),
    });
    const results = operationsOnly
        ? JSON.parse(fs.readFileSync(path.join(dir, "narrated-verification.json"))).filter(
              (item) => item.name !== "sellers-notebook-expenses-suppliers-narrated",
          )
        : [];
    for (const [id, name] of operationsOnly
        ? [["NarratedOperations", "operations"]]
        : [
              ["NarratedGeneral", "general"],
              ["NarratedOperations", "operations"],
          ]) {
        const composition = await selectComposition({ serveUrl, id, browserExecutable });
        for (const frame of [0, 100, 180, 280, 400])
            await renderStill({
                serveUrl,
                composition,
                browserExecutable,
                frame,
                output: path.join(dir, `narrated-${name}-${frame}.png`),
            });
        const master = path.join(dir, `narrated-${name}-master.mp4`);
        let last = -1;
        await renderMedia({
            serveUrl,
            composition,
            browserExecutable,
            codec: "h264",
            crf: 16,
            pixelFormat: "yuv420p",
            outputLocation: master,
            concurrency: 3,
            onProgress: (p) => {
                const n = Math.floor(p.progress * 5);
                if (n !== last) {
                    last = n;
                    console.log(id, n * 20 + "%");
                }
            },
        });
        const stem =
            name === "general"
                ? "sellers-notebook-social-narrated"
                : "sellers-notebook-expenses-suppliers-narrated";
        const output = path.join(dir, stem + ".mp4");
        const video = [
            "-vf",
            "scale=in_range=full:out_range=tv:out_color_matrix=bt709",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-b:v",
            "2050k",
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
            path.join(dir, "narrated-" + name + "-pass"),
        ];
        run("ffmpeg", ["-y", "-i", master, ...video, "-an", "-pass", "1", "-f", "null", "NUL"]);
        run("ffmpeg", [
            "-y",
            "-i",
            master,
            "-i",
            path.join(root, "audio", `${name}-mix.wav`),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            ...video,
            "-pass",
            "2",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-t",
            "15",
            "-movflags",
            "+faststart",
            output,
        ]);
        fs.copyFileSync(
            path.join(root, "audio", `${name}-narration.srt`),
            path.join(dir, stem + ".srt"),
        );
        const info = JSON.parse(
            run("ffprobe", [
                "-v",
                "error",
                "-count_frames",
                "-show_entries",
                "stream=codec_name,width,height,pix_fmt,avg_frame_rate,nb_read_frames,sample_rate,channels:format=duration,size",
                "-of",
                "json",
                output,
            ]).stdout,
        );
        const v = info.streams.find((s) => s.codec_name === "h264"),
            a = info.streams.find((s) => s.codec_name === "aac");
        if (
            !v ||
            v.width !== 1080 ||
            v.height !== 1920 ||
            v.nb_read_frames !== "450" ||
            v.pix_fmt !== "yuv420p" ||
            !a ||
            a.channels !== 2 ||
            +info.format.duration !== 15 ||
            +info.format.size >= 5000000
        )
            throw Error("Export verification failed: " + JSON.stringify(info));
        const bytes = fs.readFileSync(output);
        if (bytes.indexOf(Buffer.from("moov")) > bytes.indexOf(Buffer.from("mdat")))
            throw Error("Faststart missing");
        const decoded = run("ffmpeg", ["-v", "error", "-i", output, "-f", "null", "NUL"]);
        if (decoded.stderr.trim()) throw Error(decoded.stderr);
        results.push({
            name: stem,
            ...info,
            faststart: true,
            fullDecode: "passed",
            voice: "en-US-JennyNeural",
            music: "Original A Fresh Page, 95 BPM",
            originalVideosPreserved: preserved.every((n) => hash(n) === originalHashes[n]),
        });
        fs.writeFileSync(
            path.join(dir, "narrated-verification.json"),
            JSON.stringify(results, null, 2),
        );
        console.log("VERIFIED", stem, info.format.size);
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
