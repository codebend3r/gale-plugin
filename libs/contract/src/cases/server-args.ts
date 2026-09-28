import type { PathSettings } from "../types.ts";
import type { Case } from "./case.ts";

export const serverArgsCases = [
  {
    name: "no config path",
    input: { configPath: "", binaryPath: "" },
    expected: ["--lsp"],
  },
  {
    name: "relative config path is passed as written",
    input: { configPath: "config/gale.json", binaryPath: "" },
    expected: ["--lsp", "--config", "config/gale.json"],
  },
  {
    name: "absolute config path",
    input: { configPath: "/etc/gale/gale.toml", binaryPath: "" },
    expected: ["--lsp", "--config", "/etc/gale/gale.toml"],
  },
  {
    name: "config path with spaces stays one argument",
    input: { configPath: "lint config/gale.json", binaryPath: "" },
    expected: ["--lsp", "--config", "lint config/gale.json"],
  },
  {
    name: "binary path does not change the arguments",
    input: { configPath: "", binaryPath: "/opt/gale/bin/gale" },
    expected: ["--lsp"],
  },
] as const satisfies readonly Case<PathSettings, readonly string[]>[];
