/**
 * Gets the list of changed files for the current workflow run.
 * Tries the GitHub API first (fast, cheap). If the API fails, falls back
 * to local git diff (resilient, but requires fetching the base commit).
 */
export declare function getChangedFiles(token: string): Promise<string[]>;
