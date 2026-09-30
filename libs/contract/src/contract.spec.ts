import { describe, expect, it } from "vitest";
import {
  binaryFileName,
  binaryFileNameCases,
  facts,
  missingBinaryMessages,
  projectBinaryPath,
  projectBinaryPathCases,
  resolveBinary,
  resolveBinaryCases,
  rustTarget,
  rustTargetCases,
  serverArgs,
  serverArgsCases,
  shouldRestart,
  shouldRestartCases,
} from "./index.ts";

describe("rustTarget", () => {
  it.each(rustTargetCases)("$name", ({ input, expected }) => {
    expect(rustTarget(input)).toBe(expected);
  });
});

describe("binaryFileName", () => {
  it.each(binaryFileNameCases)("$name", ({ input, expected }) => {
    expect(binaryFileName(input)).toBe(expected);
  });
});

describe("projectBinaryPath", () => {
  it.each(projectBinaryPathCases)("$name", ({ input, expected }) => {
    expect(projectBinaryPath(input.root, input.platform)).toBe(expected);
  });
});

describe("resolveBinary", () => {
  it.each(resolveBinaryCases)("$name", ({ input, expected }) => {
    expect(resolveBinary(input.settings, input.probe)).toBe(expected);
  });
});

describe("serverArgs", () => {
  it.each(serverArgsCases)("$name", ({ input, expected }) => {
    expect(serverArgs(input)).toEqual(expected);
  });
});

describe("shouldRestart", () => {
  it.each(shouldRestartCases)("$name", ({ input, expected }) => {
    expect(shouldRestart(input.changedPath, input.root, input.settings)).toBe(
      expected,
    );
  });
});

describe("missingBinaryMessages", () => {
  it("names each editor's own setting", () => {
    expect(missingBinaryMessages).toEqual({
      vscode:
        "Gale couldn't find the gale binary. Install it in this project with " +
        "`bun add -d @codebend3r/gale`, install it globally with `cargo install gale-lint`, " +
        "or set `gale.path` in Settings.",
      zed:
        "Gale couldn't find the gale binary. Install it in this project with " +
        "`bun add -d @codebend3r/gale`, install it globally with `cargo install gale-lint`, " +
        "or set `lsp.gale.binary.path` in settings.json.",
      webstorm:
        "Gale couldn't find the gale binary. Install it in this project with " +
        "`bun add -d @codebend3r/gale`, install it globally with `cargo install gale-lint`, " +
        "or set Settings › Tools › Gale › Binary path.",
    });
  });
});

describe("the cases cover the facts", () => {
  it("has a rustTarget case for every platform row", () => {
    for (const row of facts.platforms) {
      expect(rustTargetCases).toContainEqual(
        expect.objectContaining({
          input: { os: row.os, arch: row.arch },
          expected: row.target,
        }),
      );
    }
  });

  it("has a restarting case for every config file name", () => {
    const restartingNames = shouldRestartCases
      .filter((testCase) => testCase.expected)
      .map((testCase) => testCase.input.changedPath.split("/").at(-1));
    for (const name of [...facts.configFileNames, facts.packageJsonFileName]) {
      expect(restartingNames).toContain(name);
    }
  });

  it.each([
    ["rustTarget", rustTargetCases],
    ["binaryFileName", binaryFileNameCases],
    ["projectBinaryPath", projectBinaryPathCases],
    ["resolveBinary", resolveBinaryCases],
    ["serverArgs", serverArgsCases],
    ["shouldRestart", shouldRestartCases],
  ] as const)("gives every %s case a unique name", (_, cases) => {
    const names = cases.map((testCase) => testCase.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
});
