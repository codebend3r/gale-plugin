import { facts } from "@gale-plugin/contract";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { galeUnderTest } from "./context.ts";
import { makeProject, ruleConfig } from "./fixtures.ts";
import { codes, startGale, type GaleSession } from "./lsp.ts";

const { binary } = galeUnderTest();

/** One `#ffffff` per syntax; Sass uses the indented form. */
function sample(languageId: string): string {
  return languageId === "sass"
    ? "a\n  color: #ffffff\n"
    : "a { color: #ffffff; }\n";
}

describe("LSP session", () => {
  let session: GaleSession;

  beforeAll(async () => {
    const root = makeProject({
      "gale.json": ruleConfig("color-hex-length", "short"),
    });
    session = await startGale({ binary, root });
  });

  afterAll(() => {
    session.dispose();
  });

  it("advertises quick fixes and text sync", () => {
    expect(session.capabilities.codeActionProvider).toBeTruthy();
    expect(session.capabilities.textDocumentSync).toBeTruthy();
  });

  it.each(facts.languages)(
    "publishes gale's diagnostics for $id files",
    async (language) => {
      const fileName = `sample${language.extensions[0]}`;
      const { diagnostics } = await session.open(
        fileName,
        language.id,
        sample(language.id),
      );
      expect(codes(diagnostics)).toContain("color-hex-length");
      expect(diagnostics).toContainEqual(
        expect.objectContaining({ source: "gale", code: "color-hex-length" }),
      );
    },
  );

  it("offers a quick fix that carries its edit", async () => {
    const { uri, diagnostics } = await session.open(
      "fix.css",
      "css",
      sample("css"),
    );
    const diagnostic = diagnostics.find(
      (candidate) => candidate.code === "color-hex-length",
    );
    expect(diagnostic, "no color-hex-length diagnostic").toBeDefined();
    if (diagnostic === undefined) {
      return;
    }

    const actions = await session.codeActions(uri, diagnostic);
    const quickFix = actions.find((action) => action.kind === "quickfix");
    expect(
      quickFix,
      `no quickfix among ${JSON.stringify(actions)}`,
    ).toBeDefined();
    expect(quickFix?.edit?.changes?.[uri]).toEqual([
      expect.objectContaining({ newText: "#fff" }),
    ]);
  });
});

describe("LSP shutdown", () => {
  it("answers shutdown and exits with code 0 once stdin closes", async () => {
    const root = makeProject({});
    const session = await startGale({ binary, root });
    try {
      expect(await session.shutdown()).toBe(0);
    } finally {
      session.dispose();
    }
  });
});
