/** One file the sync generator owns, in whole or in part. */
export interface Output {
  /** Workspace-relative path. */
  readonly path: string;
  /** Returns the file's up-to-date contents, given its current contents (null if missing). */
  render(existing: string | null): string;
}
