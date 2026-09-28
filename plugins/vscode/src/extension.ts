import { facts, type Os } from "@gale-plugin/contract";
import * as vscode from "vscode";
import { GaleController } from "./controller.ts";

let controller: GaleController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // VS Code desktop only ships for macOS, Linux, and Windows.
  const active = new GaleController({
    os: process.platform as Os,
    arch: process.arch,
  });
  controller = active;
  context.subscriptions.push(
    vscode.commands.registerCommand(facts.vscode.restartCommand.id, () => {
      active.requestReconcile();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("gale")) {
        active.requestReconcile();
      }
    }),
  );
  active.requestReconcile();
}

export async function deactivate(): Promise<void> {
  await controller?.dispose();
  controller = undefined;
}
