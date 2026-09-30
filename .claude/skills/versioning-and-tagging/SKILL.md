---
name: versioning-and-tagging
description: Use when a new gale-plugin version is being cut, the plugin version needs bumping, a vX.Y.Z git tag needs creating or pushing, or the request says "bump the version", "tag a release", "release X.Y.Z", or "prepare a release". Stops at the pushed tag; publishing is the publishing-release skill.
---

# Versioning and Tagging

## Overview

The three plugins (VS Code, Zed, WebStorm) share one version and one git tag,
`v<version>`, even when only one plugin changed. Releases happen on `main`
directly: no release branch, no PR. The tag goes on the pushed release commit
once CI has passed on it.

`set-version.sh` in this folder is the only supported way to change the
version. It rewrites every file that carries it and fails if any disagree.

## Where the version lives

| File                                | What changes                                     |
| ----------------------------------- | ------------------------------------------------ |
| `plugins/vscode/package.json`       | `"version"`                                      |
| `plugins/zed/extension.toml`        | the top-level `version`, not `[lib] version`     |
| `plugins/zed/Cargo.toml`            | `[package] version`, not `zed_extension_api`     |
| `plugins/webstorm/build.gradle.kts` | `version`                                        |
| `plugins/zed/Cargo.lock`            | synced by `cargo update --workspace --offline`   |
| `bun.lock`                          | synced by `bun install`; CI uses frozen lockfile |

Not versioned: the root `package.json`, `libs/contract`, and `tools/codegen`
stay at `0.0.0`. They're private workspace packages that never ship, and PR #1
set them that way on purpose. `[lib] version` in `extension.toml` and
`zed_extension_api` in `Cargo.toml` are the Zed extension API version.
`plugin.xml` has no version; Gradle patches it from `build.gradle.kts`.

## Preconditions

| Check                               | Command                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| The previous release is tagged      | `git fetch origin --tags && git tag -l` lists `v<previous>` (none before 1.0.0)            |
| Files agree on the previous version | `bash .claude/skills/versioning-and-tagging/set-version.sh` prints it                      |
| On `main`, clean, and up to date    | `git checkout main && git pull --ff-only && test -z "$(git status --porcelain)"`           |
| There is something to release       | `git log v<previous>..HEAD --oneline` is non-empty                                         |
| Hooks can build all three plugins   | `ls /Applications/WebStorm.app` and `rustup target list --installed \| grep wasm32-wasip2` |

The pre-commit hook runs ktlint through Gradle whenever `build.gradle.kts` is
staged, and the pre-push hook builds every plugin, so both toolchains must be
present before the commit.

If the previous version was bumped but never pushed and tagged, finish that
release first. Versions never skip.

## Procedure

1. Pick the version with semver: a breaking change to settings or behavior is
   major, a new feature or setting is minor, fixes only is patch. Plain `X.Y.Z`
   only; vsce rejects prerelease suffixes.
2. Run the script:
   ```sh
   bash .claude/skills/versioning-and-tagging/set-version.sh X.Y.Z
   ```
   It prints every file's version. With no argument it prints the current
   version, or exits 1 listing the files that disagree.
3. In `CHANGELOG.md`, make `## [Unreleased]` complete first: every
   user-visible commit in `git log v<previous>..HEAD --oneline` gets a line
   under a Keep a Changelog heading (`### Added`, `### Changed`, `### Fixed`,
   `### Removed`). Then rename it to `## [X.Y.Z] - YYYY-MM-DD` with today's
   date, add an empty `## [Unreleased]` above it, and update the link
   definitions at the bottom: `[Unreleased]` compares `vX.Y.Z...HEAD`, and
   `[X.Y.Z]` links to `releases/tag/vX.Y.Z`.
4. Run `bun run sync:check && bun run format:check`, then `git diff --stat`.
   Expect exactly the six files above plus `CHANGELOG.md`.
5. Commit on `main` and push:
   ```sh
   git add -A && git commit -m "Release X.Y.Z"
   git push origin main
   ```
   The pre-push hook runs `bun system-check`, which builds all three plugins
   with the new version.
6. Wait for CI on that exact commit, then tag it. The run can take a few
   seconds to register after the push, hence the loop:
   ```sh
   sha=$(git rev-parse HEAD)
   until run=$(gh run list --workflow ci.yml --commit "$sha" --json databaseId --jq '.[0].databaseId') && [ -n "$run" ]; do sleep 10; done
   gh run watch "$run" --exit-status
   test "$(bash .claude/skills/versioning-and-tagging/set-version.sh)" = X.Y.Z
   git tag -a vX.Y.Z -m "vX.Y.Z" "$sha"
   git push origin vX.Y.Z
   ```
7. Publish with the `publishing-release` skill.

## Common mistakes

| Mistake                                              | Why it's wrong                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Editing the files by hand or with line-numbered sed  | Misses a lockfile or hits `[lib] version`. Use the script.             |
| Setting `[lib] version` in `extension.toml` to X.Y.Z | That's the `zed_extension_api` version; Zed won't load the extension.  |
| Cutting a release branch or opening a PR             | Releases go straight to `main`; the pre-push hook and CI are the gate. |
| Checking the latest CI run instead of the commit     | Another push may have landed; `gh run list --commit` pins it.          |
| Bumping the root `package.json` too                  | Private and never shipped; it stays at `0.0.0`.                        |
| Leaving `[Unreleased]` empty, writing notes later    | `publishing-release` copies its notes from the changelog section.      |
| Hardcoding the version in `README.md`                | The README says `<version>` so a bump never touches it.                |
| Tagging before CI passes on the pushed commit        | `publishing-release` builds from the tag's checkout; CI is its proof.  |
