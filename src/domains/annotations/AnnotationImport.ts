import { createCommandTimeoutError, createViewerNotReadyError } from "../../errors.js";
import { createRequestId } from "../../utils/createRequestId.js";
import {
  createCanvasCommandError,
  requireReadyBroker
} from "../canvas/canvasBrokerCommands.js";
import {
  createImportPayload,
  isRecord,
  LOAD_ANNOTATIONS,
  matchesImportResult
} from "./importPayload.js";
import type { LoadAnnotationsOptions, LoadAnnotationsResult } from "./importTypes.js";
import type { AnnotationsApiOptions } from "./types.js";

export class AnnotationImport {
  private cancelPending?: (error: Error) => void;
  private outcomeUnknown = false;
  private readonly usedRequestIds = new Set<string>();

  constructor(private readonly options: AnnotationsApiOptions) {}

  async load(options: LoadAnnotationsOptions): Promise<LoadAnnotationsResult> {
    const broker = requireReadyBroker({
      ...this.options,
      type: LOAD_ANNOTATIONS,
      apiName: "viewer.annotations"
    });
    const invalid = (message: string) =>
      createCanvasCommandError(LOAD_ANNOTATIONS, message);

    if (this.cancelPending) {
      throw invalid("An annotation import is already in progress.");
    }
    if (this.outcomeUnknown) {
      throw invalid(
        "The previous import timed out. Reconnect the viewer before importing again."
      );
    }
    if (!isRecord(options)) {
      throw invalid("Provide annotation import options.");
    }

    const requestId =
      options.requestId === undefined ? createRequestId() : options.requestId;
    const timeoutMs =
      options.timeoutMs === undefined ? this.options.commandTimeoutMs : options.timeoutMs;
    if (
      typeof requestId !== "string" ||
      !requestId.trim() ||
      requestId.length > 256 ||
      this.usedRequestIds.has(requestId)
    ) {
      throw invalid(
        "Use a new, nonblank annotation import request ID of at most 256 characters."
      );
    }
    if (
      typeof timeoutMs !== "number" ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs <= 0 ||
      timeoutMs > 2_147_483_647
    ) {
      throw invalid("Annotation import timeoutMs must be a positive timer-safe integer.");
    }

    const payload = createImportPayload(options, requestId);
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      let settled = false;
      const cleanup = () => {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        this.cancelPending = undefined;
      };
      const fail = (error: Error) => {
        if (!settled) {
          cleanup();
          reject(error);
        }
      };
      const timer = setTimeout(() => {
        this.outcomeUnknown = true;
        fail(createCommandTimeoutError(requestId, LOAD_ANNOTATIONS, timeoutMs));
      }, timeoutMs);
      this.cancelPending = fail;
      this.usedRequestIds.add(requestId);

      try {
        unsubscribe = broker.on<unknown>("annotationsLoaded", ({ payload: result }) => {
          if (settled || !isRecord(result) || result.requestId !== requestId) {
            return;
          }

          let problem: string | undefined;
          if (typeof result.reason === "string" && result.reason) {
            problem = result.reason;
          } else if (
            result.reason !== undefined ||
            result.success === false ||
            !matchesImportResult(result, payload)
          ) {
            problem =
              payload.measurementScalePolicy === "preserve" &&
              result.measurementScalePolicy === undefined
                ? "Canvas did not confirm that saved measurement scales were preserved."
                : "Canvas returned an invalid annotation import result.";
          } else {
            cleanup();
            resolve(result);
            return;
          }

          fail(
            createCanvasCommandError(LOAD_ANNOTATIONS, problem, { requestId, result })
          );
        });
        broker.send(LOAD_ANNOTATIONS, payload);
      } catch {
        fail(
          createCanvasCommandError(
            LOAD_ANNOTATIONS,
            "Could not send annotation import.",
            { requestId }
          )
        );
      }
    });
  }

  disconnect(): void {
    this.cancelPending?.(
      createViewerNotReadyError("Viewer disconnected during annotation import.")
    );
    this.outcomeUnknown = false;
    this.usedRequestIds.clear();
  }
}
