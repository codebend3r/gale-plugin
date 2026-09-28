import { facts } from "./facts.ts";
import type { PathSettings } from "./types.ts";

/** `--lsp`, plus `--config <path>` exactly as the user wrote it. */
export function serverArgs(settings: PathSettings): string[] {
  return settings.configPath === ""
    ? [facts.server.lspArg]
    : [facts.server.lspArg, facts.server.configArg, settings.configPath];
}
