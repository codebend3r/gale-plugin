// Fixes staged files before each commit. Lefthook runs this from the pre-commit hook.
export default {
  "*.{ts,mts,cts,js,mjs,cjs}": [
    "eslint --fix --no-warn-ignored",
    "prettier --write",
  ],
  // Everything else Prettier knows. It errors on symlinks such as
  // plugins/vscode/LICENSE unless unmatched patterns are allowed.
  "!(*.{ts,mts,cts,js,mjs,cjs})":
    "prettier --write --ignore-unknown --no-error-on-unmatched-pattern",
  // rustfmt and ktlint format the whole project, so they take no file names.
  "plugins/zed/**/*.rs": () =>
    "cargo fmt --manifest-path plugins/zed/Cargo.toml",
  "plugins/webstorm/**/*.{kt,kts}": () =>
    "plugins/webstorm/gradlew -p plugins/webstorm ktlintFormat --console=plain",
};
