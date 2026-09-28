import { facts } from "@gale-plugin/contract";
import type { Output } from "../output.ts";

const SECTION = "[language_servers.gale]";

/**
 * Rewrites only `languages` and `language_ids` in the
 * `[language_servers.gale]` section of `extension.toml`. Every other line,
 * comments included, stays as written.
 */
export const zedExtensionToml: Output = {
  path: "plugins/zed/extension.toml",
  render(existing) {
    const entries = [
      `languages = [${facts.languages
        .map((language) => `"${language.zedName}"`)
        .join(", ")}]`,
      `language_ids = { ${facts.languages
        .map((language) => `${language.zedName} = "${language.id}"`)
        .join(", ")} }`,
    ];
    const lines = (existing ?? "").split("\n");
    if (lines.at(-1) === "") {
      lines.pop();
    }
    if (!lines.includes(SECTION)) {
      lines.push(...(lines.length === 0 ? [] : [""]), SECTION);
    }
    for (const entry of entries) {
      const key = entry.slice(0, entry.indexOf(" ="));
      const section = sectionLines(lines);
      const current = section.find((index) =>
        lines[index]?.startsWith(`${key} =`),
      );
      if (current === undefined) {
        lines.splice(lastEntry(lines, section) + 1, 0, entry);
      } else {
        lines[current] = entry;
      }
    }
    return `${lines.join("\n")}\n`;
  },
};

/** Line numbers inside the section, from its header up to the next header. */
function sectionLines(lines: readonly string[]): number[] {
  const start = lines.indexOf(SECTION);
  const indexes = [start];
  for (
    let i = start + 1;
    i < lines.length && !lines[i]?.startsWith("[");
    i += 1
  ) {
    indexes.push(i);
  }
  return indexes;
}

/**
 * The section's last non-blank line, so inserted keys stay inside it. The
 * header itself is never blank, so there's always one.
 */
function lastEntry(
  lines: readonly string[],
  section: readonly number[],
): number {
  return Math.max(...section.filter((index) => lines[index]?.trim() !== ""));
}
