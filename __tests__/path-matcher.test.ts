import { describe, it, expect } from "vitest";
import { matchPaths } from "../src/path-matcher";

describe("matchPaths", () => {
  describe("with paths filter (inclusion)", () => {
    it("returns true when a changed file matches a paths pattern", () => {
      const result = matchPaths({
        changedFiles: ["src/index.ts"],
        paths: ["src/**"],
      });
      expect(result).toBe(true);
    });

    it("returns false when no changed files match any paths pattern", () => {
      const result = matchPaths({
        changedFiles: ["docs/readme.md"],
        paths: ["src/**"],
      });
      expect(result).toBe(false);
    });

    it("returns true when any changed file matches any pattern", () => {
      const result = matchPaths({
        changedFiles: ["docs/readme.md", "src/utils.ts"],
        paths: ["src/**"],
      });
      expect(result).toBe(true);
    });

    it("supports multiple path patterns", () => {
      const result = matchPaths({
        changedFiles: ["tests/unit.test.ts"],
        paths: ["src/**", "tests/**"],
      });
      expect(result).toBe(true);
    });

    it("matches files in the root directory", () => {
      const result = matchPaths({
        changedFiles: ["package.json"],
        paths: ["package.json"],
      });
      expect(result).toBe(true);
    });

    it("supports single-star wildcard (no directory traversal)", () => {
      const result = matchPaths({
        changedFiles: ["src/deep/nested/file.ts"],
        paths: ["src/*.ts"],
      });
      expect(result).toBe(false);
    });

    it("supports double-star wildcard (directory traversal)", () => {
      const result = matchPaths({
        changedFiles: ["src/deep/nested/file.ts"],
        paths: ["src/**"],
      });
      expect(result).toBe(true);
    });

    it("supports file extension patterns", () => {
      const result = matchPaths({
        changedFiles: ["src/index.ts", "src/style.css"],
        paths: ["**/*.css"],
      });
      expect(result).toBe(true);
    });

    it("returns false for empty changed files", () => {
      const result = matchPaths({
        changedFiles: [],
        paths: ["src/**"],
      });
      expect(result).toBe(false);
    });
  });

  describe("with paths-ignore filter (exclusion)", () => {
    it("returns true when changed files are not in ignored paths", () => {
      const result = matchPaths({
        changedFiles: ["src/index.ts"],
        pathsIgnore: ["docs/**"],
      });
      expect(result).toBe(true);
    });

    it("returns false when all changed files are in ignored paths", () => {
      const result = matchPaths({
        changedFiles: ["docs/readme.md", "docs/guide.md"],
        pathsIgnore: ["docs/**"],
      });
      expect(result).toBe(false);
    });

    it("returns true when some changed files are not in ignored paths", () => {
      const result = matchPaths({
        changedFiles: ["docs/readme.md", "src/index.ts"],
        pathsIgnore: ["docs/**"],
      });
      expect(result).toBe(true);
    });

    it("returns false for empty changed files with paths-ignore", () => {
      const result = matchPaths({
        changedFiles: [],
        pathsIgnore: ["docs/**"],
      });
      expect(result).toBe(false);
    });
  });

  describe("with no filters", () => {
    it("returns true when neither paths nor paths-ignore is specified", () => {
      const result = matchPaths({
        changedFiles: ["src/index.ts"],
      });
      expect(result).toBe(true);
    });

    it("returns true for empty changed files when no filters", () => {
      const result = matchPaths({
        changedFiles: [],
      });
      expect(result).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles negation patterns in paths", () => {
      const result = matchPaths({
        changedFiles: ["src/generated/output.ts"],
        paths: ["src/**", "!src/generated/**"],
      });
      expect(result).toBe(false);
    });

    it("handles negation — matches non-negated files", () => {
      const result = matchPaths({
        changedFiles: ["src/index.ts", "src/generated/output.ts"],
        paths: ["src/**", "!src/generated/**"],
      });
      expect(result).toBe(true);
    });

    it("handles dot files", () => {
      const result = matchPaths({
        changedFiles: [".github/workflows/ci.yml"],
        paths: [".github/**"],
      });
      expect(result).toBe(true);
    });
  });
});
