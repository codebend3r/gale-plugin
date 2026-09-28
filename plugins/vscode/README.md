# Gale CSS Linter for VS Code

Shows [Gale](https://github.com/codebend3r/gale) diagnostics and quick fixes for
CSS, SCSS, Less, and Sass files.

## Finding the gale binary

The extension runs the first of these that exists:

1. The `gale.path` setting (an absolute path).
2. The project's `@codebend3r/gale` package: `bun add -d @codebend3r/gale`.
3. `gale` on your `PATH`: `cargo install gale-lint`.

## Settings

| Setting           | Default | Description                                                                            |
| ----------------- | ------- | -------------------------------------------------------------------------------------- |
| `gale.enable`     | `true`  | Enable the Gale linter.                                                                |
| `gale.configPath` | `""`    | Path to a Gale config file. Relative paths resolve from the workspace root.            |
| `gale.path`       | `""`    | Absolute path to the gale binary. Leave empty to use the project package, then `PATH`. |

The server restarts on its own when a setting changes or when a config file in
the workspace root (or a parent folder) changes. Run **Gale: Restart Language
Server** to restart it by hand, for example after editing a file pulled in with
`extends`.
