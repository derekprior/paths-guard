import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { extractPathFilters } from "../src/workflow-parser";

function fixture(name: string): string {
  return readFileSync(
    join(__dirname, "fixtures", name),
    "utf-8"
  );
}

describe("extractPathFilters", () => {
  describe("push event", () => {
    it("extracts paths from push trigger", () => {
      const result = extractPathFilters(
        fixture("workflow-with-paths.yml"),
        "push"
      );
      expect(result).toEqual({
        paths: ["src/**", "package.json"],
        pathsIgnore: undefined,
      });
    });

    it("extracts paths-ignore from push trigger", () => {
      const result = extractPathFilters(
        fixture("workflow-with-paths-ignore.yml"),
        "push"
      );
      expect(result).toEqual({
        paths: undefined,
        pathsIgnore: ["docs/**", "*.md"],
      });
    });

    it("returns no filters when push has no path config", () => {
      const result = extractPathFilters(
        fixture("workflow-no-paths.yml"),
        "push"
      );
      expect(result).toEqual({
        paths: undefined,
        pathsIgnore: undefined,
      });
    });

    it("returns no filters for simple string trigger", () => {
      const result = extractPathFilters(
        fixture("workflow-simple-trigger.yml"),
        "push"
      );
      expect(result).toEqual({
        paths: undefined,
        pathsIgnore: undefined,
      });
    });
  });

  describe("pull_request event", () => {
    it("extracts paths from pull_request trigger", () => {
      const result = extractPathFilters(
        fixture("workflow-with-paths.yml"),
        "pull_request"
      );
      expect(result).toEqual({
        paths: ["src/**", "tests/**"],
        pathsIgnore: undefined,
      });
    });

    it("extracts paths-ignore from pull_request in mixed workflow", () => {
      const result = extractPathFilters(
        fixture("workflow-mixed-triggers.yml"),
        "pull_request"
      );
      expect(result).toEqual({
        paths: undefined,
        pathsIgnore: ["docs/**"],
      });
    });
  });

  describe("event not in workflow", () => {
    it("throws when the event type is not configured in the workflow", () => {
      expect(() =>
        extractPathFilters(fixture("workflow-no-paths.yml"), "pull_request")
      ).toThrow(/not found/i);
    });

    it("throws for simple trigger when querying wrong event", () => {
      expect(() =>
        extractPathFilters(
          fixture("workflow-simple-trigger.yml"),
          "pull_request"
        )
      ).toThrow(/not found/i);
    });
  });

  describe("invalid YAML", () => {
    it("throws for empty content", () => {
      expect(() => extractPathFilters("", "push")).toThrow();
    });

    it("throws for YAML without 'on' key", () => {
      expect(() =>
        extractPathFilters("jobs:\n  build:\n    runs-on: ubuntu-latest", "push")
      ).toThrow(/trigger/i);
    });
  });
});
