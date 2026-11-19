import { isRecord } from "./ParentCommands.js";

export function validToolState(result: Record<string, unknown>): boolean {
  const booleanMap = (value: unknown) =>
    isRecord(value) && Object.values(value).every((entry) => typeof entry === "boolean");
  return booleanMap(result.tools) && booleanMap(result.navigation);
}
