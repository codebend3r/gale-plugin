import { facts } from "./facts.ts";

export type Editor = keyof typeof facts.missingBinary.settingHint;

/** The finished missing-binary message for each editor. */
export const missingBinaryMessages: Readonly<Record<Editor, string>> = {
  vscode: fill(facts.missingBinary.settingHint.vscode),
  zed: fill(facts.missingBinary.settingHint.zed),
  webstorm: fill(facts.missingBinary.settingHint.webstorm),
};

function fill(settingHint: string): string {
  return facts.missingBinary.template.replace("{setting}", settingHint);
}
