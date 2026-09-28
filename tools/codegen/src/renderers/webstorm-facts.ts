import { facts, missingBinaryMessages } from "@gale-plugin/contract";
import type { Output } from "../output.ts";
import {
  GENERATED_HEADER,
  kotlinString,
  kotlinStringAssignment,
} from "./kotlin.ts";

const INDENT = "    ";

/** `GaleFacts.kt`: the facts the WebStorm plugin reads. */
export const webstormFacts: Output = {
  path: "plugins/webstorm/src/main/kotlin/com/codebend3r/gale/generated/GaleFacts.kt",
  render() {
    const constant = (name: string, value: string): string =>
      kotlinStringAssignment(INDENT, `const val ${name}`, value);
    const list = (
      name: string,
      items: readonly string[],
      doc: string,
    ): string[] => [
      `${INDENT}/** ${doc} */`,
      `${INDENT}val ${name} =`,
      `${INDENT}${INDENT}listOf(`,
      ...items.map((item) => `${INDENT}${INDENT}${INDENT}${item},`),
      `${INDENT}${INDENT})`,
    ];
    return [
      GENERATED_HEADER,
      "",
      "package com.codebend3r.gale.generated",
      "",
      "/** Facts shared by every Gale editor plugin. */",
      "object GaleFacts {",
      constant("SERVER_COMMAND", facts.server.command),
      constant("LSP_ARG", facts.server.lspArg),
      constant("CONFIG_ARG", facts.server.configArg),
      constant("NPM_PACKAGE_NAME", facts.npmPackage.name),
      constant("NPM_BIN_DIR", facts.npmPackage.binDir),
      constant("PACKAGE_JSON_FILE_NAME", facts.packageJsonFileName),
      "",
      ...list(
        "PLATFORMS",
        facts.platforms.map(
          (row) =>
            `Triple(${[row.os, row.arch, row.target].map(kotlinString).join(", ")})`,
        ),
        "`(os, arch, rust target)` for every platform Gale publishes a binary for.",
      ),
      "",
      ...list(
        "LANGUAGE_EXTENSIONS",
        facts.languages.flatMap((language) =>
          language.extensions.map((extension) =>
            kotlinString(extension.replace(/^\./, "")),
          ),
        ),
        "File extensions Gale lints, without the dot.",
      ),
      "",
      ...list(
        "CONFIG_FILE_NAMES",
        facts.configFileNames.map(kotlinString),
        "Gale's config file names, in its priority order.",
      ),
      "",
      `${INDENT}const val ENABLE_DEFAULT = ${String(facts.settings.enable.default)}`,
      constant("ENABLE_DESCRIPTION", facts.settings.enable.description),
      constant("CONFIG_PATH_DEFAULT", facts.settings.configPath.default),
      constant(
        "CONFIG_PATH_DESCRIPTION",
        facts.settings.configPath.description,
      ),
      constant("BINARY_PATH_DEFAULT", facts.settings.binaryPath.default),
      constant(
        "BINARY_PATH_DESCRIPTION",
        facts.settings.binaryPath.description,
      ),
      "",
      constant("MISSING_BINARY_MESSAGE", missingBinaryMessages.webstorm),
      "}",
      "",
    ].join("\n");
  },
};
