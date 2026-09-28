import { existsSync } from "node:fs";
import * as path from "node:path";
import {
  facts,
  missingBinaryMessages,
  projectBinaryPath,
  resolveBinary,
  serverArgs,
  shouldRestart,
  type PathSettings,
  type Platform,
} from "@gale-plugin/contract";
import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import which from "which";

export const RESTART_DEBOUNCE_MS = 250;
const OPEN_SETTINGS = "Open Settings";

interface Session {
  readonly client: LanguageClient;
  readonly watchers: readonly vscode.Disposable[];
}

/**
 * Keeps the running Gale session (language client plus config watchers) in
 * line with the current settings and files. Every trigger goes through
 * `requestReconcile()`, and reconciles run one at a time.
 */
export class GaleController {
  private readonly platform: Platform;
  private readonly outputChannel = vscode.window.createOutputChannel("Gale", {
    log: true,
  });
  private session: Session | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(platform: Platform) {
    this.platform = platform;
  }

  /** Reconciles once triggers have been quiet for `RESTART_DEBOUNCE_MS`. */
  requestReconcile(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.enqueue(() => this.reconcile());
    }, RESTART_DEBOUNCE_MS);
  }

  /** Resolves when every reconcile queued so far has finished. */
  settled(): Promise<void> {
    return this.queue;
  }

  async dispose(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.enqueue(() => this.teardown());
    await this.queue;
    this.outputChannel.dispose();
  }

  private enqueue(step: () => Promise<void>): void {
    this.queue = this.queue.then(step).catch((error: unknown) => {
      void vscode.window.showErrorMessage(`Gale: ${String(error)}`);
    });
  }

  private async reconcile(): Promise<void> {
    await this.teardown();

    const config = vscode.workspace.getConfiguration();
    const keys = facts.vscode.settingKeys;
    if (config.get(keys.enable) === false) {
      return;
    }
    const settings: PathSettings = {
      configPath: pathSetting(config.get(keys.configPath)),
      binaryPath: pathSetting(config.get(keys.binaryPath)),
    };
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
    const projectPath = projectBinaryPath(root, this.platform);
    const resolution = resolveBinary(settings, root, this.platform, {
      projectInstalled: projectPath !== null && existsSync(projectPath),
      which: which.sync(facts.server.command, { nothrow: true }),
    });
    if (!resolution.found) {
      void this.showMissingBinary();
      return;
    }

    const client = new LanguageClient(
      "gale",
      "Gale",
      {
        command: resolution.command,
        args: serverArgs(settings),
        options: root === null ? {} : { cwd: root },
      },
      {
        documentSelector: facts.languages.map((language) => ({
          scheme: "file",
          language: language.id,
        })),
        outputChannel: this.outputChannel,
      },
    );
    const watchers = root === null ? [] : this.watchConfig(root, settings);
    try {
      await client.start();
    } catch {
      // LanguageClient has already reported the failure. A client that never
      // started can't be stopped, so it doesn't become the session.
      for (const watcher of watchers) {
        watcher.dispose();
      }
      return;
    }
    this.session = { client, watchers };
  }

  private async teardown(): Promise<void> {
    const session = this.session;
    if (session === undefined) {
      return;
    }
    this.session = undefined;
    for (const watcher of session.watchers) {
      watcher.dispose();
    }
    await session.client.stop();
  }

  private watchConfig(
    root: string,
    settings: PathSettings,
  ): vscode.Disposable[] {
    const names = [...facts.configFileNames, facts.packageJsonFileName];
    const patterns = [new vscode.RelativePattern(root, `{${names.join(",")}}`)];
    if (settings.configPath !== "") {
      const configFile = path.resolve(root, settings.configPath);
      patterns.push(
        new vscode.RelativePattern(
          path.dirname(configFile),
          path.basename(configFile),
        ),
      );
    }
    return patterns.map((pattern) => {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const onEvent = (uri: vscode.Uri): void => {
        if (shouldRestart(uri.fsPath, root, settings)) {
          this.requestReconcile();
        }
      };
      watcher.onDidCreate(onEvent);
      watcher.onDidChange(onEvent);
      watcher.onDidDelete(onEvent);
      return watcher;
    });
  }

  private async showMissingBinary(): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
      missingBinaryMessages.vscode,
      OPEN_SETTINGS,
    );
    if (choice === OPEN_SETTINGS) {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        facts.vscode.settingKeys.binaryPath,
      );
    }
  }
}

/** A path setting as a trimmed string; anything else counts as unset. */
function pathSetting(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
