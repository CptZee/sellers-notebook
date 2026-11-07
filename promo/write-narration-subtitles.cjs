const fs = require("node:fs"),
    path = require("node:path");
const cues = {
    general: [
        [0, 6, "Give your business a fresh page."],
        [6, 10, "Track products, manage orders,"],
        [10, 15, "and see your numbers clearly."],
        [15, 21, "Find prices with room to grow—"],
        [21, 25, "all in Seller’s Notebook."],
        [25, 29, "Start your notebook today."],
    ],
    operations: [
        [0, 5, "The little costs count too."],
        [5, 7, "Organize expenses,"],
        [7, 11, "keep supplier details close,"],
        [11, 17, "and stay ahead of overdue deliveries."],
        [17, 19, "Less scattered."],
        [19, 21, "More settled."],
        [21, 23, "Seller’s Notebook—"],
        [23, 30, "a little clarity for your growing business."],
    ],
};
function stamp(t) {
    let ms = Math.round(t * 1000);
    const h = Math.floor(ms / 3600000);
    ms %= 3600000;
    const m = Math.floor(ms / 60000);
    ms %= 60000;
    const s = Math.floor(ms / 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
function write(name, speed = name === "operations" ? 1.1 : 1) {
    const words = JSON.parse(fs.readFileSync(path.join(__dirname, "audio", `${name}-words.json`)));
    const srt = cues[name]
        .map(
            ([start, end, text], i) =>
                `${i + 1}\n${stamp(words[start].offset / 1e7 / speed + 0.15)} --> ${stamp((words[end - 1].offset + words[end - 1].duration) / 1e7 / speed + 0.15)}\n${text}\n`,
        )
        .join("\n");
    fs.writeFileSync(path.join(__dirname, "audio", `${name}-narration.srt`), srt);
    const stem =
        name === "general"
            ? "sellers-notebook-social-narrated"
            : "sellers-notebook-expenses-suppliers-narrated";
    fs.writeFileSync(path.join(__dirname, "dist", stem + ".srt"), srt);
}
module.exports = write;
if (require.main === module) for (const name of Object.keys(cues)) write(name);
