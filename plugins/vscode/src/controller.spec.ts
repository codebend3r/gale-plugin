import { existsSync } from "node:fs";
import { missingBinaryMessages } from "@gale-plugin/contract";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import which from "which";
import { LanguageClient } from "../test/fake-language-client.ts";
import {
  openFolder,
  resetVscode,
  state,
  window,
  commands,
} from "../test/vscode-mock.ts";
import { GaleController, RESTART_DEBOUNCE_MS } from "./controller.ts";

vi.mock(
  "vscode-languageclient/node",
  () => import("../test/fake-language-client.ts"),
);
vi.mock("which", () => ({ default: { sync: vi.fn() } }));
vi.mock("node:fs", () => ({ existsSync: vi.fn() }));

// @types/which overloads `sync`; the controller always calls the nothrow form.
const whichSync = which.sync as unknown as Mock<
  (command: string, options: { nothrow: true }) => string | null
>;

const macArm = { os: "darwin", arch: "arm64" } as const;
const projectBinary =
  "/work/app/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale";

let controller: GaleController;

/** Fires the debounce timer and waits for the reconcile it queues. */
async function reconcile(): Promise<void> {
  controller.requestReconcile();
  await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);
  await controller.settled();
}

function only<T>(items: readonly T[]): T {
  expect(items).toHaveLength(1);
  return items[0] as T;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetVscode();
  LanguageClient.reset();
  whichSync.mockReturnValue(null);
  vi.mocked(existsSync).mockReturnValue(false);
  controller = new GaleController(macArm);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("starting the server", () => {
  it("starts a client with the resolved command, args, root, and languages", async () => {
    openFolder("/work/app");
    state.settings.set("gale.path", "/opt/gale/bin/gale");
    state.settings.set("gale.configPath", "config/gale.json");

    await reconcile();

    const client = only(LanguageClient.running());
    expect(client.id).toBe("gale");
    expect(client.serverOptions).toEqual({
      command: "/opt/gale/bin/gale",
      args: ["--lsp", "--config", "config/gale.json"],
      options: { cwd: "/work/app" },
    });
    expect(client.clientOptions).toEqual({
      documentSelector: [
        { scheme: "file", language: "css" },
        { scheme: "file", language: "scss" },
        { scheme: "file", language: "less" },
        { scheme: "file", language: "sass" },
      ],
      outputChannel: only(state.outputChannels),
    });
    expect(only(state.outputChannels)).toMatchObject({
      name: "Gale",
      options: { log: true },
    });
  });

  it("prefers the project install over PATH", async () => {
    openFolder("/work/app");
    vi.mocked(existsSync).mockReturnValue(true);
    whichSync.mockReturnValue("/usr/local/bin/gale");

    await reconcile();

    expect(existsSync).toHaveBeenCalledWith(projectBinary);
    expect(only(LanguageClient.running()).serverOptions).toMatchObject({
      command: projectBinary,
    });
  });

  it("falls back to gale on PATH", async () => {
    openFolder("/work/app");
    whichSync.mockReturnValue("/usr/local/bin/gale");

    await reconcile();

    expect(whichSync).toHaveBeenCalledWith("gale", { nothrow: true });
    expect(only(LanguageClient.running()).serverOptions).toMatchObject({
      command: "/usr/local/bin/gale",
    });
  });

  it("runs without a working directory or watchers when no folder is open", async () => {
    whichSync.mockReturnValue("/usr/local/bin/gale");

    await reconcile();

    expect(existsSync).not.toHaveBeenCalled();
    expect(only(LanguageClient.running()).serverOptions).toEqual({
      command: "/usr/local/bin/gale",
      args: ["--lsp"],
      options: {},
    });
    expect(state.watchers).toEqual([]);
  });

  it("treats non-string and blank path settings as unset", async () => {
    openFolder("/work/app");
    state.settings.set("gale.path", "   ");
    state.settings.set("gale.configPath", 42);
    whichSync.mockReturnValue("/usr/local/bin/gale");

    await reconcile();

    expect(only(LanguageClient.running()).serverOptions).toMatchObject({
      command: "/usr/local/bin/gale",
      args: ["--lsp"],
    });
  });

  it("trims whitespace around path settings", async () => {
    openFolder("/work/app");
    state.settings.set("gale.path", " /opt/gale/bin/gale\n");

    await reconcile();

    expect(only(LanguageClient.running()).serverOptions).toMatchObject({
      command: "/opt/gale/bin/gale",
    });
  });
});

describe("gale.enable", () => {
  it("starts nothing when set to false", async () => {
    state.settings.set("gale.enable", false);
    whichSync.mockReturnValue("/usr/local/bin/gale");

    await reconcile();

    expect(LanguageClient.instances).toEqual([]);
    expect(window.showErrorMessage).not.toHaveBeenCalled();
  });

  it("stops a running session when turned off", async () => {
    openFolder("/work/app");
    whichSync.mockReturnValue("/usr/local/bin/gale");
    await reconcile();
    const first = only(LanguageClient.running());

    state.settings.set("gale.enable", false);
    await reconcile();

    expect(first.stop).toHaveBeenCalledOnce();
    expect(LanguageClient.running()).toEqual([]);
    for (const watcher of state.watchers) {
      expect(watcher.dispose).toHaveBeenCalledOnce();
    }
  });

  it("only disables for an explicit false", async () => {
    state.settings.set("gale.enable", "false");
    whichSync.mockReturnValue("/usr/local/bin/gale");

    await reconcile();

    expect(LanguageClient.running()).toHaveLength(1);
  });
});

describe("missing binary", () => {
  it("shows the install message with an Open Settings button and starts nothing", async () => {
    openFolder("/work/app");

    await reconcile();

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      missingBinaryMessages.vscode,
      "Open Settings",
    );
    expect(LanguageClient.instances).toEqual([]);
    expect(state.watchers).toEqual([]);
  });

  it("opens settings filtered to gale.path when asked", async () => {
    window.showErrorMessage.mockResolvedValue("Open Settings");

    await reconcile();
    await vi.waitFor(() => {
      expect(commands.executeCommand).toHaveBeenCalledWith(
        "workbench.action.openSettings",
        "gale.path",
      );
    });
  });

  it("does nothing more when the message is dismissed", async () => {
    await reconcile();
    await Promise.resolve();

    expect(commands.executeCommand).not.toHaveBeenCalled();
  });
});

