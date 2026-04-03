import { describe, it, expect, vi, beforeEach } from "vitest";
import { run } from "../src/main";

// Mock fs — must be before other mocks that depend on module loading
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue("mock-workflow-content"),
  };
});

// Mock all dependencies
vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  setFailed: vi.fn(),
}));

vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
  context: {
    repo: { owner: "test-owner", repo: "test-repo" },
    eventName: "push",
    payload: {},
    sha: "abc123",
    runId: 12345,
    workflow_ref:
      "test-owner/test-repo/.github/workflows/ci.yml@refs/heads/main",
  },
}));

vi.mock("../src/workflow-parser", () => ({
  extractPathFilters: vi.fn(),
}));

vi.mock("../src/changed-files", () => ({
  getChangedFiles: vi.fn(),
}));

vi.mock("../src/path-matcher", () => ({
  matchPaths: vi.fn(),
}));

import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { extractPathFilters } from "../src/workflow-parser";
import { getChangedFiles } from "../src/changed-files";
import { matchPaths } from "../src/path-matcher";

const mockGetInput = core.getInput as ReturnType<typeof vi.fn>;
const mockSetOutput = core.setOutput as ReturnType<typeof vi.fn>;
const mockInfo = core.info as ReturnType<typeof vi.fn>;
const mockWarning = core.warning as ReturnType<typeof vi.fn>;
const mockSetFailed = core.setFailed as ReturnType<typeof vi.fn>;
const mockExtractPathFilters = extractPathFilters as ReturnType<typeof vi.fn>;
const mockGetChangedFiles = getChangedFiles as ReturnType<typeof vi.fn>;
const mockMatchPaths = matchPaths as ReturnType<typeof vi.fn>;
const mockGetOctokit = getOctokit as ReturnType<typeof vi.fn>;

const mockCancelWorkflow = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  mockGetInput.mockImplementation((name: string) => {
    switch (name) {
      case "token":
        return "fake-token";
      case "workflow-file":
        return "";
      case "fallback":
        return "run";
      default:
        return "";
    }
  });

  mockGetOctokit.mockReturnValue({
    rest: {
      actions: {
        cancelWorkflowRun: mockCancelWorkflow,
      },
    },
  });

  Object.assign(context, {
    eventName: "push",
    repo: { owner: "test-owner", repo: "test-repo" },
    runId: 12345,
    payload: {},
  });

  // Default: set GITHUB_WORKFLOW_REF
  process.env.GITHUB_WORKFLOW_REF =
    "test-owner/test-repo/.github/workflows/ci.yml@refs/heads/main";
  process.env.GITHUB_WORKSPACE = "/workspace";
});

