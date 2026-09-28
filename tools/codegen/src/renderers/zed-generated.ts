import { facts, missingBinaryMessages } from "@gale-plugin/contract";
import type { Output } from "../output.ts";
import { GENERATED_HEADER, INDENT, rustString } from "./rust.ts";

/** `plugins/zed/src/generated.rs`: the facts the Zed extension reads. */
export const zedGenerated: Output = {
  path: "plugins/zed/src/generated.rs",
  render() {
    const constant = (name: string, value: string): string =>
      `pub const ${name}: &str = ${rustString(value)};`;
    const rows = facts.platforms.map(
      (row) =>
        `${INDENT}(${[row.os, row.arch, row.target].map(rustString).join(", ")}),`,
    );
    return [
      GENERATED_HEADER,
      "",
      "//! Facts shared by every Gale editor plugin.",
      "",
      constant("SERVER_COMMAND", facts.server.command),
      constant("LSP_ARG", facts.server.lspArg),
      constant("CONFIG_ARG", facts.server.configArg),
      "",
      "/// The `lsp.gale.settings` key that holds the config path.",
      constant("CONFIG_PATH_SETTING", "configPath"),
      "",
      constant("NPM_PACKAGE_NAME", facts.npmPackage.name),
      constant("NPM_BIN_DIR", facts.npmPackage.binDir),
      "",
      "/// `(os, arch, rust target)` for every platform Gale publishes a binary for.",
      "pub const PLATFORMS: &[(&str, &str, &str)] = &[",
      ...rows,
      "];",
      "",
      constant("MISSING_BINARY_MESSAGE", missingBinaryMessages.zed),
      "",
    ].join("\n");
  },
};
