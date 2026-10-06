import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type { DomainEventHandler, DomainEventUnsubscribe } from "../../utils/DomainEventEmitter.js";

export type ViewSyncMode = "off" | "pan" | "zoom" | "panAndZoom";

export interface ViewSyncConfiguration {
  groupId: string;
  instanceId: string;
  mode: ViewSyncMode;
  enabled?: boolean;
  timeoutMs?: number;
}

export interface ViewSyncConfigured {
  success: boolean;
  enabled?: boolean;
  groupId?: string;
  instanceId?: string;
  mode?: ViewSyncMode;
  requestId: string;
  reason?: string;
  error?: string;
}

export interface ViewSyncSnapshot {
  success: true;
  groupId: string;
  sourceInstanceId: string;
  zoomScale: number;
  offset: { x: number; y: number };
  page: number;
  requestId: string;
}

export interface ViewSyncSnapshotRequest {
  groupId: string;
  timeoutMs?: number;
}

export interface ViewSyncSnapshotApplyOptions {
  timeoutMs?: number;
}

export interface ViewSyncSnapshotApplied extends ViewSyncSnapshot {}

export interface ViewSyncChange {
  groupId: string;
  sourceInstanceId: string;
  sequence: number;
  page?: number;
  fileId?: string | number;
  fileIndex?: number;
  state: {
    pan?: { sx: number; sy: number; pagerect?: unknown; coordinateMode?: "delta" | "absolute" };
    zoom?: { zoomparams: Record<string, unknown>; type: number };
  };
}

export interface ViewSyncApplyOptions {
  pan?: boolean;
  zoom?: boolean;
}

export interface ViewSyncApplied {
  success: true;
  groupId: string;
  sourceInstanceId: string;
  sequence: number;
  requestId?: string;
}

export interface ViewSyncFailed {
  success: false;
  reason: "invalid_payload" | "apply_failed" | string;
  groupId?: string;
  sequence?: number;
  requestId?: string;
}

export interface ViewSyncEventMap {
  changed: ViewSyncChange;
  applied: ViewSyncApplied;
  failed: ViewSyncFailed;
}

export type ViewSyncEventName = keyof ViewSyncEventMap;
export type ViewSyncEventHandler<TName extends ViewSyncEventName> =
  DomainEventHandler<ViewSyncEventMap[TName]>;
export type ViewSyncEventUnsubscribe = DomainEventUnsubscribe;

export interface ViewSyncApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}
