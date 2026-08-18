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
  DimLength: string | null;
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
/**
 * Known operation state included by Canvas annotation detail events. Additional
 * Canvas fields are preserved.
 */
export interface AnnotationDetailOperation extends AnnotationRawData {
  created?: boolean;
  modified?: boolean;
  deleted?: boolean;
}

/** @deprecated Use {@link AnnotationDetailOperation}. */
export type AnnotationCreationOperation = AnnotationDetailOperation;

/** A point collection as emitted in the known Canvas annotation detail payload. */
export interface AnnotationDetailPoints extends AnnotationRawData {
  Point?: unknown[];
}

/**
 * Known Canvas annotation entity fields from the detail creation payload.
 *
 * Canvas annotations vary by tool and deployment, so every field is optional
 * and unrecognized fields remain available through the index signature.
 */
export interface AnnotationDetailEntity extends AnnotationRawData {
  ID?: number;
  Image?: unknown | null;
  UniqueID?: string;
  Imagehref?: string | null;
  SvgContent?: string | null;
  Type?: number;
  Subtype?: number;
  Alternative?: number;
  Redaction?: number;
  Layer?: number;
  Rotation?: number;
  TextRotation?: number;
  PageRotation?: number;
  FileName?: string;
  Layout?: string;
  View?: number;
  ViewName3D?: string | null;
  For3DView?: unknown | null;
  PageHeight3D?: number | null;
  PageWidth3D?: number | null;
  ViewName?: string;
  Handle?: number;
  FillColor?: string;
  LineColor?: string;
  TextColor?: string;
  Transparency?: number;
  Consolidated?: number;
  HaveLink?: number;
  HaveLeader?: number;
  HasScale?: unknown | null;
  Locked?: boolean;
  ScalingObject?: unknown | null;
  LeaderReference?: unknown | null;
  Entity?: unknown | null;
  FixedScale?: number;
  LineStyleScale?: number;
  LinkURL?: string;
  Font?: unknown;
  Text?: string;
  Status?: string;
  SmallText?: string;
  DimText?: string;
  DimLength?: string | null;
  DimRadius?: string | null;
  CustomLabelOn?: number;
  CustomLabelText?: string;
  TextWidth?: number;
  Signature?: string;
  Name?: string;
  TimeStamp?: number;
  Scaling?: number;
  LoadScaling?: number;
  Printscale?: number;
  Xoffset?: number;
  Yoffset?: number;
  LineWidth?: number;
  LineWidthPx?: number;
  LineWidthSegment?: number;
  ArrowSize?: number;
  LineStyle?: number;
  MainImageScaling?: number;
  MainImageOffsetX?: string;
  MainImageOffsetY?: string;
  DocScale?: number;
  DocOffsetX?: number;
  DocOffsetY?: number;
  Points?: AnnotationDetailPoints;
  Line?: unknown[];
  Holes?: unknown[];
  outerRadius?: number | null;
  innerRadius?: number | null;
  startX?: number | null;
  startY?: number | null;
  secondX?: number | null;
  secondY?: number | null;
  endX?: number | null;
  endY?: number | null;
  LeaderLineOffset?: number | null;
  LabelOffsetX?: number | null;
  LabelOffsetY?: number | null;
  LabelColor?: string | null;
  Rect?: AnnotationRect | null;
  Extended?: unknown[];
  Comments?: unknown[];
  FixedScaleFactor?: number;
}

/**
 * Detail data received with Canvas annotation detail events. This known shape
 * is based on Rectangle and MeasureArc reference payloads.
 */
export interface AnnotationDetailData extends AnnotationRawData {
  operation?: AnnotationDetailOperation;
  Entity?: AnnotationDetailEntity | null;
  Tool?: string | null;
}

/** Detail data received with `annotationCreatedWithDetail`. */
export type AnnotationCreatedWithDetailData = AnnotationDetailData;

/** Detail data received with `annotationSelectedWithDetail`. */
export type AnnotationSelectedWithDetailData = AnnotationDetailData;

/** Detail data received with `annotationDeletedWithDetail`. */
export type AnnotationDeletedWithDetailData = AnnotationDetailData;

export type AnnotationEventData =
  | AnnotationNormalizedData
  | AnnotationRawData
  | string;

export interface AnnotationEvent<
  TData extends AnnotationEventData = AnnotationEventData,
  TDetail extends "normalized" | "raw" = "normalized" | "raw"
> {
  guid: string;
  data: TData;
  dbUniqueID: unknown | null;
  source: "current-canvas";
  detail: TDetail;
}

/** Public callback event for `viewer.annotations.on("createdWithDetail", ...)`. */
export type AnnotationCreatedWithDetailEvent = AnnotationEvent<
  AnnotationCreatedWithDetailData,
  "raw"
>;

/** Public callback event for `viewer.annotations.on("selectedWithDetail", ...)`. */
export type AnnotationSelectedWithDetailEvent = AnnotationEvent<
  AnnotationSelectedWithDetailData,
  "raw"
>;

/** Public callback event for `viewer.annotations.on("deletedWithDetail", ...)`. */
export type AnnotationDeletedWithDetailEvent = AnnotationEvent<
  AnnotationDeletedWithDetailData,
  "raw"
>;

/** Public callback event for normalized Canvas annotation events. */
export type AnnotationNormalizedEvent = AnnotationEvent<
  AnnotationNormalizedData,
  "normalized"
>;

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
  created: AnnotationNormalizedEvent;
  createdWithDetail: AnnotationCreatedWithDetailEvent;
  selected: AnnotationNormalizedEvent;
  selectedWithDetail: AnnotationSelectedWithDetailEvent;
  deleted: AnnotationNormalizedEvent;
  deletedWithDetail: AnnotationDeletedWithDetailEvent;
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
