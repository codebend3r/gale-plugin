# Gale editor plugins: Nx monorepo design

**Date:** 2026-09-27
**Branch:** `nx-monorepo`
**Status:** approved and implemented on this branch

**Revision (2026-09-27):** seven simplifications from the review are folded in.
1. VS Code uses one `reconcile()` for every trigger.
2. The cross-platform path rules are gone: the server runs from the workspace root and each language uses its own path library.
3. Test cases are typed TypeScript, and the generator writes native Rust and Kotlin tests from them.
4. Each language implements only the functions its editor uses.
5. The VS Code `Host` wrapper is gone.
6. `libs/spec` and `libs/core` are merged into `libs/contract`, and the TypeScript libraries have no build step.
7. VS Code uses the `which` npm package.

## 1. Goal

Rewrite `gale-plugin` as an Nx monorepo holding three editor clients for
[Gale](https://github.com/codebend3r/gale), a Rust CSS linter:

- **VS Code** (TypeScript)
- **Zed** (Rust compiled to WASM)
- **WebStorm** (Kotlin, IntelliJ Platform)

Each client runs `gale --lsp` and shows its diagnostics and quick fixes for CSS,
SCSS, Less, and Sass. The three share one set of facts and one set of test cases.
Every piece of plugin logic has unit tests, and a 100% coverage gate enforces it.
One command, `bun system-check`, runs every quality check.

### Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Distribution | Local installs only. No marketplace publishing, signing, or release pipelines. |
| Binary acquisition | Find an installed `gale` only. Never download it. |
| Sharing strategy | One TypeScript library holds the shared facts, the shared test cases, and the TypeScript implementation. A code generator turns the facts and test cases into Rust and Kotlin files. Logic is written once per language and checked by the same cases. |
| Config changes | VS Code and WebStorm restart the server when a config file changes. Zed has no file-watching API, so users restart manually. |
| Testing | Unit tests with a 100% coverage gate. No editor-host integration tests. |
| Quality entry point | `bun system-check`, which CI also runs. |
| Package manager | Bun, with exact version pins (`bunfig.toml` `exact = true`). |
| Platforms | Built and tested on macOS and Linux. Windows isn't tested. |

### What Gale provides (verified against `~/Developer/git/gale`)

- **Server command:** `gale --lsp [--config <path>]`, over stdio.
- **Capabilities:** full-text document sync, pushed diagnostics (`source: "gale"`, `code: <rule name>`), and quick-fix code actions. No formatting.
- **Config loading:** config is read once, in `initialize`. It comes from `--config` if given (a relative path resolves against the server's working directory), otherwise from the first config file found walking up from `rootUri`, otherwise from the cwd. The server ignores `workspace/didChangeWatchedFiles`, so picking up a config change needs a server restart.
- **Config file names**, in priority order (`gale_config::CONFIG_FILENAMES`):
  1. `gale.json`, `gale.toml`
  2. `.stylelintrc`, `.stylelintrc.json`, `.stylelintrc.yml`, `.stylelintrc.yaml`
  3. `stylelint.config.js`, `stylelint.config.mjs`, `stylelint.config.cjs`
  4. `.stylelintrc.js`, `.stylelintrc.cjs`, `.stylelintrc.mjs`
  5. Lowest priority: a `package.json` that has a `"stylelint"` field.
- **Syntax detection:** by extension. `.scss`, `.less`, and `.sass` get their own syntax; anything else is treated as CSS.
- **npm package:** `@codebend3r/gale` ships native binaries at `bin/<rust-target>/gale` (`gale.exe` on Windows). `node_modules/.bin/gale` is a Node wrapper script, not the binary.
- **Release targets:**
  - macOS: `aarch64-apple-darwin`, `x86_64-apple-darwin`
  - Linux: `aarch64-unknown-linux-gnu`, `x86_64-unknown-linux-gnu`
  - Windows: `x86_64-pc-windows-msvc`

### Defects in the current extension that this rewrite fixes

1. **Missing binary goes unreported.** `findBinary` never returns `undefined`, so the "binary not found" message can't be reached. A missing binary shows up as an unclear spawn failure instead.
2. **It runs the Node wrapper.** It spawns `node_modules/.bin/gale`, which needs `node` on `PATH` and fails on Windows.
3. **Config watching does nothing.** It watches config files through `synchronize.fileEvents`, but the server ignores those events, so config edits never apply.
4. **A relative `gale.configPath` resolves in the wrong place.** It resolves against whatever working directory VS Code gives the server. The fix is to start the server in the workspace root.
5. **Overlapping restarts.** A settings change during a slow start can race a stop against a start. The rewrite runs every restart through one serialized `reconcile()`.

## 2. Repository layout

```
gale-plugin/
├── package.json            root: bun workspaces, `system-check` script
├── bun.lock · bunfig.toml · nx.json · tsconfig.base.json
├── eslint.config.mjs · .prettierrc · .prettierignore
├── libs/
│   └── contract/           TS: facts + typed test cases + TypeScript implementation
├── tools/
│   └── codegen/            TS: local Nx plugin with a sync generator
├── plugins/
│   ├── vscode/             TS: VS Code extension → .vsix
│   ├── zed/                Rust: Zed extension → extension.wasm
│   └── webstorm/           Kotlin: WebStorm plugin → .zip
├── docs/superpowers/specs/ design docs
└── .github/workflows/ci.yml
```

### Nx projects

| Project | Path | Package name | Kind | Depends on |
|---|---|---|---|---|
| `contract` | `libs/contract` | `@gale-plugin/contract` | TS library (source only) | none |
| `codegen` | `tools/codegen` | `@gale-plugin/codegen` | Nx local plugin (source only) | `contract` |
| `vscode` | `plugins/vscode` | `gale-lint` | TS app | `contract` |
| `zed` | `plugins/zed` | n/a (`project.json` only) | Rust crate | `contract` (implicit) |
| `webstorm` | `plugins/webstorm` | n/a (`project.json` only) | Gradle project | `contract` (implicit) |

- **Workspaces:** root `workspaces` is `["libs/*", "tools/*", "plugins/vscode"]`, and internal dependencies use `workspace:*`.
- **Source-only libraries:** `contract` and `codegen` have no `build` target. Their `package.json` `exports` point at `src/index.ts`; esbuild, Vitest, and Nx all read the TypeScript directly, and `typecheck` catches compile errors.
- **Rust and Kotlin projects:** `zed` and `webstorm` declare `implicitDependencies: ["contract"]` so `nx affected` sees the link. Their targets are plain `nx:run-commands` with `inputs` that cover only their own project folder, plus `outputs` and `cache: true`. Every file they read, including generated code and generated tests, lives in their own folder, so the cache stays correct without listing cross-project inputs. We don't use `@nx/gradle` or `@monodon/rust`, which add setup, and `@monodon/rust` isn't verified on Nx 23.

### Files removed from the current root

`src/extension.ts`, `tsconfig.json`, and `.vscodeignore` move into
`plugins/vscode/`, and `README.md` is rewritten. `LICENSE`, `bunfig.toml`, and
`.gitignore` stay, with `.gitignore` extended for Nx, Cargo, and Gradle outputs.

## 3. The contract library (`libs/contract`)

This library holds three things:
- **`src/facts.ts`:** the shared facts.
- **`src/cases/`:** the shared test cases.
- **`src/*.ts`:** the TypeScript implementation of the contract functions (section 4), which VS Code imports.

Rule: every field in `facts` and every function has a consumer. Nothing is kept for
symmetry.

### Facts (`src/facts.ts`)

```ts
export const facts = {
  server: { command: "gale", lspArg: "--lsp", configArg: "--config" },
  languages: [
    { id: "css",  extensions: [".css"],  zedName: "CSS"  },
    { id: "scss", extensions: [".scss"], zedName: "SCSS" },
    { id: "less", extensions: [".less"], zedName: "LESS" },
    { id: "sass", extensions: [".sass"], zedName: "SASS" },
  ],
  configFileNames: [/* Gale's 12 names, in its priority order */],
  packageJsonFileName: "package.json",
  npmPackage: { name: "@codebend3r/gale", binDir: "bin" },
  platforms: [
    { os: "darwin", arch: "arm64", target: "aarch64-apple-darwin" },
    { os: "darwin", arch: "x64",   target: "x86_64-apple-darwin" },
    { os: "linux",  arch: "arm64", target: "aarch64-unknown-linux-gnu" },
    { os: "linux",  arch: "x64",   target: "x86_64-unknown-linux-gnu" },
    { os: "win32",  arch: "x64",   target: "x86_64-pc-windows-msvc" },
  ],
  settings: {
    enable: {
      type: "boolean", default: true,
      description: "Enable the Gale linter.",
    },
    configPath: {
      type: "string", default: "",
      description: "Path to a Gale config file. Relative paths resolve from the workspace root. Leave empty to let Gale find one.",
    },
    binaryPath: {
      type: "string", default: "",
      description: "Absolute path to the gale binary. Leave empty to use the project's @codebend3r/gale package, then PATH.",
    },
  },
  vscode: {
    settingKeys: { enable: "gale.enable", configPath: "gale.configPath", binaryPath: "gale.path" },
    restartCommand: { id: "gale.restart", title: "Gale: Restart Language Server" },
  },
  missingBinary: {
    template:
      "Gale couldn't find the gale binary. Install it in this project with " +
      "`bun add -d @codebend3r/gale`, install it globally with `cargo install gale-lint`, " +
      "or set {setting}.",
    settingHint: {
      vscode: "`gale.path` in Settings",
      zed: "`lsp.gale.binary.path` in settings.json",
      webstorm: "Settings › Tools › Gale › Binary path",
    },
  },
} as const;
```

| Fact | Consumers |
|---|---|
| `server` | all three plugins (`serverArgs`, spawning) |
| `languages` | VS Code (document selector, generated `activationEvents`), Zed (generated `extension.toml`), WebStorm (`isSupportedFile`) |
| `configFileNames`, `packageJsonFileName` | VS Code and WebStorm (`shouldRestart`, VS Code watcher pattern) |
| `npmPackage`, `platforms` | all three plugins (`rustTarget`, `projectBinaryPath`) |
| `settings` | VS Code (generated `contributes.configuration`), WebStorm (generated defaults and setting-page descriptions). The `configPath` key is also the Zed setting name. |
| `vscode` | VS Code only: setting keys and the restart command, read at runtime and in the generated manifest |
| `missingBinary` | TS derives `missingBinaryMessages` for all three editors. The generator writes Zed's and WebStorm's finished strings into their generated files. |

- **Enable in Zed:** there's no Zed enable setting. Zed turns servers off natively with `"language_servers": ["!gale", "..."]`.
- **VS Code keys:** unchanged from today, so existing settings keep working.
- **Windows arm64:** left out of `platforms` because Gale's release doesn't build it. On that platform the project-install lookup is skipped and `PATH` still works.

### Test cases (`src/cases/`)

The cases are typed TypeScript data (`satisfies readonly Case<Input, Expected>[]`),
so the compiler checks their shape. There's one file per function under test.

| File | Function | Run by |
|---|---|---|
| `platform.ts` | `rustTarget(platform)` and `binaryFileName(os)` | TS, Rust, Kotlin |
| `project-binary-path.ts` | `projectBinaryPath(root, platform)` | TS, Rust, Kotlin |
| `resolve-binary.ts` | `resolveBinary(settings, probe)` | TS, Rust, Kotlin |
| `server-args.ts` | `serverArgs(settings)` | TS, Rust, Kotlin |
| `should-restart.ts` | `shouldRestart(changedPath, root, settings)` | TS, Kotlin |

Example (`resolve-binary.ts`):

```ts
{
  name: "project install wins over PATH",
  input: {
    settings: { configPath: "", binaryPath: "" },
    probe: {
      projectBinary: "/work/app/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale",
      which: "/usr/local/bin/gale",
    },
  },
  expected: "/work/app/node_modules/@codebend3r/gale/bin/aarch64-apple-darwin/gale",
}
```

- **How each language runs them:** TypeScript runs them directly with `describe.each`. The code generator writes them into native test files for Rust and Kotlin (section 5).
- **Path style:** all case paths are POSIX-style, so they pass on macOS and Linux.
- **Coverage tests:** the contract's own tests check that the cases cover the facts. Every `platforms` row appears in `platform.ts`, and every config file name appears in at least one `should-restart.ts` case. That way the generated tests also exercise every fact in each language.

## 4. The shared contract

Every function is pure. Editor I/O happens in glue code, which passes the
results in.

### Types

```
Os           = "darwin" | "linux" | "win32"
Platform     = { os: Os, arch: string }                    // arch: "arm64", "x64", or anything else
PathSettings = { configPath: string, binaryPath: string }  // the only settings these functions read
Probe        = { projectBinary: string | null, which: string | null }
```

- **Probes are eager:** the host gathers `projectBinary` (the `projectBinaryPath`, if it exists on disk) and `which` before calling `resolveBinary`. Both checks are cheap.
- **Platform mapping is glue:** each host maps its native platform values onto `Platform`.
- **`enable` isn't an input:** starting or not starting the server is glue logic, and none of these functions reads it.

### Who implements what

| Function | TypeScript | Rust (Zed) | Kotlin (WebStorm) |
|---|---|---|---|
| `rustTarget`, `binaryFileName` | ✓ | ✓ | ✓ |
| `projectBinaryPath` | ✓ | ✓ | ✓ |
| `resolveBinary` | ✓ | ✓ | ✓ |
| `serverArgs` | ✓ | ✓ | ✓ |
| `shouldRestart` | ✓ | — (Zed never restarts) | ✓ |

### Paths

- **No custom path rules.** TypeScript uses `node:path` and Kotlin uses `java.nio.file.Path`, both on the real OS.
- **Rust uses `/`.** Zed extensions run as WASM, where `std::path` follows POSIX rules only, so Rust joins with `/`. Its only join is the fixed `node_modules/...` suffix.
- **Paths are compared exactly.**
- **Server working directory:** every editor starts the server with the workspace root as its working directory. Relative config paths then resolve the way they would if you ran `gale` from the project root, so no function has to make paths absolute.

### Functions

1. **`rustTarget(platform)`** returns the `target` from `facts.platforms`, or `null`.
   **`binaryFileName(os)`** returns `gale.exe` on `win32` and `gale` otherwise.
2. **`projectBinaryPath(root, platform)`** returns
   `<root>/node_modules/@codebend3r/gale/bin/<target>/<binaryFileName>`.
   It returns `null` when `root` is null or `rustTarget` is null.
3. **`resolveBinary(settings, probe)`** returns the first non-empty value of
   `settings.binaryPath` (used as given; the setting is documented as an absolute path),
   `probe.projectBinary`, and `probe.which`, or `null` when all three are empty.
4. **`serverArgs(settings)`** returns `["--lsp"]`, plus `"--config", configPath` when `configPath` is non-empty. The path is passed exactly as the user wrote it.
5. **`shouldRestart(changedPath, root, settings)`** (`root` is never null here, because watchers only exist when there's a workspace root). It checks these rules in order:
   1. `false` if any path segment of `changedPath` is `node_modules`.
   2. `true` if `configPath` is non-empty and `changedPath` equals `configPath` resolved against `root`.
   3. `true` if both hold:
      - the file name is in `configFileNames` or is `package.json`
      - its directory is `root` or an ancestor of `root` (Gale only looks for config from the root upward)
   4. `false` otherwise.

The TypeScript side also exports **`missingBinaryMessages`**, a record with one
finished message per editor, built from `facts.missingBinary`. Rust and Kotlin
get their editor's finished string from generated code, so they don't fill in
the template themselves.

### How each host probes and sets the working directory

| | `projectBinary` (the `projectBinaryPath` when this holds) | `which` | Server working directory |
|---|---|---|---|
| VS Code | `fs.existsSync(projectBinaryPath)` | `which.sync("gale", { nothrow: true })` (the `which` npm package) | `ServerOptions.options.cwd` = first workspace folder |
| Zed | `worktree.read_text_file("node_modules/@codebend3r/gale/package.json")` succeeds | `worktree.which("gale")` | set by Zed; checked in R6 |
| WebStorm | `Files.isRegularFile(projectBinaryPath)` | `PathEnvironmentVariableUtil.findInPath("gale")` | `GeneralCommandLine.withWorkDirectory(project.basePath)` |

The Zed probe checks for the npm package instead of the binary, because Zed
extensions can't check whether a file exists and can't read binary files. If
the package is present but has no binary for the platform, the spawn fails and
Zed logs the path. See risk R1.

## 5. Code generation (`tools/codegen`)

`tools/codegen` is a local Nx plugin with one **sync generator**,
`@gale-plugin/codegen:sync`, registered in `nx.json` under
`sync.globalGenerators`. There's one renderer module per output file:

| Output | Contents |
|---|---|
| `plugins/zed/src/generated.rs` | platform table, npm package layout, server args, the `configPath` setting name, Zed's finished missing-binary message |
| `plugins/zed/src/conformance_tests.rs` | one `#[test]` per case in `platform`, `resolve-binary`, and `server-args` |
| `plugins/webstorm/src/main/kotlin/com/codebend3r/gale/generated/GaleFacts.kt` | `object GaleFacts`: platform table, npm package layout, server args, language extensions, config file names, setting defaults and descriptions, WebStorm's finished missing-binary message |
| `plugins/webstorm/src/test/kotlin/com/codebend3r/gale/core/ConformanceTest.kt` | one JUnit `@Test` per case in all four case files |
| `plugins/vscode/package.json` | Only the `contributes.configuration`, `contributes.commands`, and `activationEvents` keys are rewritten. All other keys are left alone. |
| `plugins/zed/extension.toml` | Only the `[language_servers.gale]` `languages` and `language_ids` entries are rewritten. |

- **When it runs:** `nx sync` applies it, and `nx sync:check` fails when any output is stale.
- **Generated-file header:** every generated source file starts with a `// @generated by @gale-plugin/codegen — do not edit` header.
- **Test names:** generated test names come from the case names, in snake_case for Rust and backtick names for Kotlin, so a failure points straight at the case.
- **Formatting:** output is deterministic and already formatted, so `cargo fmt --check`, ktlint, and Prettier all pass on it untouched.
- **VS Code imports `contract` directly** and needs no generated source.

## 6. The plugins

Every plugin has three layers: generated data, logic (the contract plus any
plugin-only logic), and glue (the only code that calls editor APIs).

### 6.1 VS Code (`plugins/vscode`)

- **`src/extension.ts`:** `activate` creates a `GaleController`, registers the `gale.restart` command and a listener for `gale.*` setting changes, and calls `controller.requestReconcile()`. The command and every `gale.*` change also just call `requestReconcile()`. `deactivate` calls `controller.dispose()`.
- **`src/controller.ts`:** `GaleController` has one job: make the running session (client plus watchers) match the current settings and files.
  - **`requestReconcile()`:** waits `RESTART_DEBOUNCE_MS` (250, a local constant) for further triggers. Then it queues one `reconcile()` on a promise chain, so two runs can never overlap.
  - **`reconcile()`:**
    1. Tears down the current session, if any: stops the client and disposes its watchers.
    2. Stops there if `gale.enable` is false.
    3. Resolves the binary. If none is found, it shows `missingBinaryMessages.vscode` as an error with an **Open Settings** button (which opens settings filtered to `gale.path`) and stops there.
    4. Otherwise it starts a new session:
       - a `LanguageClient` with the resolved command, `serverArgs`, `cwd` set to the root, a document selector built from `facts.languages` with `scheme: "file"`, and output channel `Gale`
       - when there's a workspace folder, watchers: one for `{<config names>,package.json}` at the root, and one for the configured config path when it's set. Events that pass `shouldRestart` call `requestReconcile()`.
  - **`dispose()`:** cancels any pending timer and tears down the session.
  - **No wrapper:** it calls `vscode` and `vscode-languageclient` directly. Tests replace both modules (section 7).
- **Workspace scope:** one client, rooted at the first workspace folder, the same as today.
- **Build:** esbuild bundles `src/extension.ts` to `dist/extension.js` (`cjs`, `platform: node`, `external: ["vscode"]`). Then `vsce package --no-dependencies` writes `dist/gale-lint.vsix`. Bundling means the `.vsix` no longer needs `node_modules`.
- **Install:** the `install` target runs `code --install-extension dist/gale-lint.vsix --force`.
- **Engine and client:** `engines.vscode` is `^1.91.0` and `@types/vscode` is pinned to `1.91.0`, the minimum `vscode-languageclient` 10 requires. The language client is `vscode-languageclient` 10.1.2.

### 6.2 Zed (`plugins/zed`)

- **`extension.toml`:**
  - Identity: `id = "gale"`, `name = "Gale"`, `schema_version = 1`, `[lib] kind = "Rust"`, `version = "0.7.0"`.
  - `[language_servers.gale]`: `languages = ["CSS", "SCSS", "SASS", "LESS"]` and `language_ids = { CSS = "css", SCSS = "scss", SASS = "sass", LESS = "less" }`, both generated.
- **`Cargo.toml`:**
  - Library: `crate-type = ["cdylib", "rlib"]`, so the native tests can link.
  - Workspace: an empty `[workspace]` table, because a parent workspace breaks Zed's build.
  - Dependencies: only `zed_extension_api = "0.7.0"`, which also provides `serde_json`. There are no dev-dependencies, since the generated tests need no JSON loading.
- **`src/core.rs`:** `rust_target`, `binary_file_name`, `project_binary_path`, `resolve_binary`, and `server_args`, plus two pieces of Zed-only logic:
  - **Settings parsing:** reads `configPath` from the `LspSettings.settings` JSON value, defaulting to `""` when it's missing or not a string.
  - **Argument override:** when `LspSettings.binary.arguments` is set, those arguments replace `server_args`, following Zed's convention.
- **`src/generated.rs`** and **`src/conformance_tests.rs`:** generated (section 5).
- **`src/lib.rs`:** the glue (about 40 lines). It gathers `LspSettings::for_worktree("gale", worktree)`, `worktree.root_path()`, `zed::current_platform()`, the `package.json` probe, and `worktree.which("gale")`. Then it calls `core` and returns `Ok(Command)` or `Err(message)`; Zed shows errors in its language-server log. It's excluded from coverage because `zed_extension_api` calls panic outside Zed.
- **WASM target:** `wasm32-wasip2`, which Zed builds for itself.
- **Config changes:** documented as a manual `editor: restart language server`.
- **Install:** run `zed: install dev extension` once, pointing at `plugins/zed`. `SCSS` and `SASS` need Zed's `scss` extension, and `LESS` needs its `less` extension; CSS is built in.

### 6.3 WebStorm (`plugins/webstorm`)

- **Build:**
  - **Tooling:** Gradle 9.8.0 wrapper (committed), IntelliJ Platform Gradle Plugin 2.19.0, Kotlin 2.4.20, JVM toolchain 25. `settings.gradle.kts` uses the foojay resolver 1.0.0, so Gradle provisions JDK 25 itself.
  - **Platform dependency:** `local(providers.gradleProperty("idePath").orElse("/Applications/WebStorm.app"))` by default. When the `ideVersion` property is set (CI sets `ORG_GRADLE_PROJECT_ideVersion=2026.2.3`), it's `webstorm(ideVersion)` instead.
  - **Build range:** `sinceBuild = "262"`, with no `untilBuild`, and `kotlin.stdlib.default.dependency = false`.
- **`plugin.xml`:**
  - Identity: plugin id `com.codebend3r.gale`, name "Gale CSS Linter".
  - Dependencies: `<depends>` on `com.intellij.modules.platform` and `com.intellij.modules.lsp`.
  - Registrations:
    - `<platform.lsp.integrationProvider>`
    - `<projectConfigurable parentId="tools">`
    - `<projectListeners>` for `BulkFileListener`
    - notification group `Gale`
    - action `Gale.Restart`, titled "Restart Gale"
- **`core/`** (package `com.codebend3r.gale.core`): all six contract functions, using `java.nio.file.Path`.
- **`generated/`**: `GaleFacts.kt`. Tests include the generated `ConformanceTest.kt`.
- **`ide/`** (package `com.codebend3r.gale.ide`):
  - **`GaleLspIntegrationProvider`:** `fileOpened` returns early when the setting is disabled or the file isn't a supported type. Otherwise it resolves the binary:
    - Found: it calls `ensureClientStarted(GaleClientDescriptor)`.
    - Missing: it shows one notification per project session, with an **Open Settings** action, and doesn't start the client.
  - **`GaleClientDescriptor`** (a `ProjectWideLspClientDescriptor`): `isSupportedFile` matches `GaleFacts` language extensions, and `createCommandLine` builds a `GeneralCommandLine` from the resolved command and `serverArgs`, with `withWorkDirectory(project.basePath)`.
  - **`GaleSettings`:** a project-level `@Service` extending `SimplePersistentStateComponent<GaleSettings.State>`, stored in `gale.xml`, with defaults from `GaleFacts`.
  - **`GaleConfigurable`:** a `BoundConfigurable` with the enable checkbox, config path, and binary path, using browse fields and `GaleFacts` descriptions as help text. `apply()` restarts the server.
    - Restarting calls `fileOpened` again, which re-reads every setting, so disabling in the settings page just stops the server. WebStorm gets the same reconcile behavior as VS Code with no extra branching.
  - **`GaleConfigFileListener`:** a `BulkFileListener` that keeps events for this project that pass `shouldRestart`, then calls `LspClientManager.getInstance(project).stopAndRestartClientsIfNeeded(GaleLspIntegrationProvider::class.java)`.
  - **`RestartGaleAction`:** restarts the client.
  - **API names:** these are the 2026.1.4+ LSP API names. The old `LspServerSupportProvider` names are deprecated.
- **Install:** the `install` target copies the built plugin from `build/distributions/` into WebStorm's plugins folder, and the IDE then needs a restart. The folder defaults to `~/Library/Application Support/JetBrains/WebStorm2026.2/plugins/` and can be overridden with the `pluginsDir` Gradle property. The `run-ide` target launches a sandboxed WebStorm via `runIde`.
- **Known overlap:** WebStorm's built-in Stylelint integration can show duplicate diagnostics when it's also enabled. The README says so.

### 6.4 Shared error handling

| Situation | Behavior |
|---|---|
| No binary found | The editor's missing-binary message with install hints and the settings location. No client start, no crash loop. |
| Server crashes after starting | The editor's LSP framework restarts it with its own backoff. |
| Bad `configPath` | Gale logs `Failed to load config` and uses defaults. The plugins don't validate it again. |
| Config file changed | VS Code (debounced `reconcile()`) and WebStorm restart the server. Zed needs a manual restart. |

## 7. Testing and coverage

Every project's `test` target fails below its coverage threshold. No test
launches a real editor or a real `gale` binary.

| Project | Runner | Gate | What the tests cover |
|---|---|---|---|
| `contract` | Vitest 4.1.11 + v8 | 100% (all four metrics) | every case against the TypeScript implementation (`describe.each`), unit tests for edges the cases don't reach, `missingBinaryMessages`, the check that cases cover every fact |
| `codegen` | Vitest | 100% | output snapshots for every renderer, including the generated test files; preserving non-generated keys in `package.json` and `extension.toml`; out-of-sync detection (uses `createTreeWithEmptyWorkspace`) |
| `vscode` | Vitest; `vscode` aliased to `test/vscode-mock.ts`, `vscode-languageclient/node` replaced with `vi.mock` | 100%, no exclusions | `reconcile()` for enabled, disabled, missing binary (error plus **Open Settings**), and found (client gets the command, args, `cwd`, and document selector); overlapping triggers run one at a time and never leave two sessions; debounce (fake timers); watcher events filtered by `shouldRestart`; restart command; `activate`/`deactivate` |
| `zed` | `cargo test` + `cargo llvm-cov` | 100% lines and regions, `--ignore-filename-regex 'src/lib\.rs$'` | generated `conformance_tests.rs`, plus unit tests for settings parsing and the argument override |
| `webstorm` | JUnit 4.13.2 + `BasePlatformTestCase`, Kover 0.9.9 | 100% lines and branches | `core`: the generated `ConformanceTest.kt` (plain JUnit, no IDE needed). `ide`: settings round trip and defaults, `isSupportedFile`, `createCommandLine` (including working directory), `fileOpened` start/skip/notify, listener filtering, action, and configurable `apply`/`reset`/`isModified`. |

- **Coverage exclusions:** only `plugins/zed/src/lib.rs` is excluded upfront. If a WebStorm class truly can't run in the headless test platform, it may be excluded in `build.gradle.kts`, with a comment giving the reason. Any such exclusion is reported in the pull request.
- **Why Rust has no branch gate:** stable Rust coverage doesn't measure branches. Regions are the closest measure.

## 8. `bun system-check`

The root `package.json`:

```json
"system-check": "nx sync:check && nx format:check && nx run-many -t lint typecheck test build"
```

| Step | TypeScript projects | `zed` | `webstorm` |
|---|---|---|---|
| Generated files current | `nx sync:check` | ← | ← |
| Formatting | Prettier via `nx format:check` | `cargo fmt --check` (in `lint`) | ktlint (in `lint`) |
| Lint | ESLint 10.11.0 + typescript-eslint 8.70.1 | `cargo clippy --all-targets -- -D warnings` | ktlint check + Kotlin `allWarningsAsErrors` |
| Typecheck | `tsc --noEmit` (TypeScript 6.0.3) | none (compiled in `test`/`build`) | none (compiled in `test`/`build`) |
| Test | Vitest with coverage gate | `cargo llvm-cov` with gate | `gradlew test koverVerify` |
| Build | `vscode` only: esbuild + vsce. `contract` and `codegen` have no build. | `cargo build --release --target wasm32-wasip2` | `gradlew buildPlugin` |

Every target is cached by Nx, so an unchanged re-run replays from cache.

**One-time local setup** (documented in the README):
- `rustup target add wasm32-wasip2`
- `rustup component add llvm-tools-preview clippy rustfmt`
- `cargo install cargo-llvm-cov`

Gradle provisions JDK 25 itself.

## 9. CI (`.github/workflows/ci.yml`)

- **Trigger:** push to `main` and pull requests.
- **Runner:** one `ubuntu-latest` job.
- **Setup:**
  - `oven-sh/setup-bun`
  - `dtolnay/rust-toolchain@stable`, with target `wasm32-wasip2` and components `clippy`, `rustfmt`, `llvm-tools-preview`
  - `taiki-e/install-action` for `cargo-llvm-cov`
  - `actions/setup-java` with Temurin 25
  - `gradle/actions/setup-gradle` for caching
- **Environment:** `ORG_GRADLE_PROJECT_ideVersion=2026.2.3`, so Gradle downloads WebStorm instead of looking for a local install.
- **Steps:** `bun install --frozen-lockfile`, then `bun system-check`.

## 10. Pinned versions (verified 2026-09)

| Tool | Version |
|---|---|
| Nx (`nx`, `@nx/js`, `@nx/vitest`, `@nx/eslint`, `@nx/plugin`, `@nx/devkit`) | 23.2.1 |
| TypeScript | 6.0.3 (typescript-eslint doesn't support 7.x yet) |
| Vitest, `@vitest/coverage-v8` | 4.1.11 (the newest `@nx/vitest` 23.2.1 supports) |
| ESLint / typescript-eslint | 10.11.0 / 8.70.1 |
| esbuild | 0.28.2 |
| `vscode-languageclient` / `@vscode/vsce` / `@types/vscode` | 10.1.2 / 4.0.0 / 1.91.0 |
| `zed_extension_api` | 0.7.0 |
| Gradle / IntelliJ Platform Gradle Plugin / Kotlin / Kover | 9.8.0 / 2.19.0 / 2.4.20 / 0.9.9 |

JS packages not listed here, such as Prettier, `which`, and `@types/node`, are
pinned to their latest version at install time.

## 11. Out of scope

- Marketplace publishing, signing, and release workflows.
- Downloading the `gale` binary.
- Testing on Windows. The code uses native path libraries, so Windows likely works, but no tests prove it.
- Multi-root VS Code workspaces: one client, rooted at the first folder.
- Changes to the Gale repo, including making the server reload config itself.
- Per-file nested configs. Gale's LSP resolves config once, from the root.
- Watching files pulled in through a config's `extends`. The restart command covers these.
- Handling the WebStorm Stylelint overlap in code.
- Editor-host integration tests.

## 12. Risks and early checks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Zed's `read_text_file` may not be able to read files in gitignored `node_modules`. | The first Zed task is a quick check with a dev extension. If reads fail, declare the `process:exec` capability and probe with `test -f`. |
| R2 | The LSP API names changed in 2026.1.4, and most docs show the old ones. | Checked against the WebStorm 2026.2.3 jars. `sinceBuild = 262`. |
| R3 | Kover instrumentation may not work together with IntelliJ platform tests. | Check this in the first WebStorm task, before writing the `ide/` tests. |
| R4 | `GaleConfigurable`'s UI may not build headlessly. | Try it. If it fails, exclude that one class with a written reason (section 7). |
| R5 | Version ceilings: TypeScript under 6.1 and Vitest under 5. | Pinned. Revisit when typescript-eslint and `@nx/vitest` add support. |
| R6 | Zed may not start language servers in the worktree root, which would break relative `configPath` values. | Check it in the first Zed task with a relative `configPath`. If Zed uses another working directory, `server_args` in Rust joins a relative `configPath` onto the root with `/`. That's one line, Rust only. |

## 13. Build order

The implementation plan follows this phase order. Each plugin's renderers are
added to `codegen` in that plugin's phase.

1. **Workspace:** Nx, `contract` (facts, cases, TypeScript implementation), `codegen` with the VS Code manifest renderer, and `bun system-check` covering the TypeScript projects.
2. **VS Code:** the rewritten plugin, reaching feature parity plus the fixes in section 1.
3. **Zed:** the R1 and R6 checks first, then the Rust renderers and the plugin.
4. **WebStorm:** the R3 check first, then the Kotlin renderers and the plugin.
5. **Finish:** CI, README, and removing old files.
