import { describe, it, expect, vi, beforeEach } from "vitest";
import { getChangedFilesFromGit } from "../src/git-diff";

// Mock child_process.execFile
vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

// Mock @actions/core for logging
vi.mock("@actions/core", () => ({
  info: vi.fn(),
}));

import { execFile } from "child_process";

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

function mockExecFileSuccess(stdout: string) {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: object,
      cb: (err: Error | null, result: { stdout: string; stderr: string }) => void
    ) => {
      cb(null, { stdout, stderr: "" });
    }
  );
}

function mockExecFileFailure(message: string) {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: object,
      cb: (err: Error | null, result: { stdout: string; stderr: string }) => void
    ) => {
      cb(new Error(message), { stdout: "", stderr: message });
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GITHUB_WORKSPACE = "/workspace";
});

describe("getChangedFilesFromGit", () => {
  it("fetches the base commit and returns diff output", async () => {
    // First call: git fetch, second call: git diff
    let callCount = 0;
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: object,
        cb: (err: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        callCount++;
        if (args[0] === "fetch") {
          cb(null, { stdout: "", stderr: "" });
        } else if (args[0] === "diff") {
          cb(null, {
            stdout: "src/index.ts\npackage.json\n",
            stderr: "",
          });
        } else {
          cb(new Error("unexpected call"), { stdout: "", stderr: "" });
        }
      }
    );

    const files = await getChangedFilesFromGit("aaa111", "bbb222");

    expect(files).toEqual(["src/index.ts", "package.json"]);
    expect(callCount).toBe(2);
  });

  it("filters out empty lines from diff output", async () => {
    let callCount = 0;
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: object,
        cb: (err: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        callCount++;
        if (args[0] === "fetch") {
          cb(null, { stdout: "", stderr: "" });
        } else {
          cb(null, {
            stdout: "src/index.ts\n\npackage.json\n\n",
            stderr: "",
          });
        }
      }
    );

    const files = await getChangedFilesFromGit("aaa111", "bbb222");
    expect(files).toEqual(["src/index.ts", "package.json"]);
  });

  it("returns empty array when no files changed", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: object,
        cb: (err: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        if (args[0] === "fetch") {
          cb(null, { stdout: "", stderr: "" });
        } else {
          cb(null, { stdout: "", stderr: "" });
        }
      }
    );

    const files = await getChangedFilesFromGit("aaa111", "bbb222");
    expect(files).toEqual([]);
  });

  it("throws when git fetch fails", async () => {
    mockExecFileFailure("fatal: couldn't find remote ref");

    await expect(
      getChangedFilesFromGit("aaa111", "bbb222")
    ).rejects.toThrow(/fetch/i);
  });

  it("throws when git diff fails", async () => {
    mockExecFile.mockImplementation(
      (
        _cmd: string,
        args: string[],
        _opts: object,
        cb: (err: Error | null, result: { stdout: string; stderr: string }) => void
      ) => {
        if (args[0] === "fetch") {
          cb(null, { stdout: "", stderr: "" });
        } else {
          cb(new Error("bad revision"), { stdout: "", stderr: "" });
        }
      }
    );

    await expect(
      getChangedFilesFromGit("aaa111", "bbb222")
    ).rejects.toThrow(/diff/i);
  });

  it("provides a helpful message when fetch fails due to auth", async () => {
    mockExecFileFailure("fatal: could not read Username for 'https://github.com': terminal prompts disabled");

    await expect(
      getChangedFilesFromGit("aaa111", "bbb222")
    ).rejects.toThrow(/persist-credentials/i);
  });

  it("provides a helpful message for 'Authentication failed' errors", async () => {
    mockExecFileFailure("fatal: Authentication failed for 'https://github.com/owner/repo'");

    await expect(
      getChangedFilesFromGit("aaa111", "bbb222")
    ).rejects.toThrow(/persist-credentials/i);
  });
});
