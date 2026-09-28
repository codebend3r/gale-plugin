import {
  binaryFileNameCases,
  resolveBinaryCases,
  rustTargetCases,
  serverArgsCases,
  type Os,
  type PathSettings,
  type Platform,
  type Probe,
  type Resolution,
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

fn probe(project_installed: bool, which: Option<&str>) -> Probe {
    Probe {
        project_installed,
        which: which.map(str::to_string),
    }
}

fn found(source: Source, command: &str) -> Resolution {
    Resolution::Found {
        source,
        command: command.to_string(),
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
          assertEq(rustOption(testCase.expected)),
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
          assertEq(rustString(testCase.expected)),
        ]),
      ),
      ...resolveBinaryCases.map((testCase) =>
        test(`resolve_binary_${snakeCase(testCase.name)}`, [
          settingsLine(testCase.input.settings),
          rustCall(
            INDENT,
            "let platform = platform",
            platformArgs(testCase.input.platform),
            ";",
          ),
          probeLine(testCase.input.probe),
          rustCall(
            INDENT,
            "let actual = resolve_binary",
            [
              "&settings",
              rustOption(testCase.input.root),
              "platform",
              "&probe",
            ],
            ";",
          ),
          resolutionLine(testCase.expected),
          assertEq("expected"),
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
          assertEq("expected"),
        ]),
      ),
    ];
    return `${PRELUDE}${tests.join("")}`;
  },
};

function test(name: string, body: readonly string[]): string {
  return `\n#[test]\nfn ${name}() {\n${body.join("\n")}\n}\n`;
}

function assertEq(expected: string): string {
  return rustCall(INDENT, "assert_eq!", ["actual", expected], ";", {
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
    [String(probe.projectInstalled), rustOption(probe.which)],
    ";",
  );
}

function resolutionLine(resolution: Resolution): string {
  if (!resolution.found) {
    return `${INDENT}let expected = Resolution::NotFound;`;
  }
  const sources = { setting: "Setting", project: "Project", path: "Path" };
  return rustCall(
    INDENT,
    "let expected = found",
    [`Source::${sources[resolution.source]}`, rustString(resolution.command)],
    ";",
  );
}
