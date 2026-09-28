/**
 * The facts every Gale editor plugin shares. VS Code imports these directly;
 * `@gale-plugin/codegen` writes them into the Zed and WebStorm sources.
 *
 * Every field has a consumer. Nothing is kept for symmetry.
 */
export const facts = {
  server: { command: "gale", lspArg: "--lsp", configArg: "--config" },
  languages: [
    { id: "css", extensions: [".css"], zedName: "CSS" },
    { id: "scss", extensions: [".scss"], zedName: "SCSS" },
    { id: "less", extensions: [".less"], zedName: "LESS" },
    { id: "sass", extensions: [".sass"], zedName: "SASS" },
  ],
  /** Gale's config file names, in its priority order (`gale_config::CONFIG_FILENAMES`). */
  configFileNames: [
    "gale.json",
    "gale.toml",
    ".stylelintrc",
    ".stylelintrc.json",
    ".stylelintrc.yml",
    ".stylelintrc.yaml",
    "stylelint.config.js",
    "stylelint.config.mjs",
    "stylelint.config.cjs",
    ".stylelintrc.js",
    ".stylelintrc.cjs",
    ".stylelintrc.mjs",
  ],
  /** Lowest priority config source: a `package.json` with a `"stylelint"` field. */
  packageJsonFileName: "package.json",
  npmPackage: { name: "@codebend3r/gale", binDir: "bin" },
  platforms: [
    { os: "darwin", arch: "arm64", target: "aarch64-apple-darwin" },
    { os: "darwin", arch: "x64", target: "x86_64-apple-darwin" },
    { os: "linux", arch: "arm64", target: "aarch64-unknown-linux-gnu" },
    { os: "linux", arch: "x64", target: "x86_64-unknown-linux-gnu" },
    { os: "win32", arch: "x64", target: "x86_64-pc-windows-msvc" },
  ],
  settings: {
    enable: {
      type: "boolean",
      default: true,
      description: "Enable the Gale linter.",
    },
    configPath: {
      type: "string",
      default: "",
      description:
        "Path to a Gale config file. Relative paths resolve from the workspace root. Leave empty to let Gale find one.",
    },
    binaryPath: {
      type: "string",
      default: "",
      description:
        "Absolute path to the gale binary. Leave empty to use the project's @codebend3r/gale package, then PATH.",
    },
  },
  vscode: {
    settingKeys: {
      enable: "gale.enable",
      configPath: "gale.configPath",
      binaryPath: "gale.path",
    },
    restartCommand: {
      id: "gale.restart",
      title: "Gale: Restart Language Server",
    },
  },
  missingBinary: {
    template:
      "Gale couldn't find the gale binary. Install it in this project with " +
      "`bun add -d @codebend3r/gale`, install it globally with `cargo install gale-lint`, " +
      "or set {setting}.",
    settingHint: {
      vscode: "`gale.path` in Settings",
      zed: "`lsp.gale.binary.path` in settings.json",
      webstorm: "Settings › Tools › Gale › Binary path",
    },
  },
} as const;
