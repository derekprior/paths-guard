import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import * as core from "@actions/core";

const execFile = promisify(execFileCb);

/**
 * Gets the list of changed files between two commits using local git
 * operations. Fetches the base commit (depth=1) to ensure it's available
 * in shallow clones, then runs git diff.
 */
export async function getChangedFilesFromGit(
  baseSha: string,
  headSha: string
): Promise<string[]> {
  const cwd = process.env.GITHUB_WORKSPACE || process.cwd();

  core.info(
    `Falling back to local git diff: fetching base commit ${baseSha}...`
  );

  try {
    await execFile("git", ["fetch", "origin", baseSha, "--depth=1"], { cwd });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Git fetch of base commit failed: ${message}`);
  }

  try {
    const { stdout } = await execFile(
      "git",
      ["diff", "--name-only", `${baseSha}...${headSha}`],
      { cwd }
    );
    return stdout.split("\n").filter((line) => line.length > 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Git diff failed: ${message}`);
  }
}
