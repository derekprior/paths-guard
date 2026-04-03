import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChangedFiles } from "../src/changed-files";

// Mock @actions/github
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
  context: {
    repo: { owner: "test-owner", repo: "test-repo" },
    eventName: "push",
    payload: {},
    sha: "abc123",
  },
}));

import { getOctokit, context } from "@actions/github";

const mockOctokit = {
  rest: {
    repos: {
      compareCommitsWithBasehead: vi.fn(),
    },
    pulls: {
      listFiles: vi.fn(),
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (getOctokit as ReturnType<typeof vi.fn>).mockReturnValue(mockOctokit);
});

describe("getChangedFiles", () => {
  describe("push events", () => {
    beforeEach(() => {
      Object.assign(context, {
        eventName: "push",
        payload: {
          before: "aaa111",
          after: "bbb222",
        },
      });
    });

    it("returns changed files from compare API", async () => {
      mockOctokit.rest.repos.compareCommitsWithBasehead.mockResolvedValue({
        data: {
          files: [
            { filename: "src/index.ts" },
            { filename: "package.json" },
          ],
        },
      });

      const files = await getChangedFiles("fake-token");

      expect(files).toEqual(["src/index.ts", "package.json"]);
      expect(
        mockOctokit.rest.repos.compareCommitsWithBasehead
      ).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        basehead: "aaa111...bbb222",
      });
    });

    it("returns empty array when compare returns no files", async () => {
      mockOctokit.rest.repos.compareCommitsWithBasehead.mockResolvedValue({
        data: { files: [] },
      });

      const files = await getChangedFiles("fake-token");
      expect(files).toEqual([]);
    });

    it("throws when before sha is missing", async () => {
      Object.assign(context, {
        payload: { before: "0000000000000000000000000000000000000000", after: "bbb222" },
      });

      await expect(getChangedFiles("fake-token")).rejects.toThrow(
        /cannot determine/i
      );
    });
  });

  describe("pull_request events", () => {
    beforeEach(() => {
      Object.assign(context, {
        eventName: "pull_request",
        payload: {
          pull_request: { number: 42 },
        },
      });
    });

    it("returns changed files from PR files API", async () => {
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [
          { filename: "src/app.ts" },
          { filename: "tests/app.test.ts" },
        ],
      });

      const files = await getChangedFiles("fake-token");

      expect(files).toEqual(["src/app.ts", "tests/app.test.ts"]);
      expect(mockOctokit.rest.pulls.listFiles).toHaveBeenCalledWith({
        owner: "test-owner",
        repo: "test-repo",
        pull_number: 42,
        per_page: 100,
      });
    });

    it("returns empty array when PR has no changed files", async () => {
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({ data: [] });

      const files = await getChangedFiles("fake-token");
      expect(files).toEqual([]);
    });

    it("throws when pull_request payload is missing", async () => {
      Object.assign(context, {
        eventName: "pull_request",
        payload: {},
      });

      await expect(getChangedFiles("fake-token")).rejects.toThrow(
        /pull request/i
      );
    });
  });

  describe("unsupported events", () => {
    it("throws for unsupported event types", async () => {
      Object.assign(context, { eventName: "schedule" });

      await expect(getChangedFiles("fake-token")).rejects.toThrow(
        /unsupported.*schedule/i
      );
    });
  });
});
