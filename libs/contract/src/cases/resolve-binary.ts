import type { PathSettings, Probe } from "../types.ts";
import type { Case } from "./case.ts";

export interface ResolveBinaryInput {
  readonly settings: PathSettings;
  readonly probe: Probe;
}

const noSettings = { configPath: "", binaryPath: "" };
const projectBinary =
  "/work/app/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale";

export const resolveBinaryCases = [
  {
    name: "binary path setting wins over project and PATH",
    input: {
      settings: { configPath: "", binaryPath: "/opt/gale/bin/gale" },
      probe: { projectBinary, which: "/usr/local/bin/gale" },
    },
    expected: "/opt/gale/bin/gale",
  },
  {
    name: "binary path setting is used even when nothing else is found",
    input: {
      settings: { configPath: "", binaryPath: "/opt/gale/bin/gale" },
      probe: { projectBinary: null, which: null },
    },
    expected: "/opt/gale/bin/gale",
  },
  {
    name: "project install wins over PATH",
    input: {
      settings: noSettings,
      probe: { projectBinary, which: "/usr/local/bin/gale" },
    },
    expected: projectBinary,
  },
  {
    name: "PATH is used when the project has no install",
    input: {
      settings: noSettings,
      probe: { projectBinary: null, which: "/usr/local/bin/gale" },
    },
    expected: "/usr/local/bin/gale",
  },
  {
    name: "nothing found",
    input: {
      settings: noSettings,
      probe: { projectBinary: null, which: null },
    },
    expected: null,
  },
] as const satisfies readonly Case<ResolveBinaryInput, string | null>[];
