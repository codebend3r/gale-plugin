import { fileURLToPath } from "node:url";

// Plain Node can run this module (report.ts imports it), so it must not
// import vitest.

/** Vitest's JSON report. */
export const RESULTS_FILE = fileURLToPath(
  new URL("../reports/results.json", import.meta.url),
);

/** Which gale the run tested, written by the global setup. */
export const META_FILE = fileURLToPath(
  new URL("../reports/meta.json", import.meta.url),
);

export interface RunMeta {
  /** What `gale --version` reports, without the leading "gale ". */
  readonly version: string;
  /** "npm" for an installed package, "binary" for `GALE_BINARY`. */
  readonly source: "npm" | "binary";
}
