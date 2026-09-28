import {
  binaryFileNameCases,
  resolveBinaryCases,
  rustTargetCases,
  serverArgsCases,
  shouldRestartCases,
  type Os,
  type PathSettings,
  type Platform,
  type Probe,
  type Resolution,
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
          testCase.expected === null
            ? `assertNull(rustTarget(${platformExpr(testCase.input)}))`
            : `assertEquals(${kotlinString(testCase.expected)}, rustTarget(${platformExpr(testCase.input)}))`,
        ]),
      ),
      ...binaryFileNameCases.map((testCase) =>
        test(testName("binary file name", testCase.name), [
          `assertEquals(${kotlinString(testCase.expected)}, binaryFileName(${osExpr(testCase.input)}))`,
        ]),
      ),
      ...resolveBinaryCases.map((testCase) =>
        test(testName("resolve binary", testCase.name), [
          settingsLine(testCase.input.settings),
          testCase.input.root === null
            ? "val root: String? = null"
            : `val root = ${kotlinString(testCase.input.root)}`,
          `val platform = ${platformExpr(testCase.input.platform)}`,
          probeLine(testCase.input.probe),
          ...expectedLines(testCase.expected),
          "assertEquals(expected, resolveBinary(settings, root, platform, probe))",
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
  const which = probe.which === null ? "null" : kotlinString(probe.which);
  return `val probe = Probe(${String(probe.projectInstalled)}, ${which})`;
}

function expectedLines(resolution: Resolution): string[] {
  if (!resolution.found) {
    return ["val expected = Resolution.NotFound"];
  }
  return [
    `val command = ${kotlinString(resolution.command)}`,
    `val expected = Resolution.Found(Source.${resolution.source.toUpperCase()}, command)`,
  ];
}
