export interface PathFilters {
    paths: string[] | undefined;
    pathsIgnore: string[] | undefined;
}
/**
 * Parses a workflow YAML string and extracts the path filters for the
 * given event type.
 */
export declare function extractPathFilters(workflowContent: string, eventName: string): PathFilters;
