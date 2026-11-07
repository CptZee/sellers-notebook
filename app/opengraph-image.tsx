import { ImageResponse } from "next/og";

export const alt = "Seller’s Notebook — Your business, beautifully kept";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ShareImage() {
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                background: "#faf8ef",
                color: "#38574b",
                padding: "60px 70px",
                fontFamily: "sans-serif",
                position: "relative",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    left: 42,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "#d9a49d",
                }}
            />
            {[140, 220, 300, 380, 460, 540].map((top) => (
                <div
                    key={top}
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top,
                        height: 1,
                        background: "#e2e8d7",
                    }}
                />
            ))}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    width: 705,
                    position: "relative",
                }}
            >
                <div style={{ display: "flex", fontSize: 24, letterSpacing: 3, color: "#557553" }}>
                    SELLER’S NOTEBOOK
                </div>
                <div
                    style={{
                        display: "flex",
                        fontSize: 68,
                        lineHeight: 1.12,
                        fontWeight: 700,
                        marginTop: 40,
                    }}
                >
                    Your business, beautifully kept.
                </div>
                <div
                    style={{
                        display: "flex",
                        fontSize: 26,
                        lineHeight: 1.5,
                        marginTop: 24,
                        maxWidth: 635,
                    }}
                >
                    A little more ease for everything you’re growing.
                </div>
                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        marginTop: 30,
                        flexWrap: "wrap",
                        maxWidth: 650,
                    }}
                >
                    {["Inventory", "Orders", "Expenses", "Suppliers", "Pricing"].map(
                        (label, index) => (
                            <div
                                key={label}
                                style={{
                                    display: "flex",
                                    background: [
                                        "#e2e8d7",
                                        "#f0ddd1",
                                        "#e5e0ed",
                                        "#e2e8d7",
                                        "#f2e9b8",
                                    ][index],
                                    padding: "10px 16px",
                                    borderRadius: 6,
                                    fontSize: 20,
                                }}
                            >
                                {label}
                            </div>
                        ),
                    )}
                </div>
                <div style={{ display: "flex", fontSize: 22, marginTop: 32, color: "#557553" }}>
                    ntbk.ajmission.dev
                </div>
            </div>
            <div
                style={{
                    display: "flex",
                    position: "absolute",
                    right: 76,
                    top: 137,
                    width: 250,
                    height: 330,
                    background: "#e2e8d7",
                    border: "3px solid #819575",
                    borderLeft: "18px solid #819575",
                    borderRadius: 16,
                    transform: "rotate(7deg)",
                    padding: "36px 24px",
                    flexDirection: "column",
                    boxShadow: "10px 12px 0 #e8e3d2",
                }}
            >
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>
                    My little business
                </div>
                <div style={{ display: "flex", height: 2, background: "#a7b59b", marginTop: 28 }} />
                <div style={{ display: "flex", height: 2, background: "#a7b59b", marginTop: 28 }} />
                <div
                    style={{
                        display: "flex",
                        background: "#f2e9b8",
                        padding: 18,
                        marginTop: 28,
                        fontSize: 24,
                        lineHeight: 1.3,
                        transform: "rotate(-4deg)",
                    }}
                >
                    Little wins, all together.
                </div>
            </div>
        </div>,
        size,
    );
}
