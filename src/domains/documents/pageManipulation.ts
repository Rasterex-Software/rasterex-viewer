import {
  createCommandTimeoutError,
  createDocumentLoadFailedError
} from "../../errors.js";
import type { CanvasMessage, CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import { createRequestId } from "../../utils/createRequestId.js";
import type {
  PageManipulationOptions,
  PageManipulationResult
} from "./types.js";

export function manipulateDocumentPages(
  broker: CanvasMessageBroker,
  options: PageManipulationOptions,
  defaultTimeoutMs: number
): Promise<PageManipulationResult> {
  const requestId = createRequestId();
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

  return new Promise<PageManipulationResult>((resolve, reject) => {
    const cleanup = broker.on<PageManipulationResult>(
      "pageManipulationResult",
      (message) => {
        const result = message.payload;
        const responseRequestId = getResultRequestId(message);

        if (!responseRequestId) {
          finishReject(
            createDocumentLoadFailedError(
              "Page manipulation result did not include a requestId.",
              { requestId, result }
            )
          );
          return;
        }

        if (responseRequestId !== requestId) return;

        if (!result) {
          finishReject(
            createDocumentLoadFailedError("Canvas returned an empty page manipulation result.", {
              requestId
            })
          );
          return;
        }

        if (result.success === false) {
          finishReject(
            createDocumentLoadFailedError(result.error ?? "Page manipulation failed.", {
              requestId,
              result
            })
          );
          return;
        }

        globalThis.clearTimeout(timeoutId);
        cleanup();
        resolve({ ...result, requestId });
      }
    );

    const finishReject = (error: Error) => {
      globalThis.clearTimeout(timeoutId);
      cleanup();
      reject(error);
    };

    const timeoutId = globalThis.setTimeout(() => {
      finishReject(createCommandTimeoutError(requestId, "pageManipulation", timeoutMs));
    }, timeoutMs);

    broker.send("pageManipulation", {
      requestId,
      action: options.action,
      pageRange: options.pageRange,
      targetPageIndex: options.targetPageIndex,
      file: options.file,
      selectedPages: options.selectedPages,
      count: options.count,
      width: options.width,
      height: options.height
    });
  });
}

function getResultRequestId(
  message: CanvasMessage<PageManipulationResult>
): string | undefined {
  return message.payload?.requestId ?? (message as { requestId?: string }).requestId;
}
