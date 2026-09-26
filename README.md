# Gale CSS Linter — VS Code Extension

VS Code client for [Gale](https://github.com/codebend3r/gale), an extremely fast CSS linter written in Rust that is a drop-in replacement for Stylelint. The extension starts `gale --lsp` and shows its diagnostics for CSS, SCSS, Less and Sass files.

## Features

- Real-time linting diagnostics as you type
- Supports CSS, SCSS, Less and Sass
- Auto-discovers Gale configuration files (`gale.json`, `gale.toml`, `.stylelintrc`, etc.)
- Minimal footprint — the linter runs as a native binary

## Requirements

Install Gale in your project:

```sh
bun add -d @codebend3r/gale
```

Or install `gale` globally (`cargo install gale-lint`) so it is available on your `PATH`.

## Configuration

| Setting           | Type      | Default | Description                                                                 |
| ----------------- | --------- | ------- | --------------------------------------------------------------------------- |
| `gale.enable`     | `boolean` | `true`  | Enable or disable the linter.                                               |
| `gale.configPath` | `string`  | `""`    | Explicit path to a config file (auto-discovered if empty).                  |
| `gale.path`       | `string`  | `""`    | Absolute path to the `gale` binary (`node_modules/.bin`, then `PATH`, if empty). |

## Commands

- **Gale: Restart Language Server** — restart the Gale LSP server (`gale.restart`).

## Building

The extension is not published to the Marketplace. Build a `.vsix` locally:

```sh
bun install
bun run compile   # tsc -p ./
bun run package   # vsce package
```

Then install it in VS Code with **Extensions: Install from VSIX…**.

## License

MIT
