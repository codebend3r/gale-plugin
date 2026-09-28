import * as path from "node:path";
import { facts } from "./facts.ts";
import type { PathSettings } from "./types.ts";

const watchedNames: ReadonlySet<string> = new Set([
  ...facts.configFileNames,
  facts.packageJsonFileName,
]);

/**
 * Whether a change to `changedPath` can change the config Gale loads, so the
 * server needs a restart. Gale reads config once, looking from `root` upward.
 */
export function shouldRestart(
  changedPath: string,
  root: string,
  settings: PathSettings,
): boolean {
  if (changedPath.split(path.sep).includes("node_modules")) {
    return false;
  }
  if (
    settings.configPath !== "" &&
    changedPath === path.resolve(root, settings.configPath)
  ) {
    return true;
  }
  return (
    watchedNames.has(path.basename(changedPath)) &&
    isSelfOrAncestor(path.dirname(changedPath), root)
  );
}

function isSelfOrAncestor(dir: string, root: string): boolean {
  const relative = path.relative(dir, root);
  return (
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`)
  );
}
