import type { Os, Platform } from "@gale-plugin/contract";
import { inject } from "vitest";

/** The gale under test, handed from the global setup to every check. */
export interface GaleUnderTest {
  /** The binary the checks run. */
  readonly binary: string;
  /** What `gale --version` reports, without the leading "gale ". */
  readonly version: string;
  /**
   * The temp project `@codebend3r/gale` was installed into, or null when
   * `GALE_BINARY` points at a build and there is no npm package to check.
   */
  readonly projectRoot: string | null;
}

declare module "vitest" {
  export interface ProvidedContext {
    gale: GaleUnderTest;
  }
}

export function galeUnderTest(): GaleUnderTest {
  return inject("gale");
}

/** The platform the suite runs on, in the contract's Node-style names. */
export function currentPlatform(): Platform {
  return { os: process.platform as Os, arch: process.arch };
}
