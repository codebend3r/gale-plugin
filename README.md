# Gale editor plugins

Editor clients for [Gale](https://github.com/codebend3r/gale), an extremely fast
CSS linter written in Rust. Each plugin runs `gale --lsp` and shows its
diagnostics and quick fixes for CSS, SCSS, Less, and Sass.

| Plugin   | Path               | Language              | Output                    |
| -------- | ------------------ | --------------------- | ------------------------- |
| VS Code  | `plugins/vscode`   | TypeScript            | `dist/gale-lint.vsix`     |
| Zed      | `plugins/zed`      | Rust (WASM)           | `extension.wasm`          |
| WebStorm | `plugins/webstorm` | Kotlin (IntelliJ LSP) | `gale-webstorm-0.7.0.zip` |

The plugins aren't published to any marketplace. Build and install them locally.

## Finding the gale binary

Every plugin runs the first of these that exists:

1. The binary path setting, if you set one.
2. The project's `@codebend3r/gale` package: `bun add -d @codebend3r/gale`.
3. `gale` on your `PATH`: `cargo install gale-lint`.

If none exists, the plugin says so and names its setting. The server always
starts in the project root, so a relative config path resolves from there.

## Installing

### VS Code

```sh
bunx nx run vscode:install
```

This builds `plugins/vscode/dist/gale-lint.vsix` and installs it with
`code --install-extension`. Settings: `gale.enable`, `gale.configPath`, and
`gale.path`. The server restarts on its own when a setting or a config file
changes.

### Zed

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
| Formatting (Prettier)                     | `bun run format:check` | `bun run format`   |
| Lint (ESLint, rustfmt and clippy, ktlint) | `bun run lint`         | `bun run lint:fix` |
| Typecheck                                 | `bun run typecheck`    |                    |
| Test                                      | `bun run test`         |                    |
| Build                                     | `bun run build`        |                    |

Use `bun run test` and `bun run build`, not `bun test` or `bun build`, which
start Bun's own test runner and bundler.

### Git hooks

`bun install` installs two [Lefthook](https://lefthook.dev) hooks:

- **pre-commit** runs [lint-staged](https://github.com/lint-staged/lint-staged)
  to fix staged files: ESLint and Prettier for TypeScript and JavaScript,
  Prettier for everything else, `cargo fmt` for Rust, and ktlint for Kotlin. A
  lint error it can't fix stops the commit.
- **pre-push** runs `bun system-check`. Lefthook skips it when the branch has
  nothing new to push.

To skip a hook once, pass `--no-verify`.

## License

MIT
