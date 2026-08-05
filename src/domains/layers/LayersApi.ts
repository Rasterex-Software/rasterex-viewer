import { createCommandTimeoutError } from "../../errors.js";
import type {
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../../messaging/CanvasMessageBroker.js";
import { createRequestId } from "../../utils/createRequestId.js";
import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import {
  createCanvasCommandError,
  requireReadyBroker
} from "../canvas/canvasBrokerCommands.js";
import type {
  GetLayersOptions,
  LayersApiOptions,
  LayersEventHandler,
  LayersEventMap,
  LayersEventName,
  LayersEventUnsubscribe,
  LayersSnapshot,
  SetLayerVisibilityOptions
} from "./types.js";
export type * from "./types.js";

export class LayersApi {
  private readonly options: LayersApiOptions;
  private readonly events = new DomainEventEmitter<LayersEventMap>();
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];

  constructor(options: LayersApiOptions) {
    this.options = options;
  }

  on<TEventName extends LayersEventName>(
    eventName: TEventName,
    handler: LayersEventHandler<TEventName>
  ): LayersEventUnsubscribe {
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
      broker.on<LayersSnapshot>("layersSnapshot", (message) => {
        if (isLayersSnapshot(message.payload)) {
          this.events.emit("snapshot", message.payload);
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

  getLayers(options: GetLayersOptions = {}): Promise<LayersSnapshot> {
    const requestId = options.requestId ?? createRequestId();

    return this.sendAndWaitForSnapshot(
      "getLayers",
      { requestId },
      requestId,
      options.timeoutMs
    );
  }

  setVisibility(options: SetLayerVisibilityOptions): Promise<LayersSnapshot> {
    this.validateSetVisibilityOptions(options);
    const requestId = options.requestId ?? createRequestId();
    const { timeoutMs, ...payloadOptions } = options;

    return this.sendAndWaitForSnapshot(
      "setLayerVisibility",
      {
        ...payloadOptions,
        requestId
      },
      requestId,
      timeoutMs
    );
  }

  setLayerVisibility(options: SetLayerVisibilityOptions): Promise<LayersSnapshot> {
    return this.setVisibility(options);
  }

  private sendAndWaitForSnapshot(
    type: "getLayers" | "setLayerVisibility",
    payload: Record<string, unknown>,
    requestId: string,
    timeoutMs = this.options.commandTimeoutMs
  ): Promise<LayersSnapshot> {
    const broker = requireReadyBroker({
      ...this.options,
      type,
      apiName: "viewer.layers"
    });

    return new Promise<LayersSnapshot>((resolve, reject) => {
      const cleanup = broker.on<LayersSnapshot>("layersSnapshot", (message) => {
        const snapshot = message.payload;

        if (!isLayersSnapshot(snapshot) || snapshot.requestId !== requestId) {
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

  private validateSetVisibilityOptions(options: SetLayerVisibilityOptions): void {
    if (!options || typeof options !== "object") {
      throw createCanvasCommandError(
        "setLayerVisibility",
        "Layer visibility options must be an object.",
        { options }
      );
    }

    if (typeof options.visible !== "boolean") {
      throw createCanvasCommandError(
        "setLayerVisibility",
        "Layer visibility requires a boolean visible value.",
        { options }
      );
    }

    const selectorCount = [
      options.index !== undefined,
      options.indexes !== undefined,
      options.id !== undefined,
      options.ids !== undefined,
      options.name !== undefined,
      options.names !== undefined,
      options.all === true
    ].filter(Boolean).length;

    if (selectorCount !== 1) {
      throw createCanvasCommandError(
        "setLayerVisibility",
        "Layer visibility requires exactly one selector: index, indexes, id, ids, name, names, or all.",
        { options }
      );
    }

    this.validateNumber("index", options.index, options);
    this.validateNumberArray("indexes", options.indexes, options);
    this.validateId("id", options.id, options);
    this.validateIdArray("ids", options.ids, options);
    this.validateText("name", options.name, options);
    this.validateTextArray("names", options.names, options);
  }

  private validateNumber(
    fieldName: "index",
    value: number | undefined,
    options: SetLayerVisibilityOptions
  ): void {
    if (value === undefined) return;

    if (!Number.isInteger(value) || value < 0) {
      throw createCanvasCommandError(
        "setLayerVisibility",
        `${fieldName} must be a non-negative integer.`,
        { options }
      );
    }
  }

  private validateNumberArray(
    fieldName: "indexes",
    value: number[] | undefined,
    options: SetLayerVisibilityOptions
  ): void {
    if (value === undefined) return;

    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every((item) => Number.isInteger(item) && item >= 0)
    ) {
      throw createCanvasCommandError(
        "setLayerVisibility",
        `${fieldName} must be a non-empty array of non-negative integers.`,
        { options }
      );
    }
  }

  private validateId(
    fieldName: "id",
    value: string | number | undefined,
    options: SetLayerVisibilityOptions
  ): void {
    if (value === undefined) return;

    if (!isValidId(value)) {
      throw createCanvasCommandError(
        "setLayerVisibility",
        `${fieldName} must be a non-empty string or a finite number.`,
        { options }
      );
    }
  }

  private validateIdArray(
    fieldName: "ids",
    value: Array<string | number> | undefined,
    options: SetLayerVisibilityOptions
  ): void {
    if (value === undefined) return;

    if (!Array.isArray(value) || value.length === 0 || !value.every(isValidId)) {
      throw createCanvasCommandError(
        "setLayerVisibility",
        `${fieldName} must be a non-empty array of non-empty strings or finite numbers.`,
        { options }
      );
    }
  }

  private validateText(
    fieldName: "name",
    value: string | undefined,
    options: SetLayerVisibilityOptions
  ): void {
    if (value === undefined) return;

    if (value.trim().length === 0) {
      throw createCanvasCommandError(
        "setLayerVisibility",
        `${fieldName} must not be empty.`,
        { options }
      );
    }
  }

  private validateTextArray(
    fieldName: "names",
    value: string[] | undefined,
    options: SetLayerVisibilityOptions
  ): void {
    if (value === undefined) return;

    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every((item) => item.trim().length > 0)
    ) {
      throw createCanvasCommandError(
        "setLayerVisibility",
        `${fieldName} must be a non-empty array of non-empty strings.`,
        { options }
      );
    }
  }
}

function isLayersSnapshot(payload: LayersSnapshot | undefined): payload is LayersSnapshot {
  return !!payload && typeof payload === "object" && Array.isArray(payload.layers);
}

function isValidId(value: string | number): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return value.trim().length > 0;
}
