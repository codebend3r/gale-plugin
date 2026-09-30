import type { Platform } from "../types.ts";
import type { Case } from "./case.ts";

export interface ProjectBinaryPathInput {
  readonly root: string | null;
  readonly platform: Platform;
}

const macArm = { os: "darwin", arch: "arm64" } as const;

export const projectBinaryPathCases = [
  {
    name: "macOS arm64",
    input: { root: "/work/app", platform: macArm },
    expected:
      "/work/app/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale",
  },
  {
    name: "Linux x64",
    input: { root: "/home/dev/site", platform: { os: "linux", arch: "x64" } },
    expected:
      "/home/dev/site/node_modules/@codebend3r/gale/bin/x86_64-unknown-linux-gnu/gale",
  },
  {
    name: "Windows uses gale exe",
    input: { root: "/work/app", platform: { os: "win32", arch: "x64" } },
    expected:
      "/work/app/node_modules/@codebend3r/gale/bin/x86_64-pc-windows-msvc/gale.exe",
  },
  {
    name: "root with a trailing slash",
    input: { root: "/work/app/", platform: macArm },
    expected:
      "/work/app/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale",
  },
  {
    name: "filesystem root",
    input: { root: "/", platform: macArm },
    expected: "/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale",
  },
  {
    name: "no workspace root",
    input: { root: null, platform: macArm },
    expected: null,
  },
  {
    name: "platform with no release",
    input: { root: "/work/app", platform: { os: "win32", arch: "arm64" } },
    expected: null,
  },
] as const satisfies readonly Case<ProjectBinaryPathInput, string | null>[];
