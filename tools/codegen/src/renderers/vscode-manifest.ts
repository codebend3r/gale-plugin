import { facts } from "@gale-plugin/contract";
import type { Output } from "../output.ts";

/**
 * Rewrites only `activationEvents`, `contributes.configuration`, and
 * `contributes.commands` in the VS Code extension manifest. Every other key
 * keeps its value and position.
 */
export const vscodeManifest: Output = {
  path: "plugins/vscode/package.json",
  render(existing) {
    const manifest = JSON.parse(existing ?? "{}") as Record<string, unknown>;
    const contributes = isRecord(manifest["contributes"])
      ? manifest["contributes"]
      : {};

    manifest["activationEvents"] = facts.languages.map(
      (language) => `onLanguage:${language.id}`,
    );
    manifest["contributes"] = {
      ...contributes,
      configuration: {
        title: "Gale CSS Linter",
        properties: Object.fromEntries(
          (["enable", "configPath", "binaryPath"] as const).map((key) => [
            facts.vscode.settingKeys[key],
            {
              type: facts.settings[key].type,
              default: facts.settings[key].default,
              description: facts.settings[key].description,
            },
          ]),
        ),
      },
      commands: [
        {
          command: facts.vscode.restartCommand.id,
          title: facts.vscode.restartCommand.title,
        },
      ],
    };
    return `${JSON.stringify(manifest, null, 2)}\n`;
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
