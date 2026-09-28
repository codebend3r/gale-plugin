import type { Tree } from "@nx/devkit";
import type { Output } from "./output.ts";
import { vscodeManifest } from "./renderers/vscode-manifest.ts";
import { webstormConformanceTest } from "./renderers/webstorm-conformance-test.ts";
import { webstormFacts } from "./renderers/webstorm-facts.ts";
import { zedConformanceTests } from "./renderers/zed-conformance-tests.ts";
import { zedExtensionToml } from "./renderers/zed-extension-toml.ts";
import { zedGenerated } from "./renderers/zed-generated.ts";

export const outputs: readonly Output[] = [
  vscodeManifest,
  zedGenerated,
  zedConformanceTests,
  zedExtensionToml,
  webstormFacts,
  webstormConformanceTest,
];

/**
 * `@gale-plugin/codegen:sync`: brings every generated file up to date.
 * `nx sync` applies the changes; `nx sync:check` fails while any are pending.
 */
export default function syncGenerator(tree: Tree): {
  outOfSyncMessage?: string;
} {
  return syncOutputs(tree, outputs);
}

export function syncOutputs(
  tree: Tree,
  owned: readonly Output[],
): { outOfSyncMessage?: string } {
  const stale = owned.filter((output) => {
    const existing = tree.read(output.path, "utf-8");
    const next = output.render(existing);
    if (next === existing) {
      return false;
    }
    tree.write(output.path, next);
    return true;
  });
  if (stale.length === 0) {
    return {};
  }
  return {
    outOfSyncMessage: `Generated files are out of date: ${stale
      .map((output) => output.path)
      .join(", ")}. Run \`nx sync\` to update them.`,
  };
}
