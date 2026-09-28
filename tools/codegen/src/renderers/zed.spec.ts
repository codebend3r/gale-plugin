import { describe, expect, it } from "vitest";
import { zedConformanceTests } from "./zed-conformance-tests.ts";
import { zedExtensionToml } from "./zed-extension-toml.ts";
import { zedGenerated } from "./zed-generated.ts";

const generatedKeys = [
  'languages = ["CSS", "SCSS", "LESS", "SASS"]',
  'language_ids = { CSS = "css", SCSS = "scss", LESS = "less", SASS = "sass" }',
];

describe("zedGenerated", () => {
  it("renders the facts", () => {
    expect(zedGenerated.render(null)).toMatchSnapshot();
  });
});

describe("zedConformanceTests", () => {
  const rendered = zedConformanceTests.render(null);

  it("renders one test per case", () => {
    expect(rendered).toMatchSnapshot();
  });

  it("gives every test a unique name", () => {
    const names = [...rendered.matchAll(/^fn (\w+)\(\) \{$/gm)].map(
      (match) => match[1],
    );
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("zedExtensionToml", () => {
  it("replaces the generated keys and keeps everything else", () => {
    const existing = [
      'id = "gale"',
      "",
      "[language_servers.gale]",
      'name = "Gale"',
      'languages = ["CSS"]',
      'language_ids = { CSS = "css" }',
      "",
      "# kept",
      "[[capabilities]]",
      'kind = "process:exec"',
      "",
    ].join("\n");

    expect(zedExtensionToml.render(existing)).toBe(
      [
        'id = "gale"',
        "",
        "[language_servers.gale]",
        'name = "Gale"',
        ...generatedKeys,
        "",
        "# kept",
        "[[capabilities]]",
        'kind = "process:exec"',
        "",
      ].join("\n"),
    );
  });

  it("adds missing keys at the end of the section", () => {
    const existing = [
      "[language_servers.gale]",
      'name = "Gale"',
      "",
      "[lib]",
      'kind = "Rust"',
    ].join("\n");

    expect(zedExtensionToml.render(existing)).toBe(
      [
        "[language_servers.gale]",
        'name = "Gale"',
        ...generatedKeys,
        "",
        "[lib]",
        'kind = "Rust"',
        "",
      ].join("\n"),
    );
  });

  it("adds the section when it's missing", () => {
    expect(zedExtensionToml.render('id = "gale"\n')).toBe(
      ['id = "gale"', "", "[language_servers.gale]", ...generatedKeys, ""].join(
        "\n",
      ),
    );
  });

  it("creates the file when it doesn't exist", () => {
    expect(zedExtensionToml.render(null)).toBe(
      ["[language_servers.gale]", ...generatedKeys, ""].join("\n"),
    );
  });

  it("is stable when rendered twice", () => {
    const once = zedExtensionToml.render('id = "gale"\n');

    expect(zedExtensionToml.render(once)).toBe(once);
  });
});
