/**
 * One shared test case. TypeScript runs these directly; the codegen sync
 * generator writes them out as native Rust and Kotlin tests.
 *
 * Paths are POSIX-style, so the cases pass on macOS and Linux.
 */
export interface Case<Input, Expected> {
  readonly name: string;
  readonly input: Input;
  readonly expected: Expected;
}
