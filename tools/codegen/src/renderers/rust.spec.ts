import { describe, expect, it } from "vitest";
import {
  rustCall,
  rustOption,
  rustString,
  rustVec,
  snakeCase,
} from "./rust.ts";

describe("rustString", () => {
  it("escapes backslashes, quotes, and newlines", () => {
    expect(rustString('a\\b "c"\nd')).toBe('"a\\\\b \\"c\\"\\nd"');
  });
});

describe("rustOption", () => {
  it("renders null as None and strings as Some", () => {
    expect(rustOption(null)).toBe("None");
    expect(rustOption("gale")).toBe('Some("gale")');
  });
});

describe("snakeCase", () => {
  it("turns a case name into a Rust identifier", () => {
    expect(snakeCase(".stylelintrc.json at the root")).toBe(
      "stylelintrc_json_at_the_root",
    );
    expect(snakeCase("Windows uses gale exe")).toBe("windows_uses_gale_exe");
  });
});

describe("rustCall", () => {
  it("keeps a short call on one line", () => {
    expect(rustCall("    ", "let a = f", ["1", "2"], ";")).toBe(
      "    let a = f(1, 2);",
    );
  });

  it("puts each argument on its own line past 60 characters of arguments", () => {
    const long = `"${"x".repeat(60)}"`;

    expect(rustCall("    ", "let a = f", ["1", long], ";")).toBe(
      `    let a = f(\n        1,\n        ${long},\n    );`,
    );
  });

  it("puts each argument on its own line past 100 characters of line", () => {
    const head = `let ${"a".repeat(90)} = f`;

    expect(rustCall("    ", head, ['"x"', '"y"'], ";")).toBe(
      `    ${head}(\n        "x",\n        "y",\n    );`,
    );
  });

  it("leaves no trailing comma in a vertical macro call", () => {
    const long = `"${"x".repeat(60)}"`;

    expect(
      rustCall("", "assert_eq!", ["actual", long], ";", { macro: true }),
    ).toBe(`assert_eq!(\n    actual,\n    ${long}\n);`);
  });
});

describe("rustVec", () => {
  it("renders a vec! on one line when it fits", () => {
    expect(rustVec("", "let v = ", ['"a"', '"b"'], ";")).toBe(
      'let v = vec!["a", "b"];',
    );
  });

  it("puts each item on its own line when it doesn't", () => {
    const long = `"${"x".repeat(60)}"`;

    expect(rustVec("", "let v = ", [long], ";")).toBe(
      `let v = vec![\n    ${long},\n];`,
    );
  });
});
