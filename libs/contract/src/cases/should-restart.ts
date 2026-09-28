import { facts } from "../facts.ts";
import type { PathSettings } from "../types.ts";
import type { Case } from "./case.ts";

export interface ShouldRestartInput {
  readonly changedPath: string;
  readonly root: string;
  readonly settings: PathSettings;
}

const noSettings = { configPath: "", binaryPath: "" };

const configFileAtRootCases = facts.configFileNames.map((name) => ({
  name: `${name} at the root`,
  input: {
    changedPath: `/work/app/${name}`,
    root: "/work/app",
    settings: noSettings,
  },
  expected: true,
}));

export const shouldRestartCases = [
  ...configFileAtRootCases,
  {
    name: "package.json at the root",
    input: {
      changedPath: "/work/app/package.json",
      root: "/work/app",
      settings: noSettings,
    },
    expected: true,
  },
  {
    name: "config file in a parent folder",
    input: {
      changedPath: "/work/gale.json",
      root: "/work/app",
      settings: noSettings,
    },
    expected: true,
  },
  {
    name: "package.json in a parent folder",
    input: {
      changedPath: "/work/package.json",
      root: "/work/app",
      settings: noSettings,
    },
    expected: true,
  },
  {
    name: "config file at the filesystem root",
    input: {
      changedPath: "/.stylelintrc",
      root: "/work/app",
      settings: noSettings,
    },
    expected: true,
  },
  {
    name: "config file in a subfolder",
    input: {
      changedPath: "/work/app/src/gale.json",
      root: "/work/app",
      settings: noSettings,
    },
    expected: false,
  },
  {
    name: "config file in a sibling folder",
    input: {
      changedPath: "/work/other/gale.json",
      root: "/work/app",
      settings: noSettings,
    },
    expected: false,
  },
  {
    name: "config file in a sibling folder sharing a name prefix",
    input: {
      changedPath: "/work/app-old/gale.json",
      root: "/work/app",
      settings: noSettings,
    },
    expected: false,
  },
  {
    name: "unrelated file at the root",
    input: {
      changedPath: "/work/app/styles.css",
      root: "/work/app",
      settings: noSettings,
    },
    expected: false,
  },
  {
    name: "backup of a config file",
    input: {
      changedPath: "/work/app/gale.json.bak",
      root: "/work/app",
      settings: noSettings,
    },
    expected: false,
  },
  {
    name: "package.json inside node_modules",
    input: {
      changedPath: "/work/app/node_modules/some-pkg/package.json",
      root: "/work/app",
      settings: noSettings,
    },
    expected: false,
  },
  {
    name: "config path setting inside node_modules",
    input: {
      changedPath: "/work/app/node_modules/shared-config/gale.json",
      root: "/work/app",
      settings: {
        configPath: "node_modules/shared-config/gale.json",
        binaryPath: "",
      },
    },
    expected: false,
  },
  {
    name: "relative config path setting",
    input: {
      changedPath: "/work/app/config/lint.json",
      root: "/work/app",
      settings: { configPath: "config/lint.json", binaryPath: "" },
    },
    expected: true,
  },
  {
    name: "config path setting that leaves the root",
    input: {
      changedPath: "/work/shared/gale.toml",
      root: "/work/app",
      settings: { configPath: "../shared/gale.toml", binaryPath: "" },
    },
    expected: true,
  },
  {
    name: "absolute config path setting",
    input: {
      changedPath: "/etc/gale/custom.json",
      root: "/work/app",
      settings: { configPath: "/etc/gale/custom.json", binaryPath: "" },
    },
    expected: true,
  },
  {
    name: "other file next to the config path setting",
    input: {
      changedPath: "/work/app/config/other.json",
      root: "/work/app",
      settings: { configPath: "config/lint.json", binaryPath: "" },
    },
    expected: false,
  },
  {
    name: "config file at the root while a config path is set",
    input: {
      changedPath: "/work/app/gale.json",
      root: "/work/app",
      settings: { configPath: "config/lint.json", binaryPath: "" },
    },
    expected: true,
  },
] as const satisfies readonly Case<ShouldRestartInput, boolean>[];
