import { describe, expect, it } from "vitest";
import { kotlinString, kotlinStringAssignment, testName } from "./kotlin.ts";
import { webstormConformanceTest } from "./webstorm-conformance-test.ts";
import { webstormFacts } from "./webstorm-facts.ts";

describe("kotlinString", () => {
  it("escapes backslashes, quotes, dollar signs, and newlines", () => {
    expect(kotlinString('a\\b "c" $d\ne')).toBe('"a\\\\b \\"c\\" \\$d\\ne"');
  });
});

describe("testName", () => {
  it("drops characters the JVM rejects in method names", () => {
    expect(testName("should restart", ".stylelintrc.json at the root")).toBe(
      "`should restart stylelintrc json at the root`",
    );
    expect(testName("x", "a/b: c<d>")).toBe("`x a b c d`");
  });
});

describe("kotlinStringAssignment", () => {
  it("keeps a short assignment on one line", () => {
    expect(kotlinStringAssignment("    ", "const val A", "b")).toBe(
      '    const val A = "b"',
    );
  });

  it("moves a long value to the next line", () => {
    const value = "x".repeat(130);

    expect(kotlinStringAssignment("    ", "const val A", value)).toBe(
      `    const val A =\n        "${value}"`,
    );
  });

  it("splits a value too long for one line at spaces", () => {
    const value = `${"a".repeat(90)} ${"b".repeat(90)} c`;

    expect(kotlinStringAssignment("", "val A", value)).toBe(
      [
        "val A =",
        `    "${"a".repeat(90)} " +`,
        `        "${"b".repeat(90)} c"`,
      ].join("\n"),
    );
  });
});

describe("webstormFacts", () => {
  it("renders the facts", () => {
    expect(webstormFacts.render(null)).toMatchSnapshot();
  });
});

describe("webstormConformanceTest", () => {
  const rendered = webstormConformanceTest.render(null);

  it("renders one test per case", () => {
    expect(rendered).toMatchSnapshot();
  });

  it("gives every test a unique name", () => {
    const names = [...rendered.matchAll(/^ {4}fun (`[^`]+`)\(\) \{$/gm)].map(
      (match) => match[1],
    );
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
});
