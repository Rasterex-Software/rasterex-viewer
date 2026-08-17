import { ERROR_CODES } from "../../protocol/index.js";

import {
  createCommandTimeoutError,
  RasterexViewerError
} from "../../errors.js";
import type {
  CanvasMessage,
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../../messaging/CanvasMessageBroker.js";
import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import { createRequestId } from "../../utils/createRequestId.js";
import { requireReadyBroker as requireCanvasReadyBroker } from "../canvas/canvasBrokerCommands.js";
import type {
  AnnotationEvent,
  AnnotationEventHandler,
  AnnotationEventMap,
  AnnotationEventName,
  AnnotationEventUnsubscribe,
  AnnotationsApiOptions,
  AnnotationVisibilityOptions,
  AnnotationVisibilityResult,
  AnnotationVisibilityTargetOptions,
  AutoSaveOptions,
  CountPointModeOptions,
  DeleteAnnotationOptions,
  GetAnnotationDataOptions,
  GetAnnotationDataResult,
  SaveAnnotationsOptions,
  SaveAnnotationsResult,
  SelectAnnotationOptions
} from "./types.js";
import type {
  CanvasAnnotationPayload,
  CanvasAnnotationVisibilityPayload,
  CanvasGetAnnotationDataPayload,
  CanvasSaveAnnotationsCompletePayload
} from "./internalTypes.js";
export type * from "./types.js";

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

  delete(options: DeleteAnnotationOptions): void {
    const broker = this.requireReadyBroker("deleteAnnotation");
    broker.send("deleteAnnotation", {
      uniqueId: options.uniqueId ?? options.guid
    });
  }

  setCountPointMode(options: CountPointModeOptions): void {
    const broker = this.requireReadyBroker("insertCountPointMode");
    broker.send("insertCountPointMode", {
      enabled: options.enabled,
      guid: options.guid,
      requestId: options.requestId ?? createRequestId()
    });
  }

  save(options: SaveAnnotationsOptions = {}): Promise<SaveAnnotationsResult> {
    const broker = this.requireReadyBroker("saveAnnotations");
    const requestId = options.requestId ?? createRequestId();
    const timeoutMs = options.timeoutMs ?? this.commandTimeoutMs;

    return new Promise<SaveAnnotationsResult>((resolve, reject) => {
      const cleanup = broker.on<CanvasSaveAnnotationsCompletePayload>(
        "saveAnnotationsComplete",
        (message) => {
          const payload = message.payload;

          if (!payload || payload.requestId !== requestId) {
            return;
          }

          globalThis.clearTimeout(timeoutId);
          cleanup();

          if (typeof payload.success !== "boolean") {
            reject(
              createAnnotationError(
                "saveAnnotations",
                "Canvas returned invalid annotation save data.",
                {
                  requestId,
                  payload
                }
              )
            );
            return;
          }

          if (payload.success === false) {
            reject(
              createAnnotationError(
                "saveAnnotations",
                payload.error ?? "Canvas annotation save failed.",
                {
                  requestId,
                  payload
                }
              )
            );
            return;
          }

          resolve({
            success: payload.success,
            requestId: payload.requestId,
            error: payload.error
          });
        }
      );

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(createCommandTimeoutError(requestId, "saveAnnotations", timeoutMs));
      }, timeoutMs);

      broker.send("saveAnnotations", {
        requestId
      });
    });
  }

  setAutoSave(options: AutoSaveOptions): void {
    const broker = this.requireReadyBroker("setAutoSave");
    broker.send("setAutoSave", {
      enabled: options.enabled
    });
  }

  show(options: AnnotationVisibilityTargetOptions): Promise<AnnotationVisibilityResult> {
    return this.setVisibility({
      ...options,
      visible: true
    });
  }

  hide(options: AnnotationVisibilityTargetOptions): Promise<AnnotationVisibilityResult> {
    return this.setVisibility({
      ...options,
      visible: false
    });
  }

  setVisibility(
    options: AnnotationVisibilityOptions
  ): Promise<AnnotationVisibilityResult> {
    const broker = this.requireReadyBroker("annotationVisibility");
    const requestId = options.requestId ?? createRequestId();
    const timeoutMs = options.timeoutMs ?? this.commandTimeoutMs;

    return new Promise<AnnotationVisibilityResult>((resolve, reject) => {
      const cleanup = broker.on<CanvasAnnotationVisibilityPayload>(
        "annotationVisibilityChanged",
        (message) => {
          const payload = message.payload;

          if (!payload || payload.requestId !== requestId) {
            return;
          }

          globalThis.clearTimeout(timeoutId);
          cleanup();

          if (!isAnnotationVisibilityPayload(payload)) {
            reject(
              createAnnotationError(
                "annotationVisibility",
                "Canvas returned invalid annotation visibility data.",
                {
                  requestId,
                  payload
                }
              )
            );
            return;
          }

          resolve({
            success: payload.success,
            visible: payload.visible,
            annotationIds: payload.annotationIds,
            updatedCount: payload.updatedCount,
            missingAnnotationIds: payload.missingAnnotationIds,
            requestId: payload.requestId,
            error: payload.error
          });
        }
      );

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(createCommandTimeoutError(requestId, "annotationVisibility", timeoutMs));
      }, timeoutMs);

      broker.send("annotationVisibility", {
        annotationIds: options.annotationIds,
        visible: options.visible,
        requestId
      });
    });
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
            items: payload.items,
            count: payload.count
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

    const event: AnnotationEvent = {
      guid: payload.guid,
      data: payload.data ?? {},
      dbUniqueID: payload.dbUniqueID ?? null,
      source: "current-canvas",
      detail
    };

    this.events.emit(eventName, event as AnnotationEventMap[typeof eventName]);
  }

  private requireReadyBroker(type: string): CanvasMessageBroker {
    const broker = requireCanvasReadyBroker({
      getBroker: this.getBroker,
      getIsReady: this.getIsReady,
      type,
      apiName: "viewer.annotations"
    });

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

function isAnnotationVisibilityPayload(
  payload: CanvasAnnotationVisibilityPayload
): payload is Required<
  Pick<
    CanvasAnnotationVisibilityPayload,
    "success" | "visible" | "annotationIds" | "updatedCount" | "missingAnnotationIds" | "requestId"
  >
> &
  Pick<CanvasAnnotationVisibilityPayload, "error"> {
  return (
    typeof payload.success === "boolean" &&
    typeof payload.visible === "boolean" &&
    Array.isArray(payload.annotationIds) &&
    typeof payload.updatedCount === "number" &&
    Array.isArray(payload.missingAnnotationIds) &&
    typeof payload.requestId === "string"
  );
}
