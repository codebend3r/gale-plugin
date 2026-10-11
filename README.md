# Gale editor plugins

Editor clients for [Gale](https://github.com/codebend3r/gale), an extremely fast
CSS linter written in Rust. Each plugin runs `gale --lsp` and shows its
diagnostics and quick fixes for CSS, SCSS, Less, and Sass.

| Plugin   | Path               | Language              | Output                        |
| -------- | ------------------ | --------------------- | ----------------------------- |
| VS Code  | `plugins/vscode`   | TypeScript            | `dist/gale-lint.vsix`         |
| Zed      | `plugins/zed`      | Rust (WASM)           | `extension.wasm`              |
| WebStorm | `plugins/webstorm` | Kotlin (IntelliJ LSP) | `gale-webstorm-<version>.zip` |

The plugins aren't on any marketplace. Each
[GitHub release](https://github.com/codebend3r/gale-plugin/releases) attaches
the VS Code `.vsix` and the WebStorm `.zip`. Zed compiles its extension from
source, so its users install from the release's source archive or a clone.
The three plugins share one version and one `v<version>` tag; see
[CHANGELOG.md](CHANGELOG.md) for what each release changed.

## Finding the gale binary

Every plugin runs the first of these that exists:

1. The binary path setting, if you set one.
2. The project's `@codebend3r/gale` package: `bun add -d @codebend3r/gale`.
3. `gale` on your `PATH`: `cargo install gale-lint`.

If none exists, the plugin says so and names its setting. The server always
starts in the project root, so a relative config path resolves from there.

## Installing

### VS Code

From a release, download `gale-lint-<version>.vsix` and install it:

```sh
code --install-extension gale-lint-<version>.vsix
```

From source:

```sh
bunx nx run vscode:install
```

This builds `plugins/vscode/dist/gale-lint.vsix` and installs it with
`code --install-extension`. Settings: `gale.enable`, `gale.configPath`, and
`gale.path`. The server restarts on its own when a setting or a config file
changes.

### Zed

Zed builds Rust extensions from source, so download the release's source
archive (or clone the repo at its tag) and install the Rust toolchain with the
`wasm32-wasip2` target (see [One-time setup](#one-time-setup)).

Run **zed: install dev extension** and pick the `plugins/zed` folder. Install
Zed's `scss` and `less` extensions for SCSS, Sass, and Less; CSS is built in.

Configure Gale in Zed's `settings.json`:

```json
{
  "lsp": {
    "gale": {
      "binary": { "path": "/absolute/path/to/gale" },
      "settings": { "configPath": "config/gale.json" }
    }
  }
}
```

To turn Gale off, add `"!gale"` to a language's `language_servers`. Zed can't
watch config files, so run **editor: restart language server** after you edit
one. The extension checks for the project's gale binary with `test -f`, so it
declares the `process:exec` capability.

### WebStorm

From a release, download `gale-webstorm-<version>.zip`, open
**Settings › Plugins**, click the gear icon, choose **Install Plugin from
Disk…**, and pick the zip. WebStorm warns that the plugin isn't signed; that's
expected. Restart WebStorm afterwards.

From source:

```sh
bunx nx run webstorm:install
```

This unzips the plugin into
`~/Library/Application Support/JetBrains/WebStorm2026.2/plugins/`. Restart
WebStorm afterwards. To install elsewhere, pass a folder:
`./gradlew installPlugin -PpluginsDir=/path/to/plugins` from `plugins/webstorm`.
To try the plugin in a sandboxed IDE instead, run `bunx nx run webstorm:run-ide`.

Settings live in **Settings › Tools › Gale**. The server restarts when you apply
them or when a config file changes. WebStorm's built-in Stylelint integration
can show duplicate diagnostics, so turn it off in projects that use Gale.

## Development

The repo is an [Nx](https://nx.dev) workspace managed with Bun.

- `libs/contract` holds the facts every plugin shares (config file names,
  platform targets, settings, messages), the shared test cases, and the
  TypeScript implementation.
- `tools/codegen` is an Nx sync generator. It writes the facts and test cases
  into Rust and Kotlin files, plus the generated parts of the VS Code manifest
  and Zed's `extension.toml`. Run `bunx nx sync` after changing the contract.
- `tools/gale-compat` checks that a real gale still fits the contract (see
  [Nightly gale compatibility](#nightly-gale-compatibility)).

### One-time setup

```sh
bun install
rustup target add wasm32-wasip2
rustup component add llvm-tools-preview clippy rustfmt
cargo install cargo-llvm-cov
```

Gradle provisions JDK 25 for the WebStorm build. The WebStorm build uses the
installed `/Applications/WebStorm.app`; pass `-PidePath=...` to use another, or
`-PideVersion=2026.2.3` to download one.

### Checks

```sh
bun system-check
```

This runs every step below in order. Every test target enforces a 100% coverage
gate. CI runs the same steps one at a time.

| Step                                      | Command                | Fix command        |
| ----------------------------------------- | ---------------------- | ------------------ |
| Generated files current                   | `bun run sync:check`   | `bun run sync`     |
| Formatting (oxfmt)                        | `bun run format:check` | `bun run format`   |
| Lint (oxlint, rustfmt and clippy, ktlint) | `bun run lint`         | `bun run lint:fix` |
| Typecheck                                 | `bun run typecheck`    |                    |
| Test                                      | `bun run test`         |                    |
| Build                                     | `bun run build`        |                    |

Use `bun run test` and `bun run build`, not `bun test` or `bun build`, which
start Bun's own test runner and bundler.

### Git hooks

`bun install` installs two [Lefthook](https://lefthook.dev) hooks:

- **pre-commit** runs [lint-staged](https://github.com/lint-staged/lint-staged)
  to fix staged files: oxlint and oxfmt for TypeScript and JavaScript, oxfmt
  for everything else it knows, `cargo fmt` for Rust, and ktlint for Kotlin. A
  lint error it can't fix stops the commit.
- **pre-push** runs `bun system-check`. Lefthook skips it when the branch has
  nothing new to push.

To skip a hook once, pass `--no-verify`.

### Nightly gale compatibility

The plugin tests use mocks, so a new gale release could break the plugins
without any of them failing. Every night at 07:00 UTC,
[`gale-compat.yml`](.github/workflows/gale-compat.yml) installs the newest
`@codebend3r/gale` from npm and runs `tools/gale-compat` against it. The suite
drives gale through the contract every plugin shares, so a gale that passes
fits all three plugins. It checks:

- the binary sits where `projectBinaryPath` looks for it
- gale's npm package supports the same platforms as `facts.platforms`, and
  ships a binary for each
- the server starts with `serverArgs`, including a relative `--config`
- an LSP session reports diagnostics for CSS, SCSS, Less, and Sass, offers a
  quick fix, and shuts down cleanly
- gale reads every name in `facts.configFileNames` and the `"stylelint"` field
  in `package.json`

A failing run opens an issue labeled `gale-compat`, or comments on the one
already open. The next passing run closes it. The workflow also runs when the
suite or the contract changes on `main`, and by hand from the Actions tab,
where a `gale-version` input tests a pinned release without touching the
issue.

The suite is not part of `bun system-check`, so a gale release never fails CI
or the pre-push hook. To run it locally:

```sh
bunx nx run gale-compat:compat                       # newest gale on npm
GALE_VERSION=0.2.5 bunx nx run gale-compat:compat    # one release
GALE_BINARY=/path/to/gale bunx nx run gale-compat:compat   # a local build
```

`GALE_BINARY` skips the two npm package checks. After a run,
`node tools/gale-compat/src/report.ts` prints the results as Markdown.

### Releasing

The three plugins share one version and one `v<version>` git tag, and every
release is a [GitHub release](https://github.com/codebend3r/gale-plugin/releases)
with the VS Code and WebStorm builds attached. Two skills under
`.claude/skills` hold the procedures:

- `versioning-and-tagging` picks the version, runs `set-version.sh` to write
  it everywhere it lives, records the changes in [CHANGELOG.md](CHANGELOG.md),
  commits on `main`, and tags the commit once CI passes.
- `publishing-release` builds the plugins at the tag and publishes the GitHub
  release with the changelog section as its notes.

## License

MIT
