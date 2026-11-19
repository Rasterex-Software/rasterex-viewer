import { validToolState } from "../canvas/parentToolState.js";
import { isRecord } from "../canvas/ParentCommands.js";

const controlCharacters = /[\u0000-\u001f\u007f]/;
const infoControlCharacters = /[\u0000-\u001f]/;

export function validCountConfiguration(options: unknown): boolean {
  if (
    !isRecord(options) ||
    !["always", "selected", "hidden"].includes(options.visibility as string) ||
    !["value", "name", "nameValue"].includes(options.content as string)
  ) {
    return false;
  }
  const { name, markerName, numbered, symbol } = options;
  const validName = (value: unknown) =>
    value === undefined ||
    (typeof value === "string" && value.length <= 160 && !controlCharacters.test(value));
  return (
    validName(name) &&
    validName(markerName) &&
    (numbered === undefined || typeof numbered === "boolean") &&
    (symbol === undefined ||
      (typeof symbol === "string" &&
        Array.from(symbol).length <= 3 &&
        !controlCharacters.test(symbol)))
  );
}

export function validCountInfo(info: unknown): boolean {
  if (
    !isRecord(info) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(info))
  ) {
    return false;
  }
  const entries = Object.entries(info);
  return (
    entries.length <= 24 &&
    entries.every(([key, value]) => {
      if (
        !key ||
        key.length > 64 ||
        infoControlCharacters.test(key) ||
        ["__proto__", "constructor", "prototype"].includes(key)
      ) {
        return false;
      }
      return (
        value === null ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "string" &&
          value.length <= 512 &&
          !infoControlCharacters.test(value))
      );
    })
  );
}

export function validCountItems(result: Record<string, unknown>, guid: string): boolean {
  const { items } = result;
  if (
    !validToolState(result) ||
    result.guid !== guid ||
    result.coordinateSpace !== "nativeAnnotation" ||
    !Array.isArray(items) ||
    items.length > 2000
  ) {
    return false;
  }
  const ids = new Set<string>();
  return items.every((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      !item.id ||
      item.id.length > 100 ||
      ids.has(item.id) ||
      item.index !== index ||
      !isRecord(item.point) ||
      !Number.isFinite(item.point.x) ||
      !Number.isFinite(item.point.y) ||
      !validCountInfo(item.info)
    ) {
      return false;
    }
    ids.add(item.id);
    return true;
  });
}
