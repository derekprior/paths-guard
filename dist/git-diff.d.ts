/**
 * Gets the list of changed files between two commits using local git
 * operations. Fetches the base commit (depth=1) to ensure it's available
 * in shallow clones, then runs git diff.
 */
export declare function getChangedFilesFromGit(baseSha: string, headSha: string): Promise<string[]>;
