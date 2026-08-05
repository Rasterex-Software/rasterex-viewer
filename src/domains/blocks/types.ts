import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  DomainEventHandler,
  DomainEventUnsubscribe
} from "../../utils/DomainEventEmitter.js";

export interface BlockItem {
  index?: number;
  name?: string;
  visible: boolean;
  selected?: boolean;
  hasAttribute?: boolean;
  [key: string]: unknown;
}

export interface BlockAttribute {
  name: string;
  value: unknown;
  blockref?: number;
  [key: string]: unknown;
}

export interface BlockBounds {
  minX?: number;
  minY?: number;
  maxX?: number;
  maxY?: number;
  width?: number;
  height?: number;
  area?: number;
  [key: string]: unknown;
}

export interface BlockInsertDetails {
  blockhandleLow?: number;
  blockhandleHigh?: number;
  insertX?: number;
  insertY?: number;
  insertZ?: number;
  insertRot?: number;
  insertscaleX?: number;
  insertscaleY?: number;
  insertscaleZ?: number;
  blockref?: number;
  MinX?: number;
  MinY?: number;
  MaxX?: number;
  MaxY?: number;
  type?: string;
  [key: string]: unknown;
}

export interface BlockDetails {
  index?: number;
  name?: string;
  state?: number;
  defaultstate?: number;
  defaultcolor?: string | null;
  color?: string | null;
  fillstyle?: string | null;
  defaultfillstyle?: string | null;
  overridecolor?: boolean;
  overridefill?: boolean;
  hatchstyle?: string | null;
  selected?: boolean;
  listed?: boolean;
  insert?: BlockInsertDetails;
  drawn?: boolean;
  mouseon?: boolean;
  hasAttribute?: boolean;
  fold?: number;
  bounds?: BlockBounds;
  [key: string]: unknown;
}

export interface BlockDetailsItem {
  index?: number;
  name?: string;
  visible?: boolean;
  selected?: boolean;
  hasAttribute?: boolean;
  details?: BlockDetails;
  attributes?: BlockAttribute[];
  [key: string]: unknown;
}

export interface BlocksSnapshot {
  requestId?: string;
  fileId?: string;
  fileIndex?: number;
  fileName?: string;
  blocks: BlockItem[];
  [key: string]: unknown;
}

export interface BlockDetailsSnapshot {
  requestId?: string;
  fileId?: string;
  fileIndex?: number;
  fileName?: string;
  blocks: BlockDetailsItem[];
  [key: string]: unknown;
}

export type BlockAttributesSnapshot = BlockDetailsSnapshot;

export interface GetBlocksOptions {
  requestId?: string;
  timeoutMs?: number;
}

export interface GetBlockDetailsOptions {
  requestId?: string;
  index?: number;
  indexes?: number[];
  timeoutMs?: number;
}

export type GetBlockAttributesOptions = GetBlockDetailsOptions;

export interface SetBlockVisibilityOptions {
  requestId?: string;
  index?: number;
  indexes?: number[];
  name?: string;
  names?: string[];
  all?: boolean;
  visible: boolean;
}

export interface BlocksEventMap {
  snapshot: BlocksSnapshot;
  detailsSnapshot: BlockDetailsSnapshot;
  attributesSnapshot: BlockAttributesSnapshot;
}

export type BlocksEventName = keyof BlocksEventMap;
export type BlocksEventHandler<TEventName extends BlocksEventName> =
  DomainEventHandler<BlocksEventMap[TEventName]>;
export type BlocksEventUnsubscribe = DomainEventUnsubscribe;

export interface BlocksApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}