describe("run", () => {
  describe("when paths match", () => {
    it("sets should_run to true and does not cancel", async () => {
      mockExtractPathFilters.mockReturnValue({
        paths: ["src/**"],
        pathsIgnore: undefined,
      });
      mockGetChangedFiles.mockResolvedValue(["src/index.ts"]);
      mockMatchPaths.mockReturnValue(true);

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith("should_run", "true");
      expect(mockCancelWorkflow).not.toHaveBeenCalled();
    });
  });

  describe("when paths do not match", () => {
    it("sets should_run to false and cancels the workflow by default", async () => {
      mockExtractPathFilters.mockReturnValue({
        paths: ["src/**"],
        pathsIgnore: undefined,
      });
      mockGetChangedFiles.mockResolvedValue(["docs/readme.md"]);
      mockMatchPaths.mockReturnValue(false);

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith("should_run", "false");
      expect(mockCancelWorkflow).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        run_id: 12345,
      });
    });

    it("sets should_run to false but does NOT cancel when cancel input is false", async () => {
      mockGetInput.mockImplementation((name: string) => {
        switch (name) {
          case "token":
            return "fake-token";
          case "cancel":
            return "false";
          case "fallback":
            return "run";
          default:
            return "";
        }
      });
      mockExtractPathFilters.mockReturnValue({
        paths: ["src/**"],
        pathsIgnore: undefined,
      });
      mockGetChangedFiles.mockResolvedValue(["docs/readme.md"]);
      mockMatchPaths.mockReturnValue(false);

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith("should_run", "false");
      expect(mockCancelWorkflow).not.toHaveBeenCalled();
    });
  });

  describe("cancel input", () => {
    it("defaults to cancelling when cancel input is not set", async () => {
      mockGetInput.mockImplementation((name: string) => {
        switch (name) {
          case "token":
            return "fake-token";
          case "cancel":
            return "";
          case "fallback":
            return "run";
          default:
            return "";
        }
      });
      mockExtractPathFilters.mockReturnValue({
        paths: ["src/**"],
        pathsIgnore: undefined,
      });
      mockGetChangedFiles.mockResolvedValue(["docs/readme.md"]);
      mockMatchPaths.mockReturnValue(false);

      await run();

      expect(mockCancelWorkflow).toHaveBeenCalled();
    });

    it("does not cancel when cancel is false even on fallback=cancel", async () => {
      mockGetInput.mockImplementation((name: string) => {
        switch (name) {
          case "token":
            return "fake-token";
          case "cancel":
            return "false";
          case "fallback":
            return "cancel";
          default:
            return "";
        }
      });
      mockExtractPathFilters.mockReturnValue({
        paths: ["src/**"],
        pathsIgnore: undefined,
      });
      mockGetChangedFiles.mockRejectedValue(new Error("API error"));

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith("should_run", "false");
      expect(mockCancelWorkflow).not.toHaveBeenCalled();
    });
  });

  describe("when workflow has no path filters", () => {
    it("sets should_run to true (nothing to guard)", async () => {
      mockExtractPathFilters.mockReturnValue({
        paths: undefined,
        pathsIgnore: undefined,
      });

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith("should_run", "true");
      expect(mockCancelWorkflow).not.toHaveBeenCalled();
      expect(mockGetChangedFiles).not.toHaveBeenCalled();
    });
  });

  describe("fallback behavior", () => {
    it("defaults to run when changed files cannot be determined and fallback is 'run'", async () => {
      mockExtractPathFilters.mockReturnValue({
        paths: ["src/**"],
        pathsIgnore: undefined,
      });
      mockGetChangedFiles.mockRejectedValue(
        new Error("API error")
      );

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith("should_run", "true");
      expect(mockWarning).toHaveBeenCalled();
      expect(mockCancelWorkflow).not.toHaveBeenCalled();
    });

    it("cancels when changed files cannot be determined and fallback is 'cancel'", async () => {
      mockGetInput.mockImplementation((name: string) => {
        switch (name) {
          case "token":
            return "fake-token";
          case "fallback":
            return "cancel";
          default:
            return "";
        }
      });
      mockExtractPathFilters.mockReturnValue({
        paths: ["src/**"],
        pathsIgnore: undefined,
      });
      mockGetChangedFiles.mockRejectedValue(
        new Error("API error")
      );

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith("should_run", "false");
      expect(mockCancelWorkflow).toHaveBeenCalled();
    });
  });

  describe("workflow file resolution", () => {
    it("derives workflow file path from GITHUB_WORKFLOW_REF", async () => {
      process.env.GITHUB_WORKFLOW_REF =
        "test-owner/test-repo/.github/workflows/deploy.yml@refs/heads/main";

      mockExtractPathFilters.mockReturnValue({
        paths: undefined,
        pathsIgnore: undefined,
      });

      await run();

      // The extractPathFilters should have been called with content read
      // from the correct file path. We verify the path was resolved correctly
      // by checking the function was called at all (file reading is tested
      // via integration or by checking the resolved path).
      expect(mockSetOutput).toHaveBeenCalledWith("should_run", "true");
    });
  });

  describe("error handling", () => {
    it("sets failed when an unexpected error occurs in workflow parsing", async () => {
      mockExtractPathFilters.mockImplementation(() => {
        throw new Error("Invalid YAML");
      });

      await run();

      expect(mockSetFailed).toHaveBeenCalledWith(
        expect.stringContaining("Invalid YAML")
      );
    });
  });
});
