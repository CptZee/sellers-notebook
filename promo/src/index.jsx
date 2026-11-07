import React from "react";
import operationsWords from "../audio/operations-words.json";
import {
    AbsoluteFill,
    Composition,
    Sequence,
    OffthreadVideo,
    Freeze,
    registerRoot,
    staticFile,
    useCurrentFrame,
    interpolate,
    Easing,
} from "remotion";

const ink = "#364a3f",
    green = "#466d50",
    paper = "#faf9ef";
const shots = [
    {
        name: "landing",
        from: 0,
        duration: 68,
        title: "A fresh page for your business.",
        tag: "SELLER’S NOTEBOOK",
        n: "01",
    },
    {
        name: "overview",
        from: 60,
        duration: 98,
        title: "Your business, at a glance.",
        tag: "REVENUE · ESTIMATED PROFIT · CHANNELS",
        n: "02",
    },
    {
        name: "inventory",
        from: 150,
        duration: 98,
        title: "Find products. Follow your stock.",
        tag: "YOUR PRODUCT COLLECTION",
        n: "03",
    },
    {
        name: "orders",
        from: 240,
        duration: 98,
        title: "Every sale, in one place.",
        tag: "FILTER ORDERS BY SALES CHANNEL",
        n: "04",
    },
    {
        name: "pricing",
        from: 330,
        duration: 83,
        title: "A little more room to grow.",
        tag: "YOUR INTERACTIVE PRICING CALCULATOR",
        n: "05",
    },
];
const ease = {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
};
const background = {
    background: paper,
    color: ink,
    fontFamily: "Arial, sans-serif",
    backgroundImage:
        "repeating-linear-gradient(0deg, transparent, transparent 53px, #466d5009 53px, #466d5009 54px)",
};
const loopShots = [
    { ...shots[1], from: 0, duration: 80 },
    { ...shots[2], from: 72, duration: 80 },
    { ...shots[3], from: 144, duration: 80 },
    { name: "expenses", from: 216, duration: 80, title: "Keep the little costs in view." },
    { name: "suppliers", from: 288, duration: 80, title: "Good people. Well-kept details." },
    { ...shots[4], from: 360, duration: 90 },
];
function LoopShot({ shot, first = false }) {
    const f = useCurrentFrame();
    return (
        <AbsoluteFill
            style={{ ...background, opacity: first ? 1 : interpolate(f, [0, 8], [0, 1], ease) }}
        >
            <div
                style={{
                    position: "absolute",
                    left: 70,
                    top: 55,
                    fontSize: 18,
                    color: green,
                    letterSpacing: 3,
                }}
            >
                INSIDE SELLER’S NOTEBOOK
            </div>
            <div
                style={{
                    position: "absolute",
                    top: 110,
                    left: 70,
                    width: 1780,
                    height: 810,
                    overflow: "hidden",
                    borderRadius: 16,
                    border: "1px solid #c9cdb8",
                    boxShadow: "0 16px 40px #364a3f18",
                }}
            >
                <OffthreadVideo
                    muted
                    src={staticFile(shot.name + ".mp4")}
                    style={{
                        width: "100%",
                        transform: `scale(${interpolate(f, [0, 110], [1, 1.02], ease)})`,
                        transformOrigin: "50% 25%",
                    }}
                />
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 90,
                    top: 965,
                    fontSize: 45,
                    letterSpacing: -1,
                }}
            >
                {shot.title}
            </div>
            <div style={{ position: "absolute", right: 90, top: 995, fontSize: 15, color: green }}>
                Sample notebook · fictional figures
            </div>
        </AbsoluteFill>
    );
}
function LandingLoop() {
    const f = useCurrentFrame();
    return (
        <AbsoluteFill style={background}>
            {loopShots.map((s, i) => (
                <Sequence
                    key={s.name}
                    from={s.from}
                    durationInFrames={s.duration}
                >
                    <LoopShot
                        shot={s}
                        first={i === 0}
                    />
                </Sequence>
            ))}
            <Sequence
                from={432}
                durationInFrames={18}
            >
                <AbsoluteFill style={{ opacity: interpolate(f, [432, 443], [0, 1], ease) }}>
                    <Freeze frame={0}>
                        <LoopShot
                            shot={loopShots[0]}
                            first
                        />
                    </Freeze>
                </AbsoluteFill>
            </Sequence>
        </AbsoluteFill>
    );
}
const socialTitles = [
    "Less scattered.\nMore settled.",
    "Know how your\nbusiness is doing.",
    "Find it.\nKeep it stocked.",
    "Your sales.\nOne calm place.",
    "Find your\nsweet spot.",
];
const socialNotes = [
    "Products, sales & numbers. Together.",
    "Revenue & estimated profit at a glance.",
    "Search products and check stock levels.",
    "Filter your orders by sales channel.",
    "Change your margin. See your price.",
];
function SocialShot({
    shot,
    index,
    title,
    note,
    detailText,
    detailLeft,
    detailTop,
    detailWidth = 1800,
    stepCount = 5,
    footnote,
}) {
    const f = useCurrentFrame();
    const opacity = interpolate(f, [0, 8], [index === 0 ? 1 : 0, 1], ease);
    const zoom = interpolate(f, [0, shot.duration], [1, 1.025], ease);
    const left =
        detailLeft ??
        (shot.name === "pricing"
            ? -430
            : shot.name === "inventory"
              ? interpolate(f, [20, 80], [-310, -820], ease)
              : -220);
    return (
        <AbsoluteFill style={{ ...background, opacity }}>
            <div
                style={{
                    position: "absolute",
                    left: 88,
                    top: 160,
                    fontSize: 23,
                    letterSpacing: 4,
                    color: green,
                }}
            >
                SELLER’S NOTEBOOK
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 88,
                    right: 100,
                    top: 242,
                    fontSize: 82,
                    lineHeight: 1.06,
                    whiteSpace: "pre-line",
                    letterSpacing: -3.5,
                    fontWeight: 500,
                }}
            >
                {title ?? socialTitles[index]}
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 90,
                    right: 120,
                    top: 464,
                    fontSize: 29,
                    lineHeight: 1.4,
                    color: green,
                }}
            >
                {note ?? socialNotes[index]}
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 70,
                    top: 580,
                    width: 940,
                    height: 529,
                    overflow: "hidden",
                    borderRadius: 20,
                    border: "1px solid #c9cdb8",
                    boxShadow: "0 15px 45px #364a3f18",
                }}
            >
                <OffthreadVideo
                    muted
                    startFrom={shot.offset ?? 0}
                    src={staticFile(shot.name + ".mp4")}
                    style={{ width: 940, transform: `scale(${zoom})` }}
                />
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 88,
                    top: 1150,
                    fontSize: 19,
                    letterSpacing: 3,
                    color: green,
                }}
            >
                {index === 0 ? "MADE FOR YOUR LITTLE BUSINESS" : "A CLOSER LOOK"}
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 70,
                    top: 1200,
                    width: 940,
                    height: 330,
                    overflow: "hidden",
                    borderRadius: 20,
                    border: "1px solid #c9cdb8",
                    background: "#e9eddc",
                }}
            >
                {index === 0 ? (
                    <div
                        style={{
                            padding: "55px 48px",
                            fontFamily: "Georgia",
                            fontSize: 49,
                            fontStyle: "italic",
                            lineHeight: 1.35,
                            whiteSpace: "pre-line",
                        }}
                    >
                        {detailText ?? (
                            <>
                                All the charm of a notebook.
                                <br />A little less doing the math.
                            </>
                        )}
                    </div>
                ) : (
                    <OffthreadVideo
                        muted
                        startFrom={shot.offset ?? 0}
                        src={staticFile(shot.name + ".mp4")}
                        style={{
                            position: "absolute",
                            width: detailWidth,
                            left,
                            top: detailTop ?? (shot.name === "pricing" ? -310 : -375),
                        }}
                    />
                )}
            </div>
            <div style={{ position: "absolute", left: 90, top: 1580, fontSize: 19, color: green }}>
                {footnote ??
                    (index === 0
                        ? "A place for your business to grow."
                        : "Sample notebook · fictional figures")}
            </div>
            <div
                style={{
                    position: "absolute",
                    left: 90,
                    right: 110,
                    top: 1640,
                    display: "flex",
                    gap: 12,
                }}
            >
                {Array.from({ length: stepCount }, (_, i) => (
                    <div
                        key={i}
                        style={{
                            height: 5,
                            flex: 1,
                            borderRadius: 4,
                            background: i === index ? green : "#d9decb",
                        }}
                    />
                ))}
            </div>
        </AbsoluteFill>
    );
}
function SocialEnd() {
    const f = useCurrentFrame();
    return (
        <AbsoluteFill
            style={{
                ...background,
                opacity: interpolate(f, [0, 8], [0, 1], ease),
                alignItems: "center",
                justifyContent: "center",
                padding: "0 100px",
            }}
        >
            <div style={{ color: green, fontSize: 27, letterSpacing: 4, marginBottom: 55 }}>
                A FRESH PAGE STARTS HERE
            </div>
            <div
                style={{
                    fontFamily: "Georgia",
                    fontStyle: "italic",
                    fontSize: 105,
                    lineHeight: 1.13,
                    textAlign: "center",
                    letterSpacing: -4,
                }}
            >
                Seller’s
                <br />
                Notebook
            </div>
            <div
                style={{
                    textAlign: "center",
                    fontSize: 34,
                    lineHeight: 1.4,
                    color: green,
                    marginTop: 45,
                }}
            >
                A place for your
                <br />
                business to grow.
            </div>
            <div
                style={{
                    background: green,
                    color: paper,
                    padding: "30px 45px",
                    borderRadius: 12,
                    fontSize: 34,
                    marginTop: 65,
                }}
            >
                Start your notebook <span style={{ marginLeft: 25 }}>→</span>
            </div>
        </AbsoluteFill>
    );
}
function Social() {
    return (
        <AbsoluteFill style={background}>
            {shots.map((s, i) => (
                <Sequence
                    key={s.name}
                    from={s.from}
                    durationInFrames={i === 4 ? 68 : s.duration}
                >
                    <SocialShot
                        shot={s}
                        index={i}
                    />
                </Sequence>
            ))}
            <Sequence
                from={390}
                durationInFrames={60}
            >
                <SocialEnd />
            </Sequence>
        </AbsoluteFill>
    );
}
const operationShots = [
    {
        name: "expenses",
        from: 0,
        duration: 68,
        title: "The little costs.\nThe good people.",
        note: "Expenses & suppliers, neatly kept.",
        detailText: "Keep costs clear.\nKeep good people close.",
    },
    {
        name: "expenses",
        from: 60,
        duration: 128,
        title: "The little costs\ncount, too.",
        note: "Filter expenses. Understand your overhead.",
        detailLeft: -260,
        detailTop: -520,
        detailWidth: 1600,
    },
    {
        name: "suppliers",
        from: 180,
        duration: 128,
        title: "Good people.\nDetails to hand.",
        note: "Contacts, linked products & lead times.",
        detailLeft: -270,
        detailTop: -360,
        detailWidth: 1600,
    },
    {
        name: "deliveries",
        from: 300,
        duration: 98,
        title: "Stay ahead of\nyour deliveries.",
        note: "Find overdue purchases at a glance.",
        detailLeft: -270,
        detailTop: -120,
        detailWidth: 1600,
    },
];
function OperationsPromo() {
    return (
        <AbsoluteFill style={background}>
            {operationShots.map((s, i) => (
                <Sequence
                    key={s.from}
                    from={s.from}
                    durationInFrames={s.duration}
                >
                    <SocialShot
                        shot={s}
                        index={i}
                        {...s}
                        stepCount={4}
                        footnote="Sample notebook · fictional figures"
                    />
                </Sequence>
            ))}
            <Sequence
                from={390}
                durationInFrames={60}
            >
                <SocialEnd />
            </Sequence>
        </AbsoluteFill>
    );
}
const narratedGeneralShots = [
    { ...shots[0], from: 0, duration: 86, index: 0 },
    { ...shots[2], from: 78, duration: 40, index: 2, offset: 20 },
    { ...shots[3], from: 110, duration: 40, index: 3, offset: 12 },
    { ...shots[1], from: 142, duration: 78, index: 1 },
    { ...shots[4], from: 212, duration: 116, index: 4 },
];
function NarratedGeneral() {
    return (
        <AbsoluteFill style={background}>
            {narratedGeneralShots.map((s) => (
                <Sequence
                    key={s.from}
                    from={s.from}
                    durationInFrames={s.duration}
                >
                    <SocialShot
                        shot={s}
                        index={s.index}
                    />
                </Sequence>
            ))}
            <Sequence
                from={320}
                durationInFrames={130}
            >
                <SocialEnd />
            </Sequence>
        </AbsoluteFill>
    );
}
const operationCue = (word) => Math.round((operationsWords[word].offset / 1e7 / 1.1 + 0.15) * 30);
const [suppliersAt, deliveriesAt, lessAt, moreAt, brandAt] = [7, 11, 17, 19, 21].map(operationCue);
const narratedOperationsShots = [
    {
        ...operationShots[1],
        from: 0,
        duration: suppliersAt + 8,
        index: 1,
        title: "The little costs\ncount too.",
    },
    {
        ...operationShots[2],
        from: suppliersAt,
        duration: deliveriesAt - suppliersAt + 8,
        index: 2,
        offset: 20,
    },
    { ...operationShots[3], from: deliveriesAt, duration: lessAt - deliveriesAt + 8, index: 3 },
    {
        ...operationShots[1],
        from: lessAt,
        duration: moreAt - lessAt + 8,
        index: 1,
        offset: 45,
        title: "Less scattered.",
        note: "A clearer view of the costs behind your business.",
    },
    {
        ...operationShots[2],
        from: moreAt,
        duration: brandAt - moreAt + 8,
        index: 2,
        offset: 45,
        title: "More settled.",
        note: "Your supplier details, all together.",
    },
];
function NarratedOperations() {
    return (
        <AbsoluteFill style={background}>
            {narratedOperationsShots.map((s) => (
                <Sequence
                    key={s.from}
                    from={s.from}
                    durationInFrames={s.duration}
                >
                    <SocialShot
                        shot={s}
                        {...s}
                        stepCount={4}
                        footnote="Sample notebook · fictional figures"
                    />
                </Sequence>
            ))}
            <Sequence
                from={brandAt}
                durationInFrames={450 - brandAt}
            >
                <SocialEnd />
            </Sequence>
        </AbsoluteFill>
    );
}
registerRoot(() => (
    <>
        <Composition
            id="LandingLoop"
            component={LandingLoop}
            width={1920}
            height={1080}
            fps={30}
            durationInFrames={450}
        />
        <Composition
            id="SocialVertical"
            component={Social}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={450}
        />
        <Composition
            id="OperationsPromo"
            component={OperationsPromo}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={450}
        />
        <Composition
            id="NarratedGeneral"
            component={NarratedGeneral}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={450}
        />
        <Composition
            id="NarratedOperations"
            component={NarratedOperations}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={450}
        />
    </>
));
