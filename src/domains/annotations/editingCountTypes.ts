export type { ParentCommandOptions } from "../canvas/ParentCommands.js";

export interface ParentToolStateResult {
  success: true;
  requestId: string;
  tools: Readonly<Record<string, boolean>>;
  navigation: Readonly<Record<string, boolean>>;
}

export type AnnotationEditAction = "undo" | "redo" | "deleteSelected";

export interface AnnotationEditResult extends ParentToolStateResult {
  action: AnnotationEditAction;
}

export interface CountConfiguration {
  visibility: "always" | "selected" | "hidden";
  content: "value" | "name" | "nameValue";
  name?: string;
  markerName?: string;
  numbered?: boolean;
  symbol?: string;
}

export type CountItemInfo = Record<string, string | number | boolean | null>;

export interface CountItem {
  id: string;
  index: number;
  point: { x: number; y: number };
  info: CountItemInfo;
}

export interface CountItemsResult extends ParentToolStateResult {
  guid: string;
  coordinateSpace: "nativeAnnotation";
  items: CountItem[];
}

export interface CountInsertPointResult {
  success: true;
  requestId: string;
  markupNumber?: number;
  uniqueId?: string;
}

export interface CountPointModeResult extends CountInsertPointResult {
  enabled: boolean;
}

export interface CountFinishedEvent {
  success: true;
}
