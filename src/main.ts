import { readFileSync } from "fs";
import { join } from "path";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { extractPathFilters } from "./workflow-parser";
import { getChangedFiles } from "./changed-files";
import { matchPaths } from "./path-matcher";

/**
 * Resolves the workflow file path from GITHUB_WORKFLOW_REF or the
 * explicit input.
 */
function resolveWorkflowFilePath(explicitPath: string): string {
  if (explicitPath) {
    return explicitPath;
  }

  const workflowRef = process.env.GITHUB_WORKFLOW_REF;
  if (!workflowRef) {
    throw new Error(
      "Cannot determine workflow file: GITHUB_WORKFLOW_REF is not set " +
        "and no 'workflow-file' input was provided."
    );
  }

  // GITHUB_WORKFLOW_REF format: owner/repo/.github/workflows/file.yml@ref
  const atIndex = workflowRef.lastIndexOf("@");
  const refWithoutSha = atIndex >= 0 ? workflowRef.substring(0, atIndex) : workflowRef;

  // Strip the owner/repo prefix to get the relative path
  const { owner, repo } = context.repo;
  const prefix = `${owner}/${repo}/`;
  if (refWithoutSha.startsWith(prefix)) {
    return refWithoutSha.substring(prefix.length);
  }

  return refWithoutSha;
}

export async function run(): Promise<void> {
  try {
    const token = core.getInput("token", { required: true });
    const explicitWorkflowFile = core.getInput("workflow-file");
    const fallback = core.getInput("fallback") || "run";

    // 1. Resolve and read the workflow file
    const workflowRelPath = resolveWorkflowFilePath(explicitWorkflowFile);
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
    const workflowFullPath = join(workspace, workflowRelPath);

    core.info(`Reading workflow file: ${workflowRelPath}`);
    const workflowContent = readFileSync(workflowFullPath, "utf-8");

    // 2. Extract path filters for the current event
    const filters = extractPathFilters(workflowContent, context.eventName);

    if (!filters.paths && !filters.pathsIgnore) {
      core.info(
        "No path filters configured for this event. Nothing to guard."
      );
      core.setOutput("should_run", "true");
      return;
    }

    core.info(
      `Found path filters — paths: ${JSON.stringify(filters.paths)}, ` +
        `paths-ignore: ${JSON.stringify(filters.pathsIgnore)}`
    );

    // 3. Get changed files
    let changedFiles: string[];
    try {
      changedFiles = await getChangedFiles(token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      core.warning(
        `Could not determine changed files: ${message}. ` +
          `Falling back to '${fallback}' behavior.`
      );

      if (fallback === "cancel") {
        core.setOutput("should_run", "false");
        await cancelWorkflow(token);
        return;
      }

      // Default: allow the workflow to run
      core.setOutput("should_run", "true");
      return;
    }

    core.info(`Changed files (${changedFiles.length}): ${changedFiles.join(", ")}`);

    // 4. Match paths
    const shouldRun = matchPaths({
      changedFiles,
      paths: filters.paths,
      pathsIgnore: filters.pathsIgnore,
    });

    core.setOutput("should_run", String(shouldRun));

    if (shouldRun) {
      core.info("Path filters matched. Workflow should proceed.");
    } else {
      core.info(
        "Path filters did NOT match any changed files. " +
          "This workflow was likely triggered due to a GitHub diff " +
          "computation issue. Cancelling workflow run."
      );
      await cancelWorkflow(token);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`paths-guard failed: ${message}`);
  }
}

async function cancelWorkflow(token: string): Promise<void> {
  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;

  core.info(`Cancelling workflow run ${context.runId}...`);
  await octokit.rest.actions.cancelWorkflowRun({
    owner,
    repo,
    run_id: context.runId,
  });
}
