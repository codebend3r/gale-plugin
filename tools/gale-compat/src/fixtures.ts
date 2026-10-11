import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterAll } from "vitest";

const created: string[] = [];

afterAll(() => {
  for (const root of created.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * A throwaway project holding exactly `files` (relative path → contents).
 * The path is resolved, so URIs gale echoes back match the ones sent.
 */
export function makeProject(files: Readonly<Record<string, string>>): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "gale-project-")));
  created.push(root);
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  }
  return root;
}

/** A config that turns on one rule, as JSON. */
export function ruleConfig(rule: string, value: unknown = true): string {
  return JSON.stringify({ rules: { [rule]: value } });
}
