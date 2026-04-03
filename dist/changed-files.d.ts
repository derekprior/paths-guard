/**
 * Gets the list of changed files for the current workflow run using the
 * GitHub API. Supports push and pull_request events.
 */
export declare function getChangedFiles(token: string): Promise<string[]>;