describe("config watchers", () => {
  beforeEach(() => {
    openFolder("/work/app");
    whichSync.mockReturnValue("/usr/local/bin/gale");
  });

  it("watches the config file names at the root", async () => {
    await reconcile();

    const watcher = only(state.watchers);
    expect(watcher.pattern.base).toBe("/work/app");
    expect(watcher.pattern.pattern).toBe(
      "{gale.json,gale.toml,.stylelintrc,.stylelintrc.json,.stylelintrc.yml,.stylelintrc.yaml," +
        "stylelint.config.js,stylelint.config.mjs,stylelint.config.cjs," +
        ".stylelintrc.js,.stylelintrc.cjs,.stylelintrc.mjs,package.json}",
    );
  });

  it("also watches the configured config file", async () => {
    state.settings.set("gale.configPath", "../shared/gale.toml");

    await reconcile();

    expect(state.watchers[1]?.pattern).toEqual({
      base: "/work/shared",
      pattern: "gale.toml",
    });
  });

  it.each(["create", "change", "delete"] as const)(
    "restarts when a config file is %sd",
    async (event) => {
      await reconcile();
      const first = only(LanguageClient.running());

      state.watchers[0]?.fire(event, "/work/app/gale.json");
      await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);
      await controller.settled();

      expect(first.stop).toHaveBeenCalledOnce();
      expect(LanguageClient.instances).toHaveLength(2);
      expect(LanguageClient.running()).toHaveLength(1);
    },
  );

  it("restarts when the configured config file changes", async () => {
    state.settings.set("gale.configPath", "config/lint.json");
    await reconcile();

    state.watchers[1]?.fire("change", "/work/app/config/lint.json");
    await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);
    await controller.settled();

    expect(LanguageClient.instances).toHaveLength(2);
  });

  it("ignores events that can't change Gale's config", async () => {
    await reconcile();

    state.watchers[0]?.fire(
      "change",
      "/work/app/node_modules/pkg/package.json",
    );
    await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);
    await controller.settled();

    expect(LanguageClient.instances).toHaveLength(1);
  });
});

describe("scheduling", () => {
  beforeEach(() => {
    openFolder("/work/app");
    whichSync.mockReturnValue("/usr/local/bin/gale");
  });

  it("coalesces triggers inside the debounce window into one reconcile", async () => {
    controller.requestReconcile();
    await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS - 1);
    controller.requestReconcile();
    await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS - 1);
    controller.requestReconcile();

    expect(LanguageClient.instances).toEqual([]);
    await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);
    await controller.settled();

    expect(LanguageClient.instances).toHaveLength(1);
  });

  it("runs overlapping reconciles one at a time and leaves one session", async () => {
    let finishFirstStart = (): void => undefined;
    LanguageClient.onStart.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFirstStart = resolve;
        }),
    );

    controller.requestReconcile();
    await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);
    controller.requestReconcile();
    await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);

    // The second reconcile waits for the first start to finish.
    expect(LanguageClient.instances).toHaveLength(1);

    finishFirstStart();
    await controller.settled();

    const [first, second] = LanguageClient.instances;
    expect(first?.stop).toHaveBeenCalledOnce();
    expect(LanguageClient.running()).toEqual([second]);
  });

  it("drops a client whose start fails, without trying to stop it later", async () => {
    LanguageClient.onStart.mockRejectedValueOnce(new Error("spawn EACCES"));

    await reconcile();

    const failed = only(LanguageClient.instances);
    expect(LanguageClient.running()).toEqual([]);
    expect(only(state.watchers).dispose).toHaveBeenCalledOnce();

    await reconcile();

    expect(failed.stop).not.toHaveBeenCalled();
    expect(LanguageClient.running()).toHaveLength(1);
  });

  it("reports an unexpected error and keeps processing later triggers", async () => {
    await reconcile();
    const first = only(LanguageClient.running());
    first.stop.mockImplementationOnce(() => {
      first.running = false;
      return Promise.reject(new Error("connection lost"));
    });

    await reconcile();

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      "Gale: Error: connection lost",
    );

    await reconcile();

    expect(LanguageClient.running()).toHaveLength(1);
  });
});

describe("dispose", () => {
  beforeEach(() => {
    openFolder("/work/app");
    whichSync.mockReturnValue("/usr/local/bin/gale");
  });

  it("stops the session, disposes the watchers, and closes the output channel", async () => {
    await reconcile();
    const client = only(LanguageClient.running());

    await controller.dispose();

    expect(client.stop).toHaveBeenCalledOnce();
    expect(only(state.watchers).dispose).toHaveBeenCalledOnce();
    expect(only(state.outputChannels).dispose).toHaveBeenCalledOnce();
  });

  it("cancels a pending reconcile", async () => {
    controller.requestReconcile();

    await controller.dispose();
    await vi.advanceTimersByTimeAsync(RESTART_DEBOUNCE_MS);

    expect(LanguageClient.instances).toEqual([]);
  });
});
