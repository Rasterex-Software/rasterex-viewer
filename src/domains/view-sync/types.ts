import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type { DomainEventHandler, DomainEventUnsubscribe } from "../../utils/DomainEventEmitter.js";

export type ViewSyncMode = "off" | "pan" | "zoom" | "panAndZoom";

export interface ViewSyncConfiguration {
  groupId: string;
  instanceId: string;
  mode: ViewSyncMode;
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
}

export interface ViewSyncChange {
  groupId: string;
  sourceInstanceId: string;
  sequence: number;
  page?: number;
  fileId?: string | number;
  fileIndex?: number;
  state: {
    pan?: { sx: number; sy: number; pagerect?: unknown };
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
