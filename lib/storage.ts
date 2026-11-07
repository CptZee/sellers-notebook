import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";
export function storage() {
    return new Files({ adapter: neon({ bucket: "assets" }) });
}
