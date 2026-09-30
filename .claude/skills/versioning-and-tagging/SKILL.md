---
name: versioning-and-tagging
description: Use when a new gale-plugin version is being cut, the plugin version needs bumping, a vX.Y.Z git tag needs creating or pushing, or the request says "bump the version", "tag a release", "release X.Y.Z", or "prepare a release". Stops at the pushed tag; publishing is the publishing-release skill.
---

# Versioning and Tagging

## Overview

The three plugins (VS Code, Zed, WebStorm) share one version and one git tag,
`v<version>`, even when only one plugin changed. The tag goes on `main` after
the release PR merges, never on the branch.

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

| Check                               | Command                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| The previous release is tagged      | `git fetch origin --tags && git tag -l` lists `v<previous>` (none before 1.0.0)  |
| Files agree on the previous version | `bash .claude/skills/versioning-and-tagging/set-version.sh` prints it            |
| Clean branch cut from `origin/main` | `git switch -c release-X-Y-Z origin/main && test -z "$(git status --porcelain)"` |
| There is something to release       | `git log v<previous>..HEAD --oneline` is non-empty, and so is `## [Unreleased]`  |

If the previous version was bumped but never merged and tagged, finish that
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
3. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`
   with today's date (update it before merging if the merge slips to a later
   day), add an empty `## [Unreleased]` above it, and update the link
   definitions at the bottom: `[Unreleased]` compares `vX.Y.Z...HEAD`, and
   `[X.Y.Z]` links to `releases/tag/vX.Y.Z`. Every user-visible change since
   the previous tag must be listed; `git log v<previous>..HEAD --oneline` is
   the checklist.
4. Run `bun run sync:check && bun run format:check`, then `git diff --stat`.
   Expect exactly the six files above plus `CHANGELOG.md`.
5. Commit as `Release X.Y.Z`, push with `git push -u origin HEAD`, and open
   the PR with `gh pr create`. The pre-push hook runs `bun system-check`,
   which builds all three plugins with the new version.
6. After the PR merges, tag the commit `main` now carries, once CI has passed
   on that exact commit:
   ```sh
   git checkout main && git pull --ff-only
   test "$(bash .claude/skills/versioning-and-tagging/set-version.sh)" = X.Y.Z
   test "$(gh run list --workflow ci.yml --commit "$(git rev-parse HEAD)" --json conclusion --jq '.[0].conclusion')" = success
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```
7. Publish with the `publishing-release` skill.

## Common mistakes

| Mistake                                              | Why it's wrong                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Editing the files by hand or with line-numbered sed  | Misses a lockfile or hits `[lib] version`. Use the script.                        |
| Setting `[lib] version` in `extension.toml` to X.Y.Z | That's the `zed_extension_api` version; Zed won't load the extension.             |
| Tagging on the release branch                        | Merging creates a new commit (merge, squash, or rebase); tag what `main` carries. |
| Checking the latest CI run instead of the commit     | Another push may have landed; `gh run list --commit` pins it.                     |
| Bumping the root `package.json` too                  | Private and never shipped; it stays at `0.0.0`.                                   |
| Leaving `[Unreleased]` empty, writing notes later    | `publishing-release` copies its notes from the changelog section.                 |
| Hardcoding the version in `README.md`                | The README says `<version>` so a bump never touches it.                           |
| Tagging before CI passes on the merged commit        | The release builds from the tag; a red tag ships a broken build.                  |
