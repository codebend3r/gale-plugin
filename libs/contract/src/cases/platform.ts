import type { Os, Platform } from "../types.ts";
import type { Case } from "./case.ts";

export const rustTargetCases = [
  {
    name: "macOS arm64",
    input: { os: "darwin", arch: "arm64" },
    expected: "aarch64-apple-darwin",
  },
  {
    name: "macOS x64",
    input: { os: "darwin", arch: "x64" },
    expected: "x86_64-apple-darwin",
  },
  {
    name: "Linux arm64",
    input: { os: "linux", arch: "arm64" },
    expected: "aarch64-unknown-linux-gnu",
  },
  {
    name: "Linux x64",
    input: { os: "linux", arch: "x64" },
    expected: "x86_64-unknown-linux-gnu",
  },
  {
    name: "Windows x64",
    input: { os: "win32", arch: "x64" },
    expected: "x86_64-pc-windows-msvc",
  },
  {
    name: "Windows arm64 has no release",
    input: { os: "win32", arch: "arm64" },
    expected: null,
  },
  {
    name: "unknown arch has no release",
    input: { os: "linux", arch: "riscv64" },
    expected: null,
  },
] as const satisfies readonly Case<Platform, string | null>[];

export const binaryFileNameCases = [
  { name: "macOS uses gale", input: "darwin", expected: "gale" },
  { name: "Linux uses gale", input: "linux", expected: "gale" },
  { name: "Windows uses gale exe", input: "win32", expected: "gale.exe" },
] as const satisfies readonly Case<Os, string>[];
