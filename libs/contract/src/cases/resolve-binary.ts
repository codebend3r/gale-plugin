import type { PathSettings, Platform, Probe, Resolution } from "../types.ts";
import type { Case } from "./case.ts";

export interface ResolveBinaryInput {
  readonly settings: PathSettings;
  readonly root: string | null;
  readonly platform: Platform;
  readonly probe: Probe;
}

const noSettings = { configPath: "", binaryPath: "" };
const macArm = { os: "darwin", arch: "arm64" } as const;

export const resolveBinaryCases = [
  {
    name: "binary path setting wins over project and PATH",
    input: {
      settings: { configPath: "", binaryPath: "/opt/gale/bin/gale" },
      root: "/work/app",
      platform: macArm,
      probe: { projectInstalled: true, which: "/usr/local/bin/gale" },
    },
    expected: {
      found: true,
      source: "setting",
      command: "/opt/gale/bin/gale",
    },
  },
  {
    name: "binary path setting is used even when nothing else is found",
    input: {
      settings: { configPath: "", binaryPath: "/opt/gale/bin/gale" },
      root: null,
      platform: macArm,
      probe: { projectInstalled: false, which: null },
    },
    expected: {
      found: true,
      source: "setting",
      command: "/opt/gale/bin/gale",
    },
  },
  {
    name: "project install wins over PATH",
    input: {
      settings: noSettings,
      root: "/work/app",
      platform: macArm,
      probe: { projectInstalled: true, which: "/usr/local/bin/gale" },
    },
    expected: {
      found: true,
      source: "project",
      command:
        "/work/app/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale",
    },
  },
  {
    name: "project install on Linux x64",
    input: {
      settings: noSettings,
      root: "/home/dev/site",
      platform: { os: "linux", arch: "x64" },
      probe: { projectInstalled: true, which: null },
    },
    expected: {
      found: true,
      source: "project",
      command:
        "/home/dev/site/node_modules/@codebend3r/gale/bin/x86_64-unknown-linux-gnu/gale",
    },
  },
  {
    name: "project install on Windows uses gale exe",
    input: {
      settings: noSettings,
      root: "/work/app",
      platform: { os: "win32", arch: "x64" },
      probe: { projectInstalled: true, which: null },
    },
    expected: {
      found: true,
      source: "project",
      command:
        "/work/app/node_modules/@codebend3r/gale/bin/x86_64-pc-windows-msvc/gale.exe",
    },
  },
  {
    name: "PATH is used when the project has no install",
    input: {
      settings: noSettings,
      root: "/work/app",
      platform: macArm,
      probe: { projectInstalled: false, which: "/usr/local/bin/gale" },
    },
    expected: { found: true, source: "path", command: "/usr/local/bin/gale" },
  },
  {
    name: "PATH is used when there is no workspace root",
    input: {
      settings: noSettings,
      root: null,
      platform: macArm,
      probe: { projectInstalled: true, which: "/usr/local/bin/gale" },
    },
    expected: { found: true, source: "path", command: "/usr/local/bin/gale" },
  },
  {
    name: "PATH is used on a platform with no release",
    input: {
      settings: noSettings,
      root: "/work/app",
      platform: { os: "win32", arch: "arm64" },
      probe: { projectInstalled: true, which: "/usr/local/bin/gale" },
    },
    expected: { found: true, source: "path", command: "/usr/local/bin/gale" },
  },
  {
    name: "nothing found",
    input: {
      settings: noSettings,
      root: "/work/app",
      platform: macArm,
      probe: { projectInstalled: false, which: null },
    },
    expected: { found: false },
  },
  {
    name: "nothing found on a platform with no release",
    input: {
      settings: noSettings,
      root: "/work/app",
      platform: { os: "linux", arch: "riscv64" },
      probe: { projectInstalled: true, which: null },
    },
    expected: { found: false },
  },
] as const satisfies readonly Case<ResolveBinaryInput, Resolution>[];
