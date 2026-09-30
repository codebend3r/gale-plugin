import {
  binaryFileNameCases,
  projectBinaryPathCases,
  resolveBinaryCases,
  rustTargetCases,
  serverArgsCases,
  shouldRestartCases,
  type Os,
  type PathSettings,
  type Platform,
  type Probe,
} from "@gale-plugin/contract";
import type { Output } from "../output.ts";
import { GENERATED_HEADER, kotlinString, testName } from "./kotlin.ts";

const BODY = "        ";

/** `ConformanceTest.kt`: the shared cases as native JUnit tests. */
export const webstormConformanceTest: Output = {
  path: "plugins/webstorm/src/test/kotlin/com/codebend3r/gale/core/ConformanceTest.kt",
  render() {
    const tests = [
      ...rustTargetCases.map((testCase) =>
        test(testName("rust target", testCase.name), [
          assertNullable(
            testCase.expected,
            `rustTarget(${platformExpr(testCase.input)})`,
          ),
        ]),
      ),
      ...binaryFileNameCases.map((testCase) =>
        test(testName("binary file name", testCase.name), [
          `assertEquals(${kotlinString(testCase.expected)}, binaryFileName(${osExpr(testCase.input)}))`,
        ]),
      ),
      ...projectBinaryPathCases.map((testCase) =>
        test(testName("project binary path", testCase.name), [
          `val platform = ${platformExpr(testCase.input.platform)}`,
          ...assertNullablePath(
            testCase.expected,
            `projectBinaryPath(${kotlinNullable(testCase.input.root)}, platform)`,
          ),
        ]),
      ),
      ...resolveBinaryCases.map((testCase) =>
        test(testName("resolve binary", testCase.name), [
          settingsLine(testCase.input.settings),
          probeLine(testCase.input.probe),
          ...assertNullablePath(
            testCase.expected,
            "resolveBinary(settings, probe)",
          ),
        ]),
      ),
      ...serverArgsCases.map((testCase) =>
        test(testName("server args", testCase.name), [
          settingsLine(testCase.input),
          `assertEquals(listOf(${testCase.expected.map(kotlinString).join(", ")}), serverArgs(settings))`,
        ]),
      ),
      ...shouldRestartCases.map((testCase) =>
        test(testName("should restart", testCase.name), [
          settingsLine(testCase.input.settings),
          `${testCase.expected ? "assertTrue" : "assertFalse"}(shouldRestart(${kotlinString(testCase.input.changedPath)}, ${kotlinString(testCase.input.root)}, settings))`,
        ]),
      ),
    ];
    return [
      GENERATED_HEADER,
      "",
      "package com.codebend3r.gale.core",
      "",
      "import org.junit.Assert.assertEquals",
      "import org.junit.Assert.assertFalse",
      "import org.junit.Assert.assertNull",
      "import org.junit.Assert.assertTrue",
      "import org.junit.Test",
      "",
      "/** One test per shared case in `@gale-plugin/contract`. */",
      "class ConformanceTest {",
      tests.join("\n\n"),
      "}",
      "",
    ].join("\n");
  },
};

function test(name: string, body: readonly string[]): string {
  return [
    "    @Test",
    `    fun ${name}() {`,
    ...body.map((line) => `${BODY}${line}`),
    "    }",
  ].join("\n");
}

/** `assertNull(actual)` or `assertEquals("expected", actual)`. */
function assertNullable(expected: string | null, actual: string): string {
  return expected === null
    ? `assertNull(${actual})`
    : `assertEquals(${kotlinString(expected)}, ${actual})`;
}

/**
 * Like `assertNullable`, but binds a non-null expected value to `expected`
 * first, so a long path keeps the assertion inside ktlint's line width.
 */
function assertNullablePath(expected: string | null, actual: string): string[] {
  return expected === null
    ? [`assertNull(${actual})`]
    : [
        `val expected = ${kotlinString(expected)}`,
        `assertEquals(expected, ${actual})`,
      ];
}

function kotlinNullable(value: string | null): string {
  return value === null ? "null" : kotlinString(value);
}

function osExpr(os: Os): string {
  return `Os.${os.toUpperCase()}`;
}

function platformExpr(platform: Platform): string {
  return `Platform(${osExpr(platform.os)}, ${kotlinString(platform.arch)})`;
}

function settingsLine(settings: PathSettings): string {
  return `val settings = PathSettings(${kotlinString(settings.configPath)}, ${kotlinString(settings.binaryPath)})`;
}

function probeLine(probe: Probe): string {
  return `val probe = Probe(${kotlinNullable(probe.projectBinary)}, ${kotlinNullable(probe.which)})`;
}
