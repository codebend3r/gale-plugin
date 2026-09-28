/**
 * Stands in for `vscode-languageclient/node` in unit tests. Each instance
 * records how it was built and whether it's running.
 */
import { vi } from "vitest";

export class LanguageClient {
  static instances: LanguageClient[] = [];
  /** Runs inside every `start()`; tests override it to delay or fail a start. */
  static onStart = vi.fn(() => Promise.resolve());

  readonly id: string;
  readonly name: string;
  readonly serverOptions: unknown;
  readonly clientOptions: unknown;
  running = false;

  constructor(
    id: string,
    name: string,
    serverOptions: unknown,
    clientOptions: unknown,
  ) {
    this.id = id;
    this.name = name;
    this.serverOptions = serverOptions;
    this.clientOptions = clientOptions;
    LanguageClient.instances.push(this);
  }

  start = vi.fn(async () => {
    await LanguageClient.onStart();
    this.running = true;
  });

  stop = vi.fn(() => {
    this.running = false;
    return Promise.resolve();
  });

  static reset(): void {
    LanguageClient.instances = [];
    LanguageClient.onStart = vi.fn(() => Promise.resolve());
  }

  static running(): LanguageClient[] {
    return LanguageClient.instances.filter((client) => client.running);
  }
}
