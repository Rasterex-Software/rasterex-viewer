import type { AnnotationDataItem, AnnotationEventData } from "./types.js";

export interface CanvasAnnotationPayload {
  guid?: unknown;
  data?: AnnotationEventData;
  dbUniqueID?: unknown;
}

export interface CanvasGetAnnotationDataPayload {
  filter?: string;
  requestId?: string;
  items?: AnnotationDataItem[];
  count?: number;
}

export interface CanvasAnnotationVisibilityPayload {
  success?: boolean;
  visible?: boolean;
  annotationIds?: string[];
  updatedCount?: number;
  missingAnnotationIds?: string[];
  requestId?: string;
  error?: string;
}

export interface CanvasSaveAnnotationsCompletePayload {
  success?: boolean;
  requestId?: string;
  error?: string;
}
