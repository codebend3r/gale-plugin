import { accessSync, constants, statSync } from "node:fs";
import { projectBinaryPath } from "@gale-plugin/contract";
import { describe, expect, it } from "vitest";
import { currentPlatform, galeUnderTest } from "./context.ts";

const { projectRoot } = galeUnderTest();

describe.skipIf(projectRoot === null)("binary location", () => {
  it("projectBinaryPath names an executable inside the installed package", () => {
    const binary = projectBinaryPath(projectRoot, currentPlatform());
    expect(binary, "the contract names no binary here").not.toBeNull();
    expect(statSync(String(binary)).isFile()).toBe(true);
    expect(() => {
      accessSync(String(binary), constants.X_OK);
    }).not.toThrow();
  });
});
