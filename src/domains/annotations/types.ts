import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  DomainEventHandler,
  DomainEventUnsubscribe
} from "../../utils/DomainEventEmitter.js";

export interface AnnotationRect {
  x: unknown;
  y: unknown;
  w: unknown;
  h: unknown;
}

export interface AnnotationNormalizedData {
  UniqueID: unknown;
  ID: unknown;
  Type: unknown;
  Subtype: unknown;
  FileName: unknown;
  ViewName: unknown;
  TimeStamp: unknown;
  Locked: unknown;
  Status: unknown;
  DimText: unknown;
  DimRadius: string | null;
  Rect: AnnotationRect | null;
  Transparency: unknown;
  FillColor: unknown;
  LineColor: unknown;
  TextColor: unknown;
  LineWidth: unknown;
  Tool?: string | null;
}

export type AnnotationRawData = Record<string, unknown>;
export type AnnotationEventData = AnnotationNormalizedData | AnnotationRawData | string;

export interface AnnotationEvent {
  guid: string;
  data: AnnotationEventData;
  dbUniqueID: unknown | null;
  source: "current-canvas";
  detail: "normalized" | "raw";
}

export interface AnnotationDataItem {
  [key: string]: unknown;
  guid?: string;
  isMeasure?: boolean;
  markupnumber?: number;
  type?: number;
  timestamp?: number;
  data?: AnnotationRawData;
  Tool?: string | null;
}

export type AnnotationDataFilter = "all" | "annotations" | "measurements" | "drawing";

export interface GetAnnotationDataOptions {
  filter?: AnnotationDataFilter | string;
  requestId?: string;
  timeoutMs?: number;
}

export interface GetAnnotationDataResult {
  filter: string;
  requestId: string;
  items: AnnotationDataItem[];
  count?: number;
}

export interface SelectAnnotationOptions {
  uniqueId?: string;
  guid?: string;
}

export type DeleteAnnotationOptions = SelectAnnotationOptions;

export interface AnnotationVisibilityTargetOptions {
  annotationIds: string[];
  requestId?: string;
  timeoutMs?: number;
}

export interface AnnotationVisibilityOptions extends AnnotationVisibilityTargetOptions {
  visible?: boolean;
}

export interface AnnotationVisibilityResult {
  success: boolean;
  visible: boolean;
  annotationIds: string[];
  updatedCount: number;
  missingAnnotationIds: string[];
  requestId: string;
  error?: "missing_annotation_ids" | "annotations_not_found" | string;
}

export interface CountPointModeOptions {
  guid: string;
  enabled: boolean;
  requestId?: string;
}

export interface SaveAnnotationsOptions {
  requestId?: string;
  timeoutMs?: number;
}

export interface SaveAnnotationsResult {
  success: boolean;
  requestId: string;
  error?: string;
}

export interface AutoSaveOptions {
  enabled: boolean;
}

export interface AnnotationEventMap {
  created: AnnotationEvent;
  createdWithDetail: AnnotationEvent;
  selected: AnnotationEvent;
  selectedWithDetail: AnnotationEvent;
  deleted: AnnotationEvent;
  deletedWithDetail: AnnotationEvent;
}

export type AnnotationEventName = keyof AnnotationEventMap;
export type AnnotationEventHandler<TEventName extends AnnotationEventName> =
  DomainEventHandler<AnnotationEventMap[TEventName]>;
export type AnnotationEventUnsubscribe = DomainEventUnsubscribe;

export interface AnnotationsApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}
