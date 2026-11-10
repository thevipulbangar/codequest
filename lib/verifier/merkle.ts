import { createHash } from "node:crypto";
import type { Frame } from "./types";

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
export const leaf = (f: Frame) => sha256(`${f.id}:${f.hash}`);

/** Binary Merkle root; an odd node is paired with itself. Empty set => sha256(""). */
export function merkleRoot(frames: Frame[]): string {
  if (!frames.length) return sha256("");
  let level = frames.map(leaf);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(sha256(level[i] + (level[i + 1] ?? level[i])));
    level = next;
  }
  return level[0];
}
