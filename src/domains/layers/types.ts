import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  DomainEventHandler,
  DomainEventUnsubscribe
} from "../../utils/DomainEventEmitter.js";

export type LayerKind = "vector" | "pdf";

export interface LayerDetails {
  state?: number;
  defaultstate?: number;
  isplottable?: number;
  [key: string]: unknown;
}

export interface LayerItem {
  index?: number;
  id?: string | number;
  name?: string;
  color?: string;
  visible: boolean;
  kind: LayerKind;
  details?: LayerDetails;
  [key: string]: unknown;
}

export interface LayersSnapshot {
  requestId?: string;
  fileId?: string;
  fileIndex?: number;
  fileName?: string;
  layers: LayerItem[];
  [key: string]: unknown;
}

export interface GetLayersOptions {
  requestId?: string;
  timeoutMs?: number;
}

export interface SetLayerVisibilityOptions {
  requestId?: string;
  index?: number;
  indexes?: number[];
  id?: string | number;
  ids?: Array<string | number>;
  name?: string;
  names?: string[];
  all?: boolean;
  visible: boolean;
  timeoutMs?: number;
}

export interface LayersEventMap {
  snapshot: LayersSnapshot;
}

export type LayersEventName = keyof LayersEventMap;
export type LayersEventHandler<TEventName extends LayersEventName> =
  DomainEventHandler<LayersEventMap[TEventName]>;
export type LayersEventUnsubscribe = DomainEventUnsubscribe;

export interface LayersApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}
