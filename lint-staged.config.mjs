// Fixes staged files before each commit. Lefthook runs this from the pre-commit hook.
// oxlint and oxfmt error when a task hands them only ignored files (oxfmt also
// when it gets only file types it doesn't know), unless unmatched patterns are
// allowed.
const oxlint = "oxlint --fix --no-error-on-unmatched-pattern";
const oxfmt = "oxfmt --no-error-on-unmatched-pattern";

export default {
  "*.{ts,mts,cts,js,mjs,cjs}": [oxlint, oxfmt],
  "!(*.{ts,mts,cts,js,mjs,cjs})": oxfmt,
  // rustfmt and ktlint format the whole project, so they take no file names.
  "plugins/zed/**/*.rs": () =>
    "cargo fmt --manifest-path plugins/zed/Cargo.toml",
  "plugins/webstorm/**/*.{kt,kts}": () =>
    "plugins/webstorm/gradlew -p plugins/webstorm ktlintFormat --console=plain",
};
