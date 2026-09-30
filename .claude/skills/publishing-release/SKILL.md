---
name: publishing-release
description: Use when a vX.Y.Z tag exists on gale-plugin's main and the release must be built and published, or the request says "publish the release", "create the GitHub release", "upload the vsix and zip", or "ship vX.Y.Z". Needs the version bumped and tagged first (the versioning-and-tagging skill).
---

# Publishing a Release

## Overview

A release is a GitHub release on the `vX.Y.Z` tag with the VS Code `.vsix`,
the WebStorm `.zip`, and a checksum file attached, and notes copied from the
version's section of `CHANGELOG.md`. Nothing goes to a marketplace.

Zed gets no asset. Zed compiles Rust extensions from source, so its users
install the dev extension from the release's source archive, which GitHub
attaches on its own.

## Preconditions

Every check must pass before the build starts.

| Check                            | Command                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Tag is on the remote and on main | `git fetch origin --tags && git merge-base --is-ancestor vX.Y.Z origin/main`                                                               |
| Checked out at the tag, clean    | `git checkout vX.Y.Z && test -z "$(git status --porcelain)"`                                                                               |
| Manifests agree with the tag     | `test "$(bash .claude/skills/versioning-and-tagging/set-version.sh)" = X.Y.Z`                                                              |
| CI passed on the tagged commit   | `test "$(gh run list --workflow ci.yml --commit "$(git rev-parse 'vX.Y.Z^{commit}')" --json conclusion --jq '.[0].conclusion')" = success` |
| Changelog has the section        | `grep -n '^## \[X.Y.Z\]' CHANGELOG.md`                                                                                                     |
| No release exists yet            | `gh release view vX.Y.Z` fails                                                                                                             |
| WebStorm build has an IDE        | `ls /Applications/WebStorm.app` (Gradle provisions the JDK itself)                                                                         |

The tag is annotated, so `git rev-parse vX.Y.Z` alone returns the tag object,
not the commit, and the CI lookup matches nothing. `^{commit}` peels it.

## Procedure

```sh
V=X.Y.Z
bun install --frozen-lockfile
# Only the two plugins that ship. --skip-nx-cache rebuilds instead of
# restoring Nx's cached outputs; CI already built Zed's wasm on this commit.
bunx nx run-many -t build -p vscode webstorm --skip-nx-cache

# The built artifacts must carry the version. build/distributions keeps zips
# from older builds, so always test and copy by the exact versioned name.
unzip -p plugins/vscode/dist/gale-lint.vsix extension/package.json \
  | grep "\"version\": \"$V\""
test -f "plugins/webstorm/build/distributions/gale-webstorm-$V.zip"

# Stage the assets under versioned names. The vsix's build name is fixed.
stage=$(mktemp -d)
cp plugins/vscode/dist/gale-lint.vsix "$stage/gale-lint-$V.vsix"
cp "plugins/webstorm/build/distributions/gale-webstorm-$V.zip" "$stage/"
(cd "$stage" && shasum -a 256 ./*.vsix ./*.zip > SHA256SUMS.txt)

# Release notes: the changelog section for this version, without its heading.
awk -v v="$V" '
  /^## \[/ { p = index($0, "## [" v "]") == 1; next }
  /^\[.*\]: / { p = 0 }
  p' CHANGELOG.md > "$stage/notes.md"
test -s "$stage/notes.md"

gh release create "v$V" --verify-tag --draft --title "v$V" \
  --notes-file "$stage/notes.md" \
  "$stage/gale-lint-$V.vsix" "$stage/gale-webstorm-$V.zip" \
  "$stage/SHA256SUMS.txt"
test "$(gh release view "v$V" --json assets --jq '.assets | length')" = 3
gh release view "v$V" --json assets --jq '.assets[].name'
gh release edit "v$V" --draft=false
gh release view "v$V" --json url,isDraft --jq '.url'
```

If the draft's asset list is wrong, `gh release delete "v$V" --yes` removes
the draft (the tag stays); fix the cause and rerun from the build step.

Report the release URL and the three asset names. Then `git checkout main`.

## Common mistakes

| Mistake                                         | Why it's wrong                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| Building on a branch, or on `main` past the tag | The assets must come from the tagged commit. Check out the tag first.  |
| `--generate-notes` or hand-written notes        | The changelog section was reviewed in the release PR; it is the notes. |
| Attaching `gale_zed.wasm`                       | Zed can't install a prebuilt wasm, so the asset only misleads.         |
| Trusting Nx's build cache                       | `--skip-nx-cache` rebuilds instead of restoring cached `dist` output.  |
| Peeling the tag with plain `git rev-parse`      | Annotated tags resolve to the tag object; use `'vX.Y.Z^{commit}'`.     |
| Publishing without the draft step               | Create as draft, confirm the asset list, then flip `--draft=false`.    |
| Publishing to a marketplace                     | Out of scope. It needs publisher accounts nobody has set up.           |
