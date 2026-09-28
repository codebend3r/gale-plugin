// Fixes staged files before each commit. Lefthook runs this from the pre-commit hook.
// oxfmt skips file types it doesn't know, but errors when a task hands it only
// those or only ignored files, unless unmatched patterns are allowed.
const oxfmt = "oxfmt --no-error-on-unmatched-pattern";

export default {
  "*.{ts,mts,cts,js,mjs,cjs}": ["eslint --fix --no-warn-ignored", oxfmt],
  "!(*.{ts,mts,cts,js,mjs,cjs})": oxfmt,
  // rustfmt and ktlint format the whole project, so they take no file names.
  "plugins/zed/**/*.rs": () =>
    "cargo fmt --manifest-path plugins/zed/Cargo.toml",
  "plugins/webstorm/**/*.{kt,kts}": () =>
    "plugins/webstorm/gradlew -p plugins/webstorm ktlintFormat --console=plain",
};
