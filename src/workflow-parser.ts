import { parse } from "yaml";

export interface PathFilters {
  paths: string[] | undefined;
  pathsIgnore: string[] | undefined;
}

/**
 * Parses a workflow YAML string and extracts the path filters for the
 * given event type.
 */
export function extractPathFilters(
  workflowContent: string,
  eventName: string
): PathFilters {
  const workflow = parse(workflowContent);

  if (!workflow || !workflow.on) {
    throw new Error(
      "Invalid workflow: no trigger configuration found (missing 'on' key)"
    );
  }

  const triggers = workflow.on;

  // Handle `on: push` or `on: [push, pull_request]` (no config, just event names)
  if (typeof triggers === "string") {
    if (triggers === eventName) {
      return { paths: undefined, pathsIgnore: undefined };
    }
    throw new Error(
      `Event '${eventName}' not found in workflow triggers`
    );
  }

  if (Array.isArray(triggers)) {
    if (triggers.includes(eventName)) {
      return { paths: undefined, pathsIgnore: undefined };
    }
    throw new Error(
      `Event '${eventName}' not found in workflow triggers`
    );
  }

  // Handle `on: { push: { paths: [...] } }`
  if (typeof triggers === "object") {
    const eventConfig = triggers[eventName];

    if (eventConfig === undefined) {
      throw new Error(
        `Event '${eventName}' not found in workflow triggers`
      );
    }

    // `on: { push: null }` — event listed but no config
    if (eventConfig === null) {
      return { paths: undefined, pathsIgnore: undefined };
    }

    return {
      paths: eventConfig.paths ?? undefined,
      pathsIgnore: eventConfig["paths-ignore"] ?? undefined,
    };
  }

  throw new Error("Invalid workflow: unexpected trigger format");
}
