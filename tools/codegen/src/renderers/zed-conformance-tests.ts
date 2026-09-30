import {
  binaryFileNameCases,
  projectBinaryPathCases,
  resolveBinaryCases,
  rustTargetCases,
  serverArgsCases,
  type Os,
  type PathSettings,
  type Platform,
  type Probe,
} from "@gale-plugin/contract";
import type { Output } from "../output.ts";
import {
  GENERATED_HEADER,
  INDENT,
  rustCall,
  rustOption,
  rustString,
  rustVec,
  snakeCase,
} from "./rust.ts";

const PRELUDE = `${GENERATED_HEADER}

//! One test per shared case in \`@gale-plugin/contract\`.

use crate::contract::*;

fn platform(os: Os, arch: &str) -> Platform<'_> {
    Platform { os, arch }
}

fn settings(config_path: &str, binary_path: &str) -> PathSettings {
    PathSettings {
        config_path: config_path.to_string(),
        binary_path: binary_path.to_string(),
    }
}

fn probe(project_binary: Option<&str>, which: Option<&str>) -> Probe {
    Probe {
        project_binary: project_binary.map(str::to_string),
        which: which.map(str::to_string),
    }
}
`;

/** `plugins/zed/src/conformance_tests.rs`: the shared cases as native Rust tests. */
export const zedConformanceTests: Output = {
  path: "plugins/zed/src/conformance_tests.rs",
  render() {
    const tests = [
      ...rustTargetCases.map((testCase) =>
        test(`rust_target_${snakeCase(testCase.name)}`, [
          rustCall(
            INDENT,
            "let actual = rust_target",
            [platformExpr(testCase.input)],
            ";",
          ),
          assertEq("actual", rustOption(testCase.expected)),
        ]),
      ),
      ...binaryFileNameCases.map((testCase) =>
        test(`binary_file_name_${snakeCase(testCase.name)}`, [
          rustCall(
            INDENT,
            "let actual = binary_file_name",
            [osExpr(testCase.input)],
            ";",
          ),
          assertEq("actual", rustString(testCase.expected)),
        ]),
      ),
      ...projectBinaryPathCases.map((testCase) =>
        test(`project_binary_path_${snakeCase(testCase.name)}`, [
          rustCall(
            INDENT,
            "let platform = platform",
            platformArgs(testCase.input.platform),
            ";",
          ),
          rustCall(
            INDENT,
            "let actual = project_binary_path",
            [rustOption(testCase.input.root), "platform"],
            ";",
          ),
          assertEq("actual.as_deref()", rustOption(testCase.expected)),
        ]),
      ),
      ...resolveBinaryCases.map((testCase) =>
        test(`resolve_binary_${snakeCase(testCase.name)}`, [
          settingsLine(testCase.input.settings),
          probeLine(testCase.input.probe),
          `${INDENT}let actual = resolve_binary(&settings, probe);`,
          assertEq("actual.as_deref()", rustOption(testCase.expected)),
        ]),
      ),
      ...serverArgsCases.map((testCase) =>
        test(`server_args_${snakeCase(testCase.name)}`, [
          settingsLine(testCase.input),
          `${INDENT}let actual = server_args(&settings);`,
          rustVec(
            INDENT,
            "let expected = ",
            testCase.expected.map(rustString),
            ";",
          ),
          assertEq("actual", "expected"),
        ]),
      ),
    ];
    return `${PRELUDE}${tests.join("")}`;
  },
};

function test(name: string, body: readonly string[]): string {
  return `\n#[test]\nfn ${name}() {\n${body.join("\n")}\n}\n`;
}

function assertEq(actual: string, expected: string): string {
  return rustCall(INDENT, "assert_eq!", [actual, expected], ";", {
    macro: true,
  });
}

function osExpr(os: Os): string {
  const variants = { darwin: "Darwin", linux: "Linux", win32: "Win32" };
  return `Os::${variants[os]}`;
}

function platformArgs(platform: Platform): string[] {
  return [osExpr(platform.os), rustString(platform.arch)];
}

function platformExpr(platform: Platform): string {
  return `platform(${platformArgs(platform).join(", ")})`;
}

function settingsLine(settings: PathSettings): string {
  return rustCall(
    INDENT,
    "let settings = settings",
    [rustString(settings.configPath), rustString(settings.binaryPath)],
    ";",
  );
}

function probeLine(probe: Probe): string {
  return rustCall(
    INDENT,
    "let probe = probe",
    [rustOption(probe.projectBinary), rustOption(probe.which)],
    ";",
  );
}
