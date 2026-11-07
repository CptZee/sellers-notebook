const fs = require("node:fs"),
    path = require("node:path"),
    { spawnSync } = require("node:child_process");
const dir = path.join(__dirname, "audio");
function run(args) {
    const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
    if (r.status !== 0) throw Error(r.stderr);
    return r.stderr;
}
for (const name of process.argv.includes("--operations-only")
    ? ["operations"]
    : ["general", "operations"]) {
    const speed = name === "operations" ? 1.1 : 1;
    const filter = `[0:a]atempo=${speed},highpass=f=85,lowpass=f=11500,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000,aformat=channel_layouts=stereo,adelay=150|150,apad,atrim=duration=15,asplit=2[v][key];[1:a]loudnorm=I=-27:TP=-8:LRA=7,aresample=48000[m];[m][key]sidechaincompress=threshold=0.035:ratio=5:attack=15:release=350[duck];[2:a]volume=0.65[fx];[v][duck][fx]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.9:level=0,loudnorm=I=-16:TP=-1.5:LRA=8,aresample=48000,afade=t=out:st=14.65:d=0.35,atrim=duration=15[out]`;
    run([
        "-y",
        "-i",
        path.join(dir, `${name}-voice.mp3`),
        "-i",
        path.join(dir, "fresh-page-original-music.wav"),
        "-i",
        path.join(dir, `${name}-paper-fx.wav`),
        "-filter_complex",
        filter,
        "-map",
        "[out]",
        "-c:a",
        "pcm_s16le",
        path.join(dir, `${name}-mix.wav`),
    ]);
    // Normalize the final sample count after filter look-ahead latency.
    const padded = path.join(dir, `${name}-mix-padded.wav`);
    run([
        "-y",
        "-i",
        path.join(dir, `${name}-mix.wav`),
        "-af",
        "asetpts=PTS-STARTPTS,apad=whole_dur=15,afade=t=out:st=14.3:d=0.45",
        "-t",
        "15",
        "-c:a",
        "pcm_s16le",
        padded,
    ]);
    fs.renameSync(padded, path.join(dir, `${name}-mix.wav`));
    require("./write-narration-subtitles.cjs")(name, speed);
    const log = run([
        "-hide_banner",
        "-i",
        path.join(dir, `${name}-mix.wav`),
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=8:print_format=json",
        "-f",
        "null",
        "NUL",
    ]);
    fs.writeFileSync(path.join(dir, `${name}-loudness.txt`), log);
    console.log(name, "mix complete", log.slice(log.lastIndexOf("{")));
}
