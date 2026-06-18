import { ERROR_CODES } from "@rasterex/viewer-protocol";

import {
  createCommandTimeoutError,
  createViewerNotReadyError,
  RasterexViewerError
} from "../errors.js";
import type {
  CanvasMessage,
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../messaging/CanvasMessageBroker.js";
import {
  DomainEventEmitter,
  type DomainEventHandler,
  type DomainEventUnsubscribe
} from "../utils/DomainEventEmitter.js";
import { createRequestId } from "../utils/createRequestId.js";

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
  requestId?: string;
  items: AnnotationDataItem[];
}

export interface SelectAnnotationOptions {
  uniqueId?: string;
  guid?: string;
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

interface CanvasAnnotationPayload {
  guid?: unknown;
  data?: AnnotationEventData;
  dbUniqueID?: unknown;
}

interface CanvasGetAnnotationDataPayload {
  filter?: string;
  requestId?: string;
  items?: AnnotationDataItem[];
}

export class AnnotationsApi {
  private readonly getBroker: () => CanvasMessageBroker | null;
  private readonly getIsReady: () => boolean;
  private readonly commandTimeoutMs: number;
  private readonly events = new DomainEventEmitter<AnnotationEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];

  constructor(options: AnnotationsApiOptions) {
    this.getBroker = options.getBroker;
    this.getIsReady = options.getIsReady;
    this.commandTimeoutMs = options.commandTimeoutMs;
  }

  connect(): void {
    const broker = this.getBroker();

    if (!broker || broker === this.broker) {
      return;
    }

    this.disconnect();
    this.broker = broker;
    this.brokerCleanups = [
      broker.on<CanvasAnnotationPayload>("annotationCreated", (message) => {
        this.emitAnnotation("created", message, "normalized");
      }),
      broker.on<CanvasAnnotationPayload>("annotationCreatedWithDetail", (message) => {
        this.emitAnnotation("createdWithDetail", message, "raw");
      }),
      broker.on<CanvasAnnotationPayload>("annotationSelected", (message) => {
        this.emitAnnotation("selected", message, "normalized");
      }),
      broker.on<CanvasAnnotationPayload>("annotationSelectedWithDetail", (message) => {
        this.emitAnnotation("selectedWithDetail", message, "raw");
      }),
      broker.on<CanvasAnnotationPayload>("annotationDeleted", (message) => {
        this.emitAnnotation("deleted", message, "normalized");
      }),
      broker.on<CanvasAnnotationPayload>("annotationDeletedWithDetail", (message) => {
        this.emitAnnotation("deletedWithDetail", message, "raw");
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

  on<TEventName extends AnnotationEventName>(
    eventName: TEventName,
    handler: AnnotationEventHandler<TEventName>
  ): AnnotationEventUnsubscribe {
    this.connect();
    return this.events.on(eventName, handler);
  }

  select(options: SelectAnnotationOptions): void {
    const broker = this.requireReadyBroker("selectAnnotation");
    broker.send("selectAnnotation", {
      uniqueId: options.uniqueId,
      guid: options.guid
    });
  }

  unselect(): void {
    const broker = this.requireReadyBroker("unselectAnnotation");
    broker.send("unselectAnnotation");
  }

  getData(options: GetAnnotationDataOptions = {}): Promise<GetAnnotationDataResult> {
    const broker = this.requireReadyBroker("getAnnotationData");
    const requestId = options.requestId ?? createRequestId();
    const timeoutMs = options.timeoutMs ?? this.commandTimeoutMs;

    return new Promise<GetAnnotationDataResult>((resolve, reject) => {
      const cleanup = broker.on<CanvasGetAnnotationDataPayload>(
        "getAnnotationData",
        (message) => {
          const payload = message.payload;

          if (!payload || payload.requestId !== requestId) {
            return;
          }

          globalThis.clearTimeout(timeoutId);
          cleanup();

          if (!Array.isArray(payload.items)) {
            reject(
              createAnnotationError(
                "getAnnotationData",
                "Canvas returned invalid annotation data.",
                {
                  requestId,
                  payload
                }
              )
            );
            return;
          }

          resolve({
            filter: payload.filter ?? "all",
            requestId: payload.requestId,
            items: payload.items
          });
        }
      );

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(createCommandTimeoutError(requestId, "getAnnotationData", timeoutMs));
      }, timeoutMs);

      broker.send("getAnnotationData", {
        filter: options.filter,
        requestId
      });
    });
  }

  private emitAnnotation(
    eventName: AnnotationEventName,
    message: CanvasMessage<CanvasAnnotationPayload>,
    detail: AnnotationEvent["detail"]
  ): void {
    const payload = message.payload;

    if (!payload || typeof payload.guid !== "string") {
      return;
    }

    this.events.emit(eventName, {
      guid: payload.guid,
      data: payload.data ?? {},
      dbUniqueID: payload.dbUniqueID ?? null,
      source: "current-canvas",
      detail
    });
  }

  private requireReadyBroker(type: string): CanvasMessageBroker {
    if (!this.getIsReady()) {
      throw createViewerNotReadyError(
        "RasterexViewer must be ready before using viewer.annotations.",
        {
          type
        }
      );
    }

    const broker = this.getBroker();

    if (!broker) {
      throw createViewerNotReadyError(
        "Rasterex Canvas message broker is not available.",
        {
          type
        }
      );
    }

    this.connect();
    return broker;
  }
}

function createAnnotationError(
  type: string,
  message: string,
  context?: Record<string, unknown>
): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.unknownCommand,
    message,
    context: {
      type,
      ...context
    }
  });
}
