import * as path from "node:path";
import { facts } from "./facts.ts";
import { binaryFileName, rustTarget } from "./platform.ts";
import type { PathSettings, Platform, Probe, Resolution } from "./types.ts";

/** Where a project install of `@codebend3r/gale` keeps the native binary. */
export function projectBinaryPath(
  root: string | null,
  platform: Platform,
): string | null {
  const target = rustTarget(platform);
  if (root === null || target === null) {
    return null;
  }
  return path.join(
    root,
    "node_modules",
    facts.npmPackage.name,
    facts.npmPackage.binDir,
    target,
    binaryFileName(platform.os),
  );
}

/** Picks the binary to run: the setting, then the project install, then PATH. */
export function resolveBinary(
  settings: PathSettings,
  root: string | null,
  platform: Platform,
  probe: Probe,
): Resolution {
  if (settings.binaryPath !== "") {
    return { found: true, source: "setting", command: settings.binaryPath };
  }
  const projectPath = projectBinaryPath(root, platform);
  if (projectPath !== null && probe.projectInstalled) {
    return { found: true, source: "project", command: projectPath };
  }
  if (probe.which !== null) {
    return { found: true, source: "path", command: probe.which };
  }
  return { found: false };
}
