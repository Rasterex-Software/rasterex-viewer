import { createCommandTimeoutError } from "../errors.js";
import type {
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../messaging/CanvasMessageBroker.js";
import { createRequestId } from "../utils/createRequestId.js";
import {
  DomainEventEmitter,
  type DomainEventHandler,
  type DomainEventUnsubscribe
} from "../utils/DomainEventEmitter.js";
import {
  createCanvasCommandError,
  requireReadyBroker,
  sendCanvasFireAndForget
} from "./canvasBrokerCommands.js";

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

export class BlocksApi {
  private readonly options: BlocksApiOptions;
  private readonly events = new DomainEventEmitter<BlocksEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];

  constructor(options: BlocksApiOptions) {
    this.options = options;
  }

  on<TEventName extends BlocksEventName>(
    eventName: TEventName,
    handler: BlocksEventHandler<TEventName>
  ): BlocksEventUnsubscribe {
    this.connect();
    return this.events.on(eventName, handler);
  }

  connect(): void {
    const broker = this.options.getBroker();

    if (!broker || broker === this.broker) {
      return;
    }

    this.disconnect();
    this.broker = broker;
    this.brokerCleanups = [
      broker.on<BlocksSnapshot>("blocksSnapshot", (message) => {
        if (isBlocksSnapshot(message.payload)) {
          this.events.emit("snapshot", message.payload);
        }
      }),
      broker.on<BlockDetailsSnapshot>("blockDetailsSnapshot", (message) => {
        if (isBlockDetailsSnapshot(message.payload)) {
          this.events.emit("detailsSnapshot", message.payload);
        }
      }),
      broker.on<BlockAttributesSnapshot>("blockAttributesSnapshot", (message) => {
        if (isBlockDetailsSnapshot(message.payload)) {
          this.events.emit("attributesSnapshot", message.payload);
        }
      })
    ];
  }

  disconnect(): void {
    for (const cleanup of this.brokerCleanups) {
      cleanup();
    }

    this.brokerCleanups = [];
    this.broker = null;
  }

  getBlocks(options: GetBlocksOptions = {}): Promise<BlocksSnapshot> {
    const requestId = options.requestId ?? createRequestId();

    return this.sendAndWaitForSnapshot(
      "getBlocks",
      "blocksSnapshot",
      { requestId },
      requestId,
      isBlocksSnapshot,
      options.timeoutMs
    );
  }

  getDetails(options: GetBlockDetailsOptions): Promise<BlockDetailsSnapshot> {
    this.validateIndexSelector("getBlockDetails", options);
    const requestId = options.requestId ?? createRequestId();
    const { timeoutMs, ...payloadOptions } = options;

    return this.sendAndWaitForSnapshot(
      "getBlockDetails",
      "blockDetailsSnapshot",
      {
        ...payloadOptions,
        requestId
      },
      requestId,
      isBlockDetailsSnapshot,
      timeoutMs
    );
  }

  getBlockDetails(options: GetBlockDetailsOptions): Promise<BlockDetailsSnapshot> {
    return this.getDetails(options);
  }

  getAttributes(options: GetBlockAttributesOptions): Promise<BlockAttributesSnapshot> {
    this.validateIndexSelector("getBlockAttributes", options);
    const requestId = options.requestId ?? createRequestId();
    const { timeoutMs, ...payloadOptions } = options;

    return this.sendAndWaitForSnapshot(
      "getBlockAttributes",
      "blockAttributesSnapshot",
      {
        ...payloadOptions,
        requestId
      },
      requestId,
      isBlockDetailsSnapshot,
      timeoutMs
    );
  }

  getBlockAttributes(
    options: GetBlockAttributesOptions
  ): Promise<BlockAttributesSnapshot> {
    return this.getAttributes(options);
  }

  setVisibility(options: SetBlockVisibilityOptions): void {
    this.validateSetVisibilityOptions(options);

    sendCanvasFireAndForget({
      ...this.options,
      type: "setBlockVisibility",
      payload: {
        ...options,
        requestId: options.requestId ?? createRequestId()
      },
      apiName: "viewer.blocks"
    });
  }

  setBlockVisibility(options: SetBlockVisibilityOptions): void {
    this.setVisibility(options);
  }

  private sendAndWaitForSnapshot<TSnapshot extends { requestId?: string }>(
    type: "getBlocks" | "getBlockDetails" | "getBlockAttributes",
    resultType: "blocksSnapshot" | "blockDetailsSnapshot" | "blockAttributesSnapshot",
    payload: Record<string, unknown>,
    requestId: string,
    isSnapshot: (payload: TSnapshot | undefined) => payload is TSnapshot,
    timeoutMs = this.options.commandTimeoutMs
  ): Promise<TSnapshot> {
    const broker = requireReadyBroker({
      ...this.options,
      type,
      apiName: "viewer.blocks"
    });

    return new Promise<TSnapshot>((resolve, reject) => {
      const cleanup = broker.on<TSnapshot>(resultType, (message) => {
        const snapshot = message.payload;

        if (!isSnapshot(snapshot) || snapshot.requestId !== requestId) {
          return;
        }

        globalThis.clearTimeout(timeoutId);
        cleanup();
        resolve(snapshot);
      });

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(createCommandTimeoutError(requestId, type, timeoutMs));
      }, timeoutMs);

      broker.send(type, payload);
    });
  }

  private validateIndexSelector(
    type: "getBlockDetails" | "getBlockAttributes",
    options: GetBlockDetailsOptions | GetBlockAttributesOptions
  ): void {
    if (!options || typeof options !== "object") {
      throw createCanvasCommandError(type, "Block request options must be an object.", {
        options
      });
    }

    const selectorCount = [
      options.index !== undefined,
      options.indexes !== undefined
    ].filter(Boolean).length;

    if (selectorCount !== 1) {
      throw createCanvasCommandError(
        type,
        "Block details and attribute requests require exactly one selector: index or indexes.",
        { options }
      );
    }

    this.validateNumber(type, "index", options.index, options);
    this.validateNumberArray(type, "indexes", options.indexes, options);
  }

  private validateSetVisibilityOptions(options: SetBlockVisibilityOptions): void {
    if (!options || typeof options !== "object") {
      throw createCanvasCommandError(
        "setBlockVisibility",
        "Block visibility options must be an object.",
        { options }
      );
    }

    if (typeof options.visible !== "boolean") {
      throw createCanvasCommandError(
        "setBlockVisibility",
        "Block visibility requires a boolean visible value.",
        { options }
      );
    }

    const selectorCount = [
      options.index !== undefined,
      options.indexes !== undefined,
      options.name !== undefined,
      options.names !== undefined,
      options.all === true
    ].filter(Boolean).length;

    if (selectorCount !== 1) {
      throw createCanvasCommandError(
        "setBlockVisibility",
        "Block visibility requires exactly one selector: index, indexes, name, names, or all.",
        { options }
      );
    }

    this.validateNumber("setBlockVisibility", "index", options.index, options);
    this.validateNumberArray("setBlockVisibility", "indexes", options.indexes, options);
    this.validateText("name", options.name, options);
    this.validateTextArray("names", options.names, options);
  }

  private validateNumber(
    type: string,
    fieldName: "index",
    value: number | undefined,
    options: unknown
  ): void {
    if (value === undefined) return;

    if (!Number.isInteger(value) || value < 0) {
      throw createCanvasCommandError(
        type,
        `${fieldName} must be a non-negative integer.`,
        { options }
      );
    }
  }

  private validateNumberArray(
    type: string,
    fieldName: "indexes",
    value: number[] | undefined,
    options: unknown
  ): void {
    if (value === undefined) return;

    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every((item) => Number.isInteger(item) && item >= 0)
    ) {
      throw createCanvasCommandError(
        type,
        `${fieldName} must be a non-empty array of non-negative integers.`,
        { options }
      );
    }
  }

  private validateText(
    fieldName: "name",
    value: string | undefined,
    options: SetBlockVisibilityOptions
  ): void {
    if (value === undefined) return;

    if (value.trim().length === 0) {
      throw createCanvasCommandError(
        "setBlockVisibility",
        `${fieldName} must not be empty.`,
        { options }
      );
    }
  }

  private validateTextArray(
    fieldName: "names",
    value: string[] | undefined,
    options: SetBlockVisibilityOptions
  ): void {
    if (value === undefined) return;

    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every((item) => item.trim().length > 0)
    ) {
      throw createCanvasCommandError(
        "setBlockVisibility",
        `${fieldName} must be a non-empty array of non-empty strings.`,
        { options }
      );
    }
  }
}

function isBlocksSnapshot(payload: BlocksSnapshot | undefined): payload is BlocksSnapshot {
  return !!payload && typeof payload === "object" && Array.isArray(payload.blocks);
}

function isBlockDetailsSnapshot(
  payload: BlockDetailsSnapshot | undefined
): payload is BlockDetailsSnapshot {
  return !!payload && typeof payload === "object" && Array.isArray(payload.blocks);
}
