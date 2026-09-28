import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";
import { describe, expect, it } from "vitest";
import type { Output } from "./output.ts";
import syncGenerator, { outputs, syncOutputs } from "./sync.ts";

const upper: Output = {
  path: "generated/upper.txt",
  render: (existing) => (existing ?? "fresh").toUpperCase(),
};

describe("syncOutputs", () => {
  it("writes stale outputs and reports them", () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(upper.path, "stale");

    const result = syncOutputs(tree, [upper]);

    expect(tree.read(upper.path, "utf-8")).toBe("STALE");
    expect(result.outOfSyncMessage).toBe(
      "Generated files are out of date: generated/upper.txt. Run `nx sync` to update them.",
    );
  });

  it("creates missing outputs", () => {
    const tree = createTreeWithEmptyWorkspace();

    syncOutputs(tree, [upper]);

    expect(tree.read(upper.path, "utf-8")).toBe("FRESH");
  });

  it("reports nothing and changes nothing when outputs are current", () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(upper.path, "CURRENT");
    const before = tree.listChanges().length;

    expect(syncOutputs(tree, [upper])).toEqual({});
    expect(tree.listChanges()).toHaveLength(before);
  });
});

describe("syncGenerator", () => {
  it("owns the generated plugin files", () => {
    expect(outputs.map((output) => output.path)).toEqual([
      "plugins/vscode/package.json",
      "plugins/zed/src/generated.rs",
      "plugins/zed/src/conformance_tests.rs",
      "plugins/zed/extension.toml",
      "plugins/webstorm/src/main/kotlin/com/codebend3r/gale/generated/GaleFacts.kt",
      "plugins/webstorm/src/test/kotlin/com/codebend3r/gale/core/ConformanceTest.kt",
    ]);
  });

  it("brings a workspace in sync, then reports it current", () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write("plugins/vscode/package.json", '{ "name": "gale-lint" }\n');

    expect(syncGenerator(tree).outOfSyncMessage).toContain(
      "plugins/vscode/package.json",
    );
    expect(syncGenerator(tree)).toEqual({});
  });
});
