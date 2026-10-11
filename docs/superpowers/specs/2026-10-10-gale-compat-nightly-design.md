# Nightly gale compatibility checks: design

**Date:** 2026-10-10
**Status:** draft, awaiting review

## 1. Goal

Catch it within a day when a new gale release breaks any of the three plugins.
A nightly GitHub Actions run installs the newest `@codebend3r/gale` from npm and
drives it the way the plugins do. The same change fixes the two Windows platform
mismatches that would otherwise fail the first run.

### Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Which gale | `@codebend3r/gale@latest` from npm. |
| Trigger | A GitHub Actions cron at 07:00 UTC, plus manual runs and pushes to `main` that change the suite, the contract, or the workflow. |
| Depth | One TypeScript suite that drives gale through the shared contract. No editor-host tests: the Rust and Kotlin conformance tests already hold Zed and WebStorm to the contract, so a gale that fits the contract fits all three plugins. |
| CI isolation | The suite stays out of `bun system-check` and `ci.yml`. A gale release never turns CI or the pre-push hook red. |
| Failure signal | One GitHub issue labeled `gale-compat`: opened on failure, commented on while failures continue, closed on the next pass. |
| Local builds | `GALE_BINARY` runs the suite against an unreleased gale build. |
| Runner | `ubuntu-latest` only. |
| Windows | Fix both mismatches. The contract gains Windows on ARM (part A), and gale's next release ships its Windows binaries (part D). |

### What the probes found (gale 0.2.5, 2026-10-10)

- **LSP.** `initialize` returns `codeActionProvider: true`, `textDocumentSync: 1`
  (full sync), and `serverInfo: { name: "gale-lsp", version }`. Opening a
  document pushes `publishDiagnostics` with `source: "gale"` and the rule name
  as `code`. A `color-hex-length` diagnostic gets a `quickfix` code action that
  carries a `WorkspaceEdit`. CSS, SCSS, Less, and indented Sass all report
  `color-hex-length`.
- **Config files.** gale reads a config containing only
  `{"rules":{"block-no-empty":true}}` from `.stylelintrc.json`,
  `stylelint.config.mjs`, or a `"stylelint"` field in `package.json`. With no
  config, it reports nothing.
- **Shutdown.** gale answers `shutdown` but exits only when stdin closes, not
  on the `exit` notification. Language clients close stdin when they stop, so
  the plugins don't notice. Fixing it belongs in gale and is out of scope here.
- **Platforms.** The npm package ships `platform.cjs`, which exports
  `resolveTarget`, `binaryFileName`, and `supportedPlatforms`. It maps six
  platforms, including `win32-arm64` → `aarch64-pc-windows-msvc`, which
  `facts.platforms` doesn't list.
