import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { facts, projectBinaryPath } from "@gale-plugin/contract";
import type { TestProject } from "vitest/node";
import { currentPlatform, type GaleUnderTest } from "./context.ts";
import { META_FILE, type RunMeta } from "./meta.ts";

let installRoot: string | null = null;

/**
 * Vitest global setup. Installs `@codebend3r/gale@$GALE_VERSION` (default
 * `latest`) the way the README tells users to, or takes `GALE_BINARY` as is.
 */
export function setup(project: TestProject): void {
  // A setup that fails must not leave the last run's reports behind.
  rmSync(path.dirname(META_FILE), { recursive: true, force: true });
  const gale = galeFromEnv();
  project.provide("gale", gale);
  const meta: RunMeta = {
    version: gale.version,
    source: gale.projectRoot === null ? "binary" : "npm",
  };
  mkdirSync(path.dirname(META_FILE), { recursive: true });
  writeFileSync(META_FILE, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`Testing gale ${gale.version} (${meta.source}): ${gale.binary}`);
}

export function teardown(): void {
  if (installRoot !== null) {
    rmSync(installRoot, { recursive: true, force: true });
  }
}

function galeFromEnv(): GaleUnderTest {
  const binary = process.env["GALE_BINARY"]?.trim() ?? "";
  if (binary !== "") {
    if (!existsSync(binary)) {
      throw new Error(`GALE_BINARY points at ${binary}, which doesn't exist.`);
    }
    return { binary, version: reportedVersion(binary), projectRoot: null };
  }

  const requested = process.env["GALE_VERSION"]?.trim() || "latest";
  installRoot = mkdtempSync(path.join(tmpdir(), "gale-compat-"));
  writeFileSync(
    path.join(installRoot, "package.json"),
    `${JSON.stringify({ name: "gale-compat-install", private: true })}\n`,
  );
  execFileSync(
    "bun",
    ["add", "--exact", `${facts.npmPackage.name}@${requested}`],
    { cwd: installRoot, stdio: "inherit" },
  );

  const installed = projectBinaryPath(installRoot, currentPlatform());
  if (installed === null || !existsSync(installed)) {
    throw new Error(
      `${facts.npmPackage.name}@${requested} has no binary for ` +
        `${process.platform}-${process.arch} at ${String(installed)}.`,
    );
  }
  return {
    binary: installed,
    version: reportedVersion(installed),
    projectRoot: installRoot,
  };
}

/** "gale 0.2.5" → "0.2.5". */
function reportedVersion(binary: string): string {
  const output = execFileSync(binary, ["--version"], { encoding: "utf8" });
  return output.trim().replace(/^gale\s+/, "");
}
