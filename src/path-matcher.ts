import picomatch from "picomatch";

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
export function matchPaths(input: MatchPathsInput): boolean {
  const { changedFiles, paths, pathsIgnore } = input;

  if (!paths && !pathsIgnore) {
    return true;
  }

  if (changedFiles.length === 0) {
    return false;
  }

  if (paths) {
    return matchWithPaths(changedFiles, paths);
  }

  if (pathsIgnore) {
    return matchWithPathsIgnore(changedFiles, pathsIgnore);
  }

  return true;
}

function matchWithPaths(changedFiles: string[], patterns: string[]): boolean {
  const inclusive = patterns.filter((p) => !p.startsWith("!"));
  const negations = patterns
    .filter((p) => p.startsWith("!"))
    .map((p) => p.slice(1));

  const inclusiveMatcher = picomatch(inclusive, { dot: true });
  const negationMatcher =
    negations.length > 0 ? picomatch(negations, { dot: true }) : null;

  return changedFiles.some(
    (file) => inclusiveMatcher(file) && (!negationMatcher || !negationMatcher(file))
  );
}

function matchWithPathsIgnore(
  changedFiles: string[],
  patterns: string[]
): boolean {
  const matcher = picomatch(patterns, { dot: true });
  return changedFiles.some((file) => !matcher(file));
}
