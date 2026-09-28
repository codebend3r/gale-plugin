/**
 * Stands in for the `vscode` module in unit tests (aliased in
 * vitest.config.ts). It covers only the API surface the extension uses.
 */
import { vi } from "vitest";

type Listener<T> = (value: T) => void;
type WatchEvent = "create" | "change" | "delete";

export class Uri {
  readonly fsPath: string;

  private constructor(fsPath: string) {
    this.fsPath = fsPath;
  }

  static file(fsPath: string): Uri {
    return new Uri(fsPath);
  }
}

export class RelativePattern {
  readonly base: string;
  readonly pattern: string;

  constructor(base: string, pattern: string) {
    this.base = base;
    this.pattern = pattern;
  }
}

export class FakeWatcher {
  readonly pattern: RelativePattern;
  readonly dispose = vi.fn();
  private readonly listeners = new Map<WatchEvent, Listener<Uri>[]>();

  constructor(pattern: RelativePattern) {
    this.pattern = pattern;
  }

  onDidCreate = (listener: Listener<Uri>) => this.listen("create", listener);
  onDidChange = (listener: Listener<Uri>) => this.listen("change", listener);
  onDidDelete = (listener: Listener<Uri>) => this.listen("delete", listener);

  fire(event: WatchEvent, fsPath: string): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(Uri.file(fsPath));
    }
  }

  private listen(event: WatchEvent, listener: Listener<Uri>) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return { dispose: vi.fn() };
  }
}

interface ConfigurationChangeEvent {
  affectsConfiguration(section: string): boolean;
}

export interface FakeOutputChannel {
  readonly name: string;
  readonly options: { log: true };
  readonly dispose: ReturnType<typeof vi.fn>;
}

export const state = {
  settings: new Map<string, unknown>(),
  workspaceFolders: undefined as { uri: Uri }[] | undefined,
  watchers: [] as FakeWatcher[],
  outputChannels: [] as FakeOutputChannel[],
  configListeners: [] as Listener<ConfigurationChangeEvent>[],
  commands: new Map<string, () => unknown>(),
};

export function resetVscode(): void {
  state.settings.clear();
  state.workspaceFolders = undefined;
  state.watchers = [];
  state.outputChannels = [];
  state.configListeners = [];
  state.commands.clear();
  vi.clearAllMocks();
  window.showErrorMessage.mockResolvedValue(undefined);
}

export function openFolder(fsPath: string): void {
  state.workspaceFolders = [{ uri: Uri.file(fsPath) }];
}

export function changeConfiguration(sections: string[]): void {
  const event = {
    affectsConfiguration: (section: string) => sections.includes(section),
  };
  for (const listener of state.configListeners) {
    listener(event);
  }
}

export const workspace = {
  getConfiguration: () => ({
    get: (key: string): unknown => state.settings.get(key),
  }),
  get workspaceFolders() {
    return state.workspaceFolders;
  },
  createFileSystemWatcher: (pattern: RelativePattern): FakeWatcher => {
    const watcher = new FakeWatcher(pattern);
    state.watchers.push(watcher);
    return watcher;
  },
  onDidChangeConfiguration: (listener: Listener<ConfigurationChangeEvent>) => {
    state.configListeners.push(listener);
    return { dispose: vi.fn() };
  },
};

export const window = {
  showErrorMessage:
    vi.fn<
      (message: string, ...items: string[]) => Promise<string | undefined>
    >(),
  createOutputChannel: (name: string, options: { log: true }) => {
    const channel = { name, options, dispose: vi.fn() };
    state.outputChannels.push(channel);
    return channel;
  },
};

export const commands = {
  registerCommand: vi.fn((id: string, handler: () => unknown) => {
    state.commands.set(id, handler);
    return { dispose: vi.fn() };
  }),
  executeCommand: vi.fn(() => Promise.resolve()),
};
