import { afterEach, describe, expect, it } from "vitest";
import { galeUnderTest } from "./context.ts";
import { makeProject, ruleConfig } from "./fixtures.ts";
import { codes, startGale, type GaleSession } from "./lsp.ts";

const { binary } = galeUnderTest();

describe("starting the server", () => {
  let session: GaleSession | undefined;

  afterEach(() => {
    session?.dispose();
    session = undefined;
  });

  // The only config sits outside gale's search path, so a reported rule
  // proves gale read the --config flag, resolved from the project root.
  // color-named needs an option, so gale's no-config fallback never reports it.
  const files = { "config/gale.json": ruleConfig("color-named", "never") };
  const sample = "a { color: red; }\n";

  it("reads a relative --config from the project root", async () => {
    const root = makeProject(files);
    session = await startGale({
      binary,
      root,
      settings: { configPath: "config/gale.json", binaryPath: "" },
    });
    const { diagnostics } = await session.open("named.css", "css", sample);
    expect(codes(diagnostics)).toContain("color-named");
  });

  it("without --config, the same project doesn't read that file", async () => {
    const root = makeProject(files);
    session = await startGale({ binary, root });
    const { diagnostics } = await session.open("named.css", "css", sample);
    expect(codes(diagnostics)).not.toContain("color-named");
  });
});
