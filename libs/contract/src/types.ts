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

/**
 * What the host found before calling `resolveBinary`: the project's binary
 * (`projectBinaryPath`) when it exists on disk, and `gale` on PATH.
 */
export interface Probe {
  readonly projectBinary: string | null;
  readonly which: string | null;
}
