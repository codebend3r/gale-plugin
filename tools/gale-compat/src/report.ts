// Prints a Markdown summary of the last compat run: the gale version and a
// row per check. The nightly workflow uses it for the job summary and the
// `gale-compat` issue. Run it with plain Node: `node src/report.ts`.

import { existsSync, readFileSync } from "node:fs";
import { META_FILE, RESULTS_FILE, type RunMeta } from "./meta.ts";

// The slice of vitest's JSON report this reads.
interface Results {
  readonly testResults: readonly {
    readonly assertionResults: readonly {
      readonly ancestorTitles: readonly string[];
      readonly title: string;
      readonly status: string;
      readonly failureMessages: readonly string[];
    }[];
  }[];
}

const ICONS: Readonly<Record<string, string>> = {
  passed: "✅ passed",
  failed: "❌ failed",
  skipped: "⏭️ skipped",
  pending: "⏭️ skipped",
};

function readJson(file: string): unknown {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
}

/** Table cells can't hold pipes or line breaks. */
function cell(text: string): string {
  return text.replaceAll("|", "\\|").replaceAll(/\s+/g, " ").trim();
}

function report(meta: RunMeta | null, results: Results | null): string {
  const gale =
    meta === null ? "gale (version unknown)" : `gale ${meta.version}`;
  if (results === null) {
    return `## ${gale}: the suite didn't run\n\nThe setup failed before any check ran. See the job log.\n`;
  }

  const checks = results.testResults.flatMap((file) => file.assertionResults);
  const failed = checks.filter((check) => check.status === "failed");
  const heading =
    failed.length === 0
      ? `## ${gale}: all ${String(checks.length)} checks passed`
      : `## ${gale}: ${String(failed.length)} of ${String(checks.length)} checks failed`;

  const rows = checks.map((check) => {
    const name = cell([...check.ancestorTitles, check.title].join(" › "));
    const result = ICONS[check.status] ?? check.status;
    const reason = check.failureMessages[0]?.split("\n")[0];
    return `| ${name} | ${reason === undefined ? result : `${result}: ${cell(reason)}`} |`;
  });
  return [heading, "", "| Check | Result |", "|---|---|", ...rows, ""].join(
    "\n",
  );
}

process.stdout.write(
  report(
    readJson(META_FILE) as RunMeta | null,
    readJson(RESULTS_FILE) as Results | null,
  ),
);
