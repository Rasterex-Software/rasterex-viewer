import { createCanvasCommandError } from "../canvas/canvasBrokerCommands.js";
import type { LoadAnnotationsOptions, LoadAnnotationsResult } from "./importTypes.js";

export const LOAD_ANNOTATIONS = "loadAnnotations";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(message: string) {
  return createCanvasCommandError(LOAD_ANNOTATIONS, message);
}

function validateJson(data: unknown): string {
  let snapshot: string;
  let value: unknown;
  try {
    snapshot = typeof data === "string" ? data : JSON.stringify(data);
    value = JSON.parse(snapshot);
  } catch {
    throw invalid("Provide valid, serializable annotation JSON.");
  }

  const records = Array.isArray(value)
    ? value
    : isRecord(value) && "items" in value
      ? value.items
      : [value];

  if (
    !Array.isArray(records) ||
    records.length === 0 ||
    !records.every(isAnnotationRecord)
  ) {
    throw invalid("Provide at least one annotation record with a valid native Type.");
  }
  return snapshot;
}

function isAnnotationRecord(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const entity = "Entity" in value ? value.Entity : value;
  if (!isRecord(entity)) {
    return false;
  }
  const type = entity.Type;
  if (typeof type !== "number" && (typeof type !== "string" || !type.trim())) {
    return false;
  }
  return Number.isSafeInteger(Number(type)) && Number(type) >= 0;
}

function validateXml(data: unknown, source: "inline" | "url"): string {
  if (typeof data !== "string" || !data.trim()) {
    throw invalid("Provide Rasterex markup XML or an HTTP(S) XML URL.");
  }
  const input = data.trim();

  if (source === "url") {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw invalid("Provide an absolute HTTP(S) annotation XML URL.");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw invalid("Annotation XML URLs must use HTTP(S) without embedded credentials.");
    }
    return url.href;
  }

  if (typeof DOMParser === "undefined") {
    throw invalid("Inline XML import requires a browser XML parser.");
  }
  // Native Rasterex markup has no document type declaration.
  if (/<!DOCTYPE\b/i.test(input)) {
    throw invalid("Rasterex markup XML must not contain a document type declaration.");
  }
  const xml = new DOMParser().parseFromString(input, "application/xml");
  const entities = Array.from(xml.documentElement.children).find(
    (child) => child.nodeName === "Entities"
  );
  const records = Array.from(entities?.children ?? []).filter(
    (child) => child.nodeName === "Entity"
  );
  const mandatoryFields = [
    "Type",
    "Subtype",
    "Alternative",
    "TimeStamp",
    "Rotation",
    "FileName",
    "Layout",
    "Scaling",
    "LoadScaling",
    "Signature",
    "Xoffset",
    "Yoffset",
    "LineWidth"
  ];
  const hasRecords =
    records.length > 0 &&
    Array.from(xml.getElementsByTagName("Entity")).every((record) => {
      const fields = Array.from(record.children);
      const hasFields = mandatoryFields.every((name) =>
        fields.some((field) => field.nodeName === name && field.textContent?.trim())
      );
      const rect = fields.find((field) => field.nodeName === "Rect");
      return (
        hasFields &&
        ["x", "y", "w", "h"].every((name) => {
          const value = rect?.getAttribute(name);
          return !!value?.trim() && Number.isFinite(Number(value));
        })
      );
    });
  if (
    xml.documentElement.nodeName !== "RasterexMarkup" ||
    xml.getElementsByTagName("parsererror").length > 0 ||
    !hasRecords
  ) {
    throw invalid(
      "Provide a RasterexMarkup XML export with complete native annotation records."
    );
  }
  return input;
}

export function createImportPayload(options: LoadAnnotationsOptions, requestId: string) {
  const {
    format,
    source = "inline",
    mode = "merge",
    replacePolicy = "skip",
    measurementScalePolicy = "currentPage",
    emitCreated = true
  } = options;

  if (
    (format !== "json" && format !== "xml") ||
    (source !== "inline" && source !== "url") ||
    (mode !== "merge" && mode !== "replaceAll") ||
    (replacePolicy !== "skip" && replacePolicy !== "replace") ||
    (measurementScalePolicy !== "currentPage" && measurementScalePolicy !== "preserve") ||
    typeof emitCreated !== "boolean"
  ) {
    throw invalid("Invalid annotation import options.");
  }
  if (source === "url" && (format !== "xml" || mode === "replaceAll")) {
    throw invalid(
      "URL import supports XML in merge mode. Use inline content to replace all."
    );
  }
  if (replacePolicy === "replace" && (format !== "json" || mode !== "merge")) {
    throw invalid("Replacing matching GUIDs is supported only when merging JSON.");
  }

  const data =
    format === "json" ? validateJson(options.data) : validateXml(options.data, source);
  return {
    requestId,
    format,
    source,
    data,
    merge: mode === "merge",
    replacePolicy,
    measurementScalePolicy,
    emitCreated
  };
}

export function matchesImportResult(
  result: Record<string, unknown>,
  sent: ReturnType<typeof createImportPayload>
): result is Record<string, unknown> & LoadAnnotationsResult {
  const { loaded, skipped, total } = result;
  const isCount = (value: unknown): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  return (
    isCount(loaded) &&
    isCount(skipped) &&
    isCount(total) &&
    result.format === sent.format &&
    result.merge === sent.merge &&
    result.replacePolicy === sent.replacePolicy &&
    (result.measurementScalePolicy === sent.measurementScalePolicy ||
      (result.measurementScalePolicy === undefined &&
        sent.measurementScalePolicy === "currentPage"))
  );
}
