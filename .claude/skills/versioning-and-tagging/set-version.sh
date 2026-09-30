#!/usr/bin/env bash
# Prints or sets the release version shared by the three plugins.
#
#   bash .claude/skills/versioning-and-tagging/set-version.sh          # print
#   bash .claude/skills/versioning-and-tagging/set-version.sh 1.2.0    # set
#
# With no argument it prints the version and exits 1 if the files disagree.
# With a version it rewrites every file below, syncs Cargo.lock, and checks
# that they all read back the same.
#
# Only the plugin manifests carry the version. The root package.json,
# libs/contract, and tools/codegen stay at 0.0.0: they're private workspace
# packages that never ship.
set -euo pipefail

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"

# Each entry is "<file>|<regex>". The regex's first capture group is the
# version, and only the first match in the file is read or replaced:
#   - plugins/zed/extension.toml has two `version =` lines. The first is the
#     extension's version. The second, under [lib], is the zed_extension_api
#     version and must not change.
#   - plugins/zed/Cargo.toml's `zed_extension_api = "..."` line is a dependency
#     version and doesn't match `^version =`.
files=(
  'plugins/vscode/package.json|^  "version": "([^"]+)"'
  'plugins/zed/extension.toml|^version = "([^"]+)"'
  'plugins/zed/Cargo.toml|^version = "([^"]+)"'
  'plugins/webstorm/build.gradle.kts|^version = "([^"]+)"'
)

read_version() {
  local file=$1 regex=$2
  perl -ne "if (/$regex/) { print \$1; exit }" "$file"
}

cargo_lock_version() {
  perl -0ne 'print $1 if /name = "gale-zed"\nversion = "([^"]+)"/' \
    plugins/zed/Cargo.lock
}

# bun.lock records each workspace package's version, and CI installs with
# --frozen-lockfile, so a stale entry fails CI.
bun_lock_version() {
  perl -0ne 'print $1 if /"plugins\/vscode": \{\n\s+"name": "gale-lint",\n\s+"version": "([^"]+)"/' \
    bun.lock
}

report() {
  local entry file regex
  for entry in "${files[@]}"; do
    file=${entry%%|*}
    regex=${entry#*|}
    printf '%-36s %s\n' "$file" "$(read_version "$file" "$regex")"
  done
  printf '%-36s %s\n' "plugins/zed/Cargo.lock" "$(cargo_lock_version)"
  printf '%-36s %s\n' "bun.lock" "$(bun_lock_version)"
}

check() {
  local expected=$1
  if [ "$(report | awk '{print $2}' | sort -u)" != "$expected" ]; then
    echo "Versions disagree:" >&2
    report >&2
    return 1
  fi
}

if [ $# -eq 0 ]; then
  version=$(read_version "${files[0]%%|*}" "${files[0]#*|}")
  check "$version"
  echo "$version"
  exit 0
fi

version=$1
if ! [[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must be X.Y.Z with no suffix (vsce rejects prerelease tags): $version" >&2
  exit 1
fi

for entry in "${files[@]}"; do
  file=${entry%%|*}
  regex=${entry#*|}
  # Everything before the capture group is the prefix to keep. /m anchors ^
  # to each line; with no /g, only the first match changes.
  prefix=${regex%%(*}
  perl -0pi -e "s/(${prefix})[^\"]+\"/\${1}${version}\"/m" "$file"
done

# Rewrites gale-zed's entry in Cargo.lock without touching dependencies.
# --offline needs a warm registry cache; fall back to the network without it.
cargo update --workspace --offline --manifest-path plugins/zed/Cargo.toml \
  --quiet ||
  cargo update --workspace --manifest-path plugins/zed/Cargo.toml --quiet

# Rewrites the plugins/vscode entry in bun.lock.
bun install --silent

check "$version"
report
