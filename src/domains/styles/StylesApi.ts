import {
  createCapabilityNotSupportedError,
  createCommandTimeoutError,
  createViewerNotReadyError
} from "../../errors.js";
import { createRequestId } from "../../utils/createRequestId.js";
import {
  createCanvasCommandError,
  requireReadyBroker,
  sendCanvasFireAndForget
} from "../canvas/canvasBrokerCommands.js";
import type {
  AnnotationPropertiesResult,
  GetAnnotationPropertiesOptions,
  GlobalAppearanceOptions,
  MeasurementAppearanceResult,
  SetMeasurementAppearanceOptions,
  SetAnnotationPropertiesOptions,
  StylesApiOptions
} from "./types.js";
export type * from "./types.js";

export class StylesApi {
  private readonly options: StylesApiOptions;
  private readonly pendingAppearance = new Map<string, (error: Error) => void>();

  constructor(options: StylesApiOptions) {
    this.options = options;
  }

  /** Switches the Canvas presentation preset. Fresh viewers default to Legacy. */
  async setMeasurementAppearance(
    options: SetMeasurementAppearanceOptions
  ): Promise<MeasurementAppearanceResult> {
    const type = "setMeasurementAppearance";
    const broker = requireReadyBroker({ ...this.options, type, apiName: "viewer.styles" });
    const invalid = (message: string) => createCanvasCommandError(type, message);
    if (!options || !["legacy", "modern"].includes(options.mode)) {
      throw invalid("Measurement appearance mode must be legacy or modern.");
    }
    const mode = options.mode;
    if (options.requestId !== undefined && (typeof options.requestId !== "string" ||
        !options.requestId.trim() || options.requestId.length > 256)) {
      throw invalid("Measurement appearance requestId must be a nonempty string of at most 256 characters.");
    }
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
      throw invalid("Measurement appearance timeoutMs must be a positive timer-safe integer.");
    }
    if (!this.options.getCapabilities?.()?.includes("measurementAppearance")) {
      throw createCapabilityNotSupportedError("measurementAppearance");
    }
    const requestId = options.requestId ?? createRequestId();
    if (this.pendingAppearance.has(requestId)) {
      throw invalid("A measurement appearance request with this requestId is already pending.");
    }

    return new Promise<MeasurementAppearanceResult>((resolve, reject) => {
      let settled = false;
      let unsubscribe = () => {};
      let timeoutId: ReturnType<typeof globalThis.setTimeout>;
      const cleanup = () => {
        settled = true;
        globalThis.clearTimeout(timeoutId);
        unsubscribe();
        this.pendingAppearance.delete(requestId);
      };
      const fail = (error: Error) => {
        if (settled) return;
        cleanup();
        reject(error);
      };
      unsubscribe = broker.on<MeasurementAppearanceResult>("measurementAppearanceChanged", ({ payload }) => {
        if (!payload || payload.requestId !== requestId || settled) return;
        const commandError = (message: string) => createCanvasCommandError(type, message, {
          requestId, result: payload
        });
        if (payload.success === false) {
          fail(commandError(typeof payload.error === "string" ? payload.error : "Canvas could not change measurement appearance."));
          return;
        }
        if (payload.success !== true || payload.mode !== mode ||
            (payload.error !== undefined && typeof payload.error !== "string")) {
          fail(commandError("Canvas returned an invalid measurement appearance result."));
          return;
        }
        cleanup();
        resolve(payload);
      });
      timeoutId = globalThis.setTimeout(() => {
        fail(createCommandTimeoutError(requestId, type, timeoutMs));
      }, timeoutMs);
      this.pendingAppearance.set(requestId, fail);
      try { broker.send(type, { mode, requestId }); }
      catch (error) {
        fail(createCanvasCommandError(type, "Measurement appearance command could not be sent.", {
          requestId, cause: error instanceof Error ? error.message : String(error)
        }));
      }
    });
  }

  disconnect(): void {
    for (const cancel of this.pendingAppearance.values()) {
      cancel(createViewerNotReadyError("Viewer disconnected before measurement appearance completed."));
    }
  }

  setGlobalAppearance(options: GlobalAppearanceOptions): void {
    sendCanvasFireAndForget({
      ...this.options,
      type: "setGlobalAppearance",
      payload: options,
      apiName: "viewer.styles"
    });
  }

  getAnnotationProperties(
    options: GetAnnotationPropertiesOptions
  ): Promise<AnnotationPropertiesResult> {
    const broker = requireReadyBroker({
      ...this.options,
      type: "getAnnotationProperties",
      apiName: "viewer.styles"
    });
    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;

    return new Promise<AnnotationPropertiesResult>((resolve, reject) => {
      const cleanup = broker.on<AnnotationPropertiesResult>(
        "annotationProperties",
        (message) => {
          const payload = message.payload;

          if (!payload || payload.guid !== options.guid) {
            return;
          }

          globalThis.clearTimeout(timeoutId);
          cleanup();
          resolve(payload);
        }
      );

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(createCommandTimeoutError(options.guid, "getAnnotationProperties", timeoutMs));
      }, timeoutMs);

      broker.send("getAnnotationProperties", {
        guid: options.guid
      });
    });
  }

  setAnnotationProperties(options: SetAnnotationPropertiesOptions): void {
    sendCanvasFireAndForget({
      ...this.options,
      type: "setAnnotationProperties",
      payload: {
        guid: options.guid,
        props: options.props
      },
      apiName: "viewer.styles"
    });
  }
}