- **Missing Windows binaries.** The 0.2.5 tarball holds only the four macOS
  and Linux binaries. gale's `release.yml` is `disabled_manually` until npm
  trusted publishing and a crates.io token are set up (see "One-time setup" in
  gale's `PUBLISHING.md`). Until then, 0.2.3 through 0.2.5 were published by
  hand from macOS, which can't build Windows binaries. The same cause leaves
  crates.io's `gale-lint` at 0.1.5, even though the plugins' missing-binary
  message tells users to `cargo install gale-lint`.

## 2. Part A: Windows on ARM in the contract

- `facts.platforms` gains
  `{ os: "win32", arch: "arm64", target: "aarch64-pc-windows-msvc" }`.
- In `rustTargetCases`, "Windows arm64 has no release" becomes "Windows arm64"
  and expects `aarch64-pc-windows-msvc`.
- In `projectBinaryPathCases`, "platform with no release" switches its input
  to `linux`/`riscv64`, which still expects `null`. A new "Windows arm64" case
  expects
  `/work/app/node_modules/@codebend3r/gale/bin/aarch64-pc-windows-msvc/gale.exe`.
- `bun run sync` regenerates `plugins/zed/src/generated.rs`,
  `plugins/zed/src/conformance_tests.rs`, `GaleFacts.kt`, and the Kotlin
  conformance test. The codegen snapshots update to match.
- No editor code changes. Zed already maps `Windows`/`Aarch64` to
  `win32`/`arm64`, WebStorm maps `os.arch` `aarch64` to `arm64`, and VS Code
  reads `process.arch`.

## 3. Part B: the compatibility suite (`tools/gale-compat`)

### Layout

```
tools/gale-compat/
  package.json             @gale-plugin/gale-compat, private
  project.json             lint, lint-fix, typecheck, compat
  tsconfig.json
  vitest.config.ts         *.compat.ts files, global setup, JSON report
  src/
    setup.ts               installs gale, or takes GALE_BINARY
    lsp.ts                 starts gale the way the plugins do and speaks LSP
    fixtures.ts            throwaway sample projects in temp folders
    report.ts              vitest's JSON report → job summary and issue body
    binary.compat.ts
    platforms.compat.ts
    server.compat.ts
    lsp.compat.ts
    config-files.compat.ts
```

Dependencies: `@gale-plugin/contract` (`workspace:*`) and `vscode-jsonrpc`
9.0.3, the version `vscode-languageclient` already pulls in.

### Nx targets

- `lint`, `lint-fix`, and `typecheck` work like `tools/codegen`'s, so
  `bun system-check` keeps the suite's code clean.
- `compat` runs `vitest run` in `tools/gale-compat`. It isn't cached, has no
  coverage gate, and isn't named `test`, so `nx run-many -t test` never
  downloads gale.

### Getting gale

- **Default.** The global setup creates a temp project and runs
  `bun add --exact @codebend3r/gale@<version>`, the install the README
  recommends. `<version>` is `GALE_VERSION`, or `latest` when that's unset.
- **`GALE_BINARY=/abs/path/to/gale`** skips the install. The binary-location
  and platform checks are skipped, since they need the npm package. Every
  other check runs against that binary.
- The setup reads the version from `gale --version` and records it for the
  report.

### The checks

Each check gets its values from the contract instead of repeating them.

1. **Binary location** (`binary.compat.ts`).
   `projectBinaryPath(root, { os: process.platform, arch: process.arch })`
   names an executable file inside the installed package.
2. **Platform list** (`platforms.compat.ts`). Loads the installed package's
   `platform.cjs` and checks that:
   - for every row in `facts.platforms`, `resolveTarget(os, arch)` equals
     `row.target` and gale's `binaryFileName(os)` equals the contract's
   - every pair in `supportedPlatforms()` has a row in `facts.platforms`
   - every row's binary exists at `bin/<target>/<binaryFileName(os)>`
   
   `platform.cjs` is internal to gale's package. If gale renames it, this check
   fails, and that failure is the signal to update the check.
3. **Starting the server** (`server.compat.ts`). gale starts with
   `serverArgs(settings)` and the project root as its working folder, the way
   the plugins start it. A session with `configPath: "config/gale.json"`, in a
   project whose only config is that file, reports the rule that file turns on.
4. **LSP session** (`lsp.compat.ts`). In a project with
   `gale.json` set to `{"rules":{"color-hex-length":"short"}}`:
   - `initialize` advertises `codeActionProvider` and text document sync
   - for each entry in `facts.languages`, opening a document with that
     language id and extension pushes a `color-hex-length` diagnostic with
     `source: "gale"`. The sample is `a { color: #ffffff; }`, or
     `a\n  color: #ffffff\n` for Sass.
   - a code action request for that diagnostic returns a `quickfix` whose edit
     replaces `#ffffff` with `#fff`
   - `shutdown` gets a response, and after `exit` plus closing stdin, the
     process exits with code 0
5. **Config file names** (`config-files.compat.ts`). For each name in
   `facts.configFileNames`, plus `facts.packageJsonFileName` with a
   `"stylelint"` field, an LSP session runs in a fresh project holding only
   that config, which turns on `block-no-empty`. Opening `a {}` must report
   `block-no-empty`. Each file is written in the format its name implies:
   JSON for `.stylelintrc`, `.json`, and `package.json`; YAML for `.yml` and
   `.yaml`; TOML for `gale.toml`; `export default` for `.mjs`; and
   `module.exports` for `.js` and `.cjs`.

Every LSP request and wait has a 10-second timeout, so a hung server fails the
check instead of hanging the job.

### Running it locally

```sh
bunx nx run gale-compat:compat                               # latest from npm
GALE_VERSION=0.2.4 bunx nx run gale-compat:compat            # one version
GALE_BINARY=~/Developer/git/gale/target/release/gale \
  bunx nx run gale-compat:compat                             # a local build
```

## 4. Part C: the nightly workflow (`.github/workflows/gale-compat.yml`)

- **Triggers:**
  - `schedule` at `0 7 * * *`
  - `workflow_dispatch` with an optional `gale-version` input
  - `push` to `main` on changes under `tools/gale-compat/**` or
    `libs/contract/**`, or to the workflow file itself
- **Permissions:** `contents: read`, `issues: write`. A concurrency group stops
  runs from overlapping.
- **Steps:** checkout, `setup-node` 24, `setup-bun`,
  `bun install --frozen-lockfile`, then `bunx nx run gale-compat:compat` with
  `GALE_VERSION` set from the input. `report.ts` then writes the job summary:
  the gale version and a table of every check with its result and the first
  line of any failure.
- **Issue handling** runs after the suite, even when it fails, but only when
  no `gale-version` was given:

  | Suite | Open `gale-compat` issue? | Action |
  |---|---|---|
  | fails | no | Open "Nightly gale compatibility check failing (gale X.Y.Z)" with the failing checks and the run link |
  | fails | yes | Comment with the version, failing checks, and run link |
  | passes | yes | Comment "Passing again with gale X.Y.Z" and close it |
  | passes | no | Nothing |

  The step creates the label if it's missing and uses `gh` with the built-in
  `GITHUB_TOKEN`.
- **One GitHub limit:** in a public repo, GitHub disables scheduled workflows
  after 60 days without commits. It emails a warning first, and turning the
  workflow back on takes one click.

## 5. Part D: gale ships its Windows binaries again

This happens in `~/Developer/git/gale` and doesn't change any code. It finishes
the setup gale's `PUBLISHING.md` describes, then releases through the workflow.

| Step | Who |
|---|---|
| 1. On npmjs.com, add a trusted publisher for `@codebend3r/gale`: repo `codebend3r/gale`, workflow `release.yml`. (Fallback: an `NPM_TOKEN` secret.) | You, in a browser |
| 2. Create a crates.io token and run `gh secret set CARGO_REGISTRY_TOKEN -R codebend3r/gale`. | You |
| 3. `gh workflow enable release.yml -R codebend3r/gale`, then dispatch a dry run from `main` and confirm that all six binaries build and the npm staging step passes. | Me |
| 4. With your go-ahead: bump gale to 0.2.6 through gale's release process and push the `v0.2.6` tag. The workflow publishes npm (six binaries), crates.io, and the GitHub release. This ships everything on gale's `main` since 0.2.5. | Me |
| 5. Run the suite against 0.2.6 locally and confirm it passes. | Me |

## 6. Docs

- **README**, under Development: a "Nightly gale compatibility" subsection
  covering what the suite checks, the three local commands, and the issue
  label.
- **CHANGELOG**, under Unreleased › Added: the plugins now find the project's
  gale binary on Windows on ARM. The suite and workflow are repository tooling
  and get no entry.

## 7. Verification

- **Part A:** `bun system-check` passes.
- **Part B:**
  - Against 0.2.5, every check passes except the binary-presence checks for
    the two Windows targets, which is expected until part D.
  - `GALE_BINARY` passes against the local build.
  - To prove the checks catch real breakage, temporarily misspell one name in
    `facts.configFileNames` and one `serverArgs` flag, confirm the matching
    checks fail, then revert.
- **Part C:** the first push run fails on the Windows binaries and opens the
  issue. After part D, a manual run passes and closes it, which tests the
  whole issue cycle against real failures. A dispatch with `gale-version`
  confirms that pinned runs leave issues alone.

## 8. Out of scope

- Tests that run the plugins in VS Code, WebStorm, or Zed.
- Spotting a config file name gale *adds*, because the npm package doesn't
  expose its list.
- gale exiting on the LSP `exit` notification. That's a separate gale fix.
- Config priority order. The plugins watch every name and don't depend on the
  order.
- macOS and Windows runners.

## 9. Build order

Each step is its own commit on `main`.

1. Part A.
2. Part B, plus the README section.
3. Part C. Pushing it (with your OK) starts the first run, which fails on the
   Windows binaries and opens the issue.
4. Part D. Steps 1 and 2 need you.
5. A manual workflow run passes and closes the issue.
