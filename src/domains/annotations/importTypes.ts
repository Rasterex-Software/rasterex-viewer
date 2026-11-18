import type { AnnotationDataItem } from "./types.js";

export type AnnotationImportMode = "merge" | "replaceAll";
export type AnnotationImportReplacePolicy = "skip" | "replace";
export type AnnotationImportScalePolicy = "currentPage" | "preserve";
export type AnnotationImportJson =
  | string
  | AnnotationDataItem
  | readonly AnnotationDataItem[]
  | { items: readonly AnnotationDataItem[] };

interface AnnotationImportOptions {
  mode?: AnnotationImportMode;
  measurementScalePolicy?: AnnotationImportScalePolicy;
  emitCreated?: boolean;
  requestId?: string;
  timeoutMs?: number;
}

export type LoadAnnotationsOptions = AnnotationImportOptions &
  (
    | {
        format: "json";
        source?: "inline";
        data: AnnotationImportJson;
        replacePolicy?: AnnotationImportReplacePolicy;
      }
    | { format: "xml"; source?: "inline"; data: string; replacePolicy?: never }
    | {
        format: "xml";
        source: "url";
        data: string;
        mode?: "merge";
        replacePolicy?: never;
      }
  );

export interface LoadAnnotationsResult {
  requestId: string;
  /** Canvas's count can include matching GUIDs that were already present. */
  loaded: number;
  skipped: number;
  total: number;
  format: "json" | "xml";
  merge: boolean;
  replacePolicy: AnnotationImportReplacePolicy;
  /** Older Canvas builds may omit this field. */
  measurementScalePolicy?: AnnotationImportScalePolicy;
}
