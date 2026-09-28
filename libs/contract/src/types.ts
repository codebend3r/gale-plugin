export type Os = "darwin" | "linux" | "win32";

/** `arch` is a Node-style name: "arm64", "x64", or anything else. */
export interface Platform {
  readonly os: Os;
  readonly arch: string;
}

/** The only settings the contract functions read. */
export interface PathSettings {
  readonly configPath: string;
  readonly binaryPath: string;
}

/** What the host found before calling `resolveBinary`. */
export interface Probe {
  readonly projectInstalled: boolean;
  readonly which: string | null;
}

export type Resolution =
  | {
      readonly found: true;
      readonly source: "setting" | "project" | "path";
      readonly command: string;
    }
  | { readonly found: false };
