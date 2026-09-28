import { describe, expect, it } from "vitest";
import { vscodeManifest } from "./vscode-manifest.ts";

const render = (manifest: unknown): unknown =>
  JSON.parse(vscodeManifest.render(JSON.stringify(manifest)));

describe("vscodeManifest", () => {
  it("renders the generated keys", () => {
    expect(vscodeManifest.render(null)).toMatchSnapshot();
  });

  it("keeps every other key, in its original position", () => {
    const rendered = render({
      name: "gale-lint",
      activationEvents: ["onStartupFinished"],
      main: "./dist/extension.js",
      contributes: { languages: [{ id: "custom" }] },
      dependencies: { which: "7.0.0" },
    }) as Record<string, unknown>;

    expect(Object.keys(rendered)).toEqual([
      "name",
      "activationEvents",
      "main",
      "contributes",
      "dependencies",
    ]);
    expect(rendered["main"]).toBe("./dist/extension.js");
    expect(rendered["dependencies"]).toEqual({ which: "7.0.0" });
    expect(rendered["contributes"]).toMatchObject({
      languages: [{ id: "custom" }],
    });
  });

  it("replaces stale generated keys", () => {
    const rendered = render({
      activationEvents: ["onLanguage:css"],
      contributes: {
        configuration: { title: "Old", properties: { "gale.old": {} } },
        commands: [{ command: "gale.old", title: "Old" }],
      },
    });

    expect(rendered).toEqual(JSON.parse(vscodeManifest.render(null)));
  });

  it("replaces a contributes value that isn't an object", () => {
    const rendered = render({ contributes: ["not", "an", "object"] });

    expect(rendered).toEqual(JSON.parse(vscodeManifest.render(null)));
  });

  it("is stable when rendered twice", () => {
    const once = vscodeManifest.render(JSON.stringify({ name: "gale-lint" }));

    expect(vscodeManifest.render(once)).toBe(once);
  });
});
