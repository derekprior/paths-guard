import { getOctokit, context } from "@actions/github";
import * as core from "@actions/core";
import { getChangedFilesFromGit } from "./git-diff";

const NULL_SHA = "0000000000000000000000000000000000000000";

/**
 * Gets the list of changed files for the current workflow run.
 * Tries the GitHub API first (fast, cheap). If the API fails, falls back
 * to local git diff (resilient, but requires fetching the base commit).
 */
export async function getChangedFiles(token: string): Promise<string[]> {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;

  switch (context.eventName) {
    case "push":
      return getChangedFilesForPush(octokit, owner, repo);
    case "pull_request":
    case "pull_request_target":
      return getChangedFilesForPR(octokit, owner, repo);
    default:
      throw new Error(
        `Unsupported event type: '${context.eventName}'. ` +
          "paths-guard only supports push and pull_request events."
      );
  }
}

async function getChangedFilesForPush(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string
): Promise<string[]> {
  const before = context.payload.before as string | undefined;
  const after = (context.payload.after as string | undefined) ?? context.sha;

  if (!before || before === NULL_SHA) {
    throw new Error(
      "Cannot determine changed files: the 'before' commit SHA is missing " +
        "or this is the initial push to a new branch. paths-guard requires " +
        "a valid base commit to compare against."
    );
  }

  try {
    const response = await octokit.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${before}...${after}`,
    });
    return (response.data.files ?? []).map((f) => f.filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.warning(`GitHub API compare failed: ${message}. Trying local git diff...`);
    return getChangedFilesFromGit(before, after);
  }
}

async function getChangedFilesForPR(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string
): Promise<string[]> {
  const pr = context.payload.pull_request;

  if (!pr?.number) {
    throw new Error(
      "Cannot determine changed files: pull request number not found in event payload."
    );
  }

  try {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
      per_page: 100,
    });
    return response.data.map((f) => f.filename);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.warning(`GitHub API PR files failed: ${message}. Trying local git diff...`);

    const baseSha = pr.base?.sha;
    const headSha = pr.head?.sha;
    if (!baseSha || !headSha) {
      throw new Error(
        "Cannot fall back to git diff: PR base/head SHA not found in event payload."
      );
    }
    return getChangedFilesFromGit(baseSha, headSha);
  }
}
