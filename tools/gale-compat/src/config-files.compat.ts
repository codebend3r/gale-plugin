import { facts } from "@gale-plugin/contract";
import { afterEach, describe, expect, it } from "vitest";
import { galeUnderTest } from "./context.ts";
import { makeProject, ruleConfig } from "./fixtures.ts";
import { codes, startGale, type GaleSession } from "./lsp.ts";

const { binary } = galeUnderTest();

// gale's LSP falls back to its recommended preset when it finds no config,
// so the rule must be one that preset leaves off: color-named needs an option.
const RULE = "color-named";
const OPTION = "never";
const SAMPLE = "a { color: red; }\n";

/** A config turning on RULE, in the format the file name implies. */
function configFor(name: string): string {
  const json = ruleConfig(RULE, OPTION);
  if (name.endsWith(".mjs")) {
    return `export default ${json};\n`;
  }
  if (name.endsWith(".js") || name.endsWith(".cjs")) {
    return `module.exports = ${json};\n`;
  }
  if (name.endsWith(".yml") || name.endsWith(".yaml")) {
    return `rules:\n  ${RULE}: ${OPTION}\n`;
  }
  if (name.endsWith(".toml")) {
    return `[rules]\n"${RULE}" = "${OPTION}"\n`;
  }
  return `${json}\n`;
}

describe("config file names", () => {
  let session: GaleSession | undefined;

  afterEach(() => {
    session?.dispose();
    session = undefined;
  });

  async function reportedRules(
    files: Readonly<Record<string, string>>,
  ): Promise<(string | number)[]> {
    session = await startGale({ binary, root: makeProject(files) });
    const { diagnostics } = await session.open("named.css", "css", SAMPLE);
    return codes(diagnostics);
  }

  it.each(facts.configFileNames)("gale reads %s", async (name) => {
    expect(await reportedRules({ [name]: configFor(name) })).toContain(RULE);
  });

  it(`gale reads the "stylelint" field in ${facts.packageJsonFileName}`, async () => {
    const packageJson = JSON.stringify({
      name: "fixture",
      stylelint: { rules: { [RULE]: OPTION } },
    });
    expect(
      await reportedRules({ [facts.packageJsonFileName]: packageJson }),
    ).toContain(RULE);
  });
});
