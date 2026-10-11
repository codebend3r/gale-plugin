import { existsSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { binaryFileName, facts } from "@gale-plugin/contract";
import { beforeAll, describe, expect, it } from "vitest";
import { galeUnderTest } from "./context.ts";

/** What gale's npm package exports from `platform.cjs`. */
interface GalePlatforms {
  resolveTarget(platform: string, arch: string): string | null;
  binaryFileName(platform: string): string;
  supportedPlatforms(): string[];
}

const { projectRoot } = galeUnderTest();

describe.skipIf(projectRoot === null)("platform list", () => {
  const packageDir = path.join(
    String(projectRoot),
    "node_modules",
    facts.npmPackage.name,
  );
  let gale: GalePlatforms;

  beforeAll(async () => {
    // platform.cjs is internal to gale's package. If gale moves it, this
    // fails, and that is the cue to update the check.
    const file = pathToFileURL(path.join(packageDir, "platform.cjs")).href;
    const loaded = (await import(file)) as { default: GalePlatforms };
    gale = loaded.default;
  });

  it.each(facts.platforms)(
    "gale maps $os-$arch to $target, with the contract's binary name",
    (row) => {
      expect(gale.resolveTarget(row.os, row.arch)).toBe(row.target);
      expect(gale.binaryFileName(row.os)).toBe(binaryFileName(row.os));
    },
  );

  it("the contract lists every platform gale supports", () => {
    const listed = facts.platforms.map((row) => `${row.os}-${row.arch}`);
    for (const supported of gale.supportedPlatforms()) {
      expect(listed, `facts.platforms is missing ${supported}`).toContain(
        supported,
      );
    }
  });

  it.each(facts.platforms)("the package ships the $target binary", (row) => {
    const binary = path.join(
      facts.npmPackage.binDir,
      row.target,
      binaryFileName(row.os),
    );
    expect(
      existsSync(path.join(packageDir, binary)),
      `${facts.npmPackage.name} has no ${binary}`,
    ).toBe(true);
  });
});
