import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import which from "which";
import { LanguageClient } from "../test/fake-language-client.ts";
import {
  changeConfiguration,
  resetVscode,
  state,
} from "../test/vscode-mock.ts";
import { RESTART_DEBOUNCE_MS } from "./controller.ts";
import { activate, deactivate } from "./extension.ts";

vi.mock(
  "vscode-languageclient/node",
  () => import("../test/fake-language-client.ts"),
);
vi.mock("which", () => ({ default: { sync: vi.fn() } }));

type Context = Parameters<typeof activate>[0];

function activateExtension(): { subscriptions: unknown[] } {
  const context = { subscriptions: [] as unknown[] };
  activate(context as unknown as Context);
  return context;
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);
}

beforeEach(() => {
  vi.useFakeTimers();
  resetVscode();
  LanguageClient.reset();
  vi.mocked(which.sync).mockReturnValue("/usr/local/bin/gale");
});

afterEach(async () => {
  await deactivate();
  vi.useRealTimers();
});

describe("activate", () => {
  it("starts the server and registers its subscriptions", async () => {
    const context = activateExtension();
    await settle();

    expect(LanguageClient.running()).toHaveLength(1);
    expect(context.subscriptions).toHaveLength(2);
  });

  it("restarts the server from the restart command", async () => {
    activateExtension();
    await settle();

    await state.commands.get("gale.restart")?.();
    await settle();

    expect(LanguageClient.instances).toHaveLength(2);
    expect(LanguageClient.running()).toHaveLength(1);
  });

  it("restarts the server when a gale setting changes", async () => {
    activateExtension();
    await settle();

    changeConfiguration(["gale", "gale.configPath"]);
    await settle();

    expect(LanguageClient.instances).toHaveLength(2);
  });

  it("ignores changes to other settings", async () => {
    activateExtension();
    await settle();

    changeConfiguration(["editor"]);
    await settle();

    expect(LanguageClient.instances).toHaveLength(1);
  });
});

describe("deactivate", () => {
  it("stops the server", async () => {
    activateExtension();
    await settle();

    await deactivate();

    expect(LanguageClient.running()).toEqual([]);
  });

  it("does nothing when the extension never activated", async () => {
    await expect(deactivate()).resolves.toBeUndefined();
  });
});
