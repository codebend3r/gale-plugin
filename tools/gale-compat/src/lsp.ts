import { spawn } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { serverArgs, type PathSettings } from "@gale-plugin/contract";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from "vscode-jsonrpc/node";

/** How long any one request, notification, or exit may take. */
export const LSP_TIMEOUT_MS = 10_000;

const NO_SETTINGS: PathSettings = { configPath: "", binaryPath: "" };

// The slices of the LSP types the checks read.

export interface ServerCapabilities {
  readonly codeActionProvider?: unknown;
  readonly textDocumentSync?: unknown;
}

interface Range {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
}

export interface Diagnostic {
  readonly range: Range;
  readonly message: string;
  readonly code?: string | number;
  readonly source?: string;
}

export interface TextEdit {
  readonly range: Range;
  readonly newText: string;
}

export interface CodeAction {
  readonly title: string;
  readonly kind?: string;
  readonly edit?: {
    readonly changes?: Readonly<Record<string, readonly TextEdit[]>>;
  };
}

interface PublishDiagnosticsParams {
  readonly uri: string;
  readonly diagnostics: readonly Diagnostic[];
}

export interface OpenedDocument {
  readonly uri: string;
  readonly diagnostics: readonly Diagnostic[];
}

export interface GaleSession {
  readonly capabilities: ServerCapabilities;
  /** Opens a file in the project and waits for gale's diagnostics for it. */
  open(
    fileName: string,
    languageId: string,
    text: string,
  ): Promise<OpenedDocument>;
  codeActions(uri: string, diagnostic: Diagnostic): Promise<CodeAction[]>;
  /**
   * Shuts down the way language clients do: `shutdown`, `exit`, then closing
   * stdin. Resolves with the exit code.
   */
  shutdown(): Promise<number | null>;
  /** Kills the server if it is still running. Safe to call more than once. */
  dispose(): void;
}

export interface StartOptions {
  readonly binary: string;
  readonly root: string;
  readonly settings?: PathSettings;
}

/**
 * Starts gale the way every plugin does: `serverArgs(settings)`, run from the
 * project root, with the root as the workspace.
 */
export async function startGale(options: StartOptions): Promise<GaleSession> {
  const { binary, root } = options;
  const child = spawn(binary, serverArgs(options.settings ?? NO_SETTINGS), {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  // "close" rather than "exit", so stderr has been read in full.
  const exited = new Promise<number | null>((resolve) => {
    child.once("close", (code) => {
      resolve(code);
    });
  });
  const command = [binary, ...serverArgs(options.settings ?? NO_SETTINGS)];
  const failure = (what: string): Error =>
    new Error(
      `${what}: ${command.join(" ")} (in ${root})` +
        (stderr === "" ? "" : `\ngale stderr:\n${stderr}`),
    );
  // Rejects as soon as gale exits, so a step waiting on a dead server fails at
  // once instead of at the timeout.
  const died = exited.then((code): never => {
    throw failure(`gale exited with code ${String(code)}`);
  });
  died.catch(() => undefined);
  const step = <T>(promise: Promise<T>, what: string): Promise<T> =>
    withTimeout(Promise.race([promise, died]), () => failure(what));

  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  const waiting = new Map<
    string,
    (diagnostics: readonly Diagnostic[]) => void
  >();
  connection.onNotification(
    "textDocument/publishDiagnostics",
    (params: PublishDiagnosticsParams) => {
      waiting.get(params.uri)?.(params.diagnostics);
    },
  );
  connection.listen();

  const dispose = (): void => {
    connection.dispose();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
    }
  };

  const rootUri = pathToFileURL(root).href;
  let capabilities: ServerCapabilities;
  try {
    const result = await step(
      connection.sendRequest<{ capabilities: ServerCapabilities }>(
        "initialize",
        {
          processId: process.pid,
          rootUri,
          workspaceFolders: [{ uri: rootUri, name: path.basename(root) }],
          capabilities: {},
        },
      ),
      "initialize got no response",
    );
    capabilities = result.capabilities;
    await connection.sendNotification("initialized", {});
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    capabilities,

    async open(fileName, languageId, text) {
      const uri = pathToFileURL(path.join(root, fileName)).href;
      const diagnostics = new Promise<readonly Diagnostic[]>((resolve) => {
        waiting.set(uri, resolve);
      });
      await connection.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId, version: 1, text },
      });
      const result = await step(
        diagnostics,
        `no diagnostics were published for ${fileName}`,
      );
      waiting.delete(uri);
      return { uri, diagnostics: result };
    },

    async codeActions(uri, diagnostic) {
      const actions = await step(
        connection.sendRequest<CodeAction[] | null>("textDocument/codeAction", {
          textDocument: { uri },
          range: diagnostic.range,
          context: { diagnostics: [diagnostic] },
        }),
        "textDocument/codeAction got no response",
      );
      return actions ?? [];
    },

    async shutdown() {
      await step(
        connection.sendRequest("shutdown"),
        "shutdown got no response",
      );
      await connection.sendNotification("exit");
      child.stdin.end();
      const code = await withTimeout(exited, () =>
        failure("gale kept running after exit"),
      );
      connection.dispose();
      return code;
    },

    dispose,
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  onTimeout: () => Error,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(onTimeout());
    }, LSP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** The rule names gale reported, for readable assertion failures. */
export function codes(diagnostics: readonly Diagnostic[]): (string | number)[] {
  return diagnostics.flatMap((diagnostic) =>
    diagnostic.code === undefined ? [] : [diagnostic.code],
  );
}
