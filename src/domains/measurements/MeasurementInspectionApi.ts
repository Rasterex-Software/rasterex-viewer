import {
  createCapabilityNotSupportedError,
  createCommandTimeoutError,
  createViewerNotReadyError
} from "../../errors.js";
import { createRequestId } from "../../utils/createRequestId.js";
import {
  createCanvasCommandError,
  requireReadyBroker
} from "../canvas/canvasBrokerCommands.js";
import type { MeasurementsApiOptions } from "./types.js";
import type {
  GetMeasurementInfoOptions,
  SelectMeasurementVertexOptions,
  MeasurementRequestOptions,
  MeasurementInfoResult,
  MeasurementVertexSelectedResult,
  MeasurementVertexSelectionClearedResult
} from "./inspectionTypes.js";
import {
  isRecord,
  isNonnegativeInteger,
  normalizeGuid,
  isValidInspection,
  isValidSelection
} from "./inspectionValidation.js";
/** Existing Canvas commands only; no native engine or PDF coordinate access. */

export class MeasurementInspectionApi {
  private readonly pending = new Map<string, (error: Error) => void>();

  constructor(private readonly options: MeasurementsApiOptions) {}

  getInfo(options: GetMeasurementInfoOptions): Promise<MeasurementInfoResult> {
    return this.request(
      "getMeasurementInfo",
      "measurementInfo",
      "measurementInfo",
      options,
      "inspect"
    );
  }

  selectVertex(
    options: SelectMeasurementVertexOptions
  ): Promise<MeasurementVertexSelectedResult> {
    return this.request(
      "selectMeasurementVertex",
      "measurementVertexSelected",
      "nativeVertexSelection",
      options,
      "select"
    );
  }

  clearVertexSelection(
    options: MeasurementRequestOptions = {}
  ): Promise<MeasurementVertexSelectionClearedResult> {
    return this.request(
      "clearMeasurementVertexSelection",
      "measurementVertexSelectionCleared",
      "nativeVertexSelection",
      options,
      "clear"
    );
  }

  disconnect(): void {
    for (const cancel of this.pending.values()) {
      cancel(
        createViewerNotReadyError(
          "Viewer disconnected before measurement command completed."
        )
      );
    }
  }

  private async request<T>(
    type: string,
    resultType: string,
    capability: string,
    input: MeasurementRequestOptions | GetMeasurementInfoOptions,
    operation: "inspect" | "select" | "clear"
  ): Promise<T> {
    const broker = requireReadyBroker({
      ...this.options,
      type,
      apiName: "viewer.measurements"
    });
    const invalid = (message: string) => createCanvasCommandError(type, message);

    if (!isRecord(input)) {
      throw invalid("Measurement options must be an object.");
    }
    const requestId = input.requestId ?? createRequestId();
    const timeoutMs = input.timeoutMs ?? this.options.commandTimeoutMs;

    if (
      typeof requestId !== "string" ||
      !requestId.trim() ||
      requestId.length > 256 ||
      typeof timeoutMs !== "number" ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs <= 0 ||
      timeoutMs > 2147483647
    ) {
      throw invalid("Invalid requestId or timeoutMs.");
    }
    const payload: Record<string, unknown> = { requestId };

    if (operation !== "clear") {
      if (
        !isNonnegativeInteger(input.fileIndex) ||
        !isNonnegativeInteger(input.pageIndex) ||
        typeof input.guid !== "string" ||
        !input.guid.trim() ||
        input.guid.length > 128 ||
        !normalizeGuid(input.guid) ||
        (input.vertexIndex !== undefined &&
          (!isNonnegativeInteger(input.vertexIndex) || input.vertexIndex >= 1000)) ||
        (operation === "select" && input.vertexIndex === undefined)
      ) {
        throw invalid("Invalid measurement identity or vertex index.");
      }
      Object.assign(
        payload,
        {
          fileIndex: input.fileIndex,
          pageIndex: input.pageIndex,
          guid: normalizeGuid(input.guid)
        },
        input.vertexIndex === undefined ? {} : { vertexIndex: input.vertexIndex }
      );
    }

    if (!this.options.getCapabilities?.()?.includes(capability)) {
      throw createCapabilityNotSupportedError(capability);
    }

    if (this.pending.has(requestId)) {
      throw invalid("A measurement request with this requestId is already pending.");
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let unsubscribe = () => {};
      let timer: ReturnType<typeof setTimeout>;
      const cleanup = () => {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        this.pending.delete(requestId);
      };
      const fail = (error: Error) => {
        if (!settled) {
          cleanup();
          reject(error);
        }
      };
      const failResult = (result: unknown, message: string) =>
        fail(createCanvasCommandError(type, message, { requestId, result }));
      timer = setTimeout(
        () => fail(createCommandTimeoutError(requestId, type, timeoutMs)),
        timeoutMs
      );
      this.pending.set(requestId, fail);

      try {
        unsubscribe = broker.on<unknown>(resultType, ({ payload: result }) => {
          if (settled || !isRecord(result) || result.requestId !== requestId) {
            return;
          }

          if (result.success === false) {
            failResult(
              result,
              typeof result.error === "string"
                ? result.error
                : "Canvas measurement command failed."
            );

            return;
          }
          const expected = payload as unknown as GetMeasurementInfoOptions;

          if (
            result.success !== true ||
            result.error !== undefined ||
            !(operation === "clear"
              ? result.active === false
              : operation === "inspect"
                ? isValidInspection(result, expected)
                : isValidSelection(result, expected))
          ) {
            failResult(result, "Canvas returned an invalid measurement result.");

            return;
          }
          cleanup();
          resolve(result as T);
        });
        broker.send(type, payload);
      } catch (cause) {
        fail(
          createCanvasCommandError(type, "Measurement command could not be sent.", {
            requestId,
            cause: cause instanceof Error ? cause.message : String(cause)
          })
        );
      }
    });
  }
}
