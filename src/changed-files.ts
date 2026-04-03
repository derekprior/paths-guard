import { getOctokit, context } from "@actions/github";

const NULL_SHA = "0000000000000000000000000000000000000000";

/**
 * Gets the list of changed files for the current workflow run using the
 * GitHub API. Supports push and pull_request events.
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
  const after = context.payload.after as string | undefined;

  if (!before || before === NULL_SHA) {
    throw new Error(
      "Cannot determine changed files: the 'before' commit SHA is missing " +
        "or this is the initial push to a new branch. paths-guard requires " +
        "a valid base commit to compare against."
    );
  }

  const response = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${before}...${after ?? context.sha}`,
  });

  return (response.data.files ?? []).map((f) => f.filename);
}

async function getChangedFilesForPR(
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string
): Promise<string[]> {
  const prNumber = context.payload.pull_request?.number;

  if (!prNumber) {
    throw new Error(
      "Cannot determine changed files: pull request number not found in event payload."
    );
  }

  const response = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return response.data.map((f) => f.filename);
}
