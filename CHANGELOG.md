# Changelog

All notable changes to the Gale editor plugins are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the three
plugins share one [semantic version](https://semver.org) and one git tag.

## [Unreleased]

## [1.0.1] - 2026-09-30

No user-visible changes. Only the repository's release tooling changed since
1.0.0.

## [1.0.0] - 2026-09-30

The first public release. Three plugins run `gale --lsp` and show its
diagnostics and quick fixes for CSS, SCSS, Less, and Sass.

### Added

- VS Code extension with the `gale.enable`, `gale.configPath`, and `gale.path`
  settings and a **Gale: Restart Language Server** command. The `.vsix` is
  bundled with esbuild, so it ships no `node_modules`.
- Zed extension, installed as a dev extension from `plugins/zed` and
  configured through Zed's `lsp.gale` settings.
- WebStorm plugin with a **Settings › Tools › Gale** page, a **Restart Gale**
  action, and a one-time notification when no binary is found.
- Every plugin finds the binary the same way: the binary path setting, then
  the project's `@codebend3r/gale` package, then `gale` on `PATH`. When none
  exists, the plugin says so and names its setting.
- The server starts in the project root, so relative config paths resolve from
  there. VS Code and WebStorm restart it when a setting or a config file in
  the root or a parent folder changes.
- A shared contract (`libs/contract`) holds the facts and test cases every
  plugin implements, and an Nx sync generator writes them into the Rust and
  Kotlin sources, so the three plugins are held to the same behavior.

[Unreleased]: https://github.com/codebend3r/gale-plugin/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/codebend3r/gale-plugin/releases/tag/v1.0.1
[1.0.0]: https://github.com/codebend3r/gale-plugin/releases/tag/v1.0.0
