import { facts } from "./facts.ts";
import type { Os, Platform } from "./types.ts";

/** The Rust target Gale publishes for this platform, or null if it publishes none. */
export function rustTarget(platform: Platform): string | null {
  const row = facts.platforms.find(
    (candidate) =>
      candidate.os === platform.os && candidate.arch === platform.arch,
  );
  return row?.target ?? null;
}

export function binaryFileName(os: Os): string {
  return os === "win32" ? `${facts.server.command}.exe` : facts.server.command;
}
