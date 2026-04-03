export interface MatchPathsInput {
    changedFiles: string[];
    paths?: string[];
    pathsIgnore?: string[];
}
/**
 * Determines whether a workflow should run based on changed files and
 * path filter configuration.
 *
 * - If `paths` is provided, returns true if any changed file matches
 *   any pattern (after applying negation patterns).
 * - If `pathsIgnore` is provided, returns true if any changed file
 *   is NOT matched by the ignore patterns.
 * - If neither is provided, returns true (no filtering).
 */
export declare function matchPaths(input: MatchPathsInput): boolean;
