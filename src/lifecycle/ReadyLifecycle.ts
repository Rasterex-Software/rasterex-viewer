import {
  createCanvasReadyTimeoutError,
  createViewerNotReadyError
} from "../errors.js";
import type { ProtocolIncomingMessage } from "../protocol/index.js";
import type { ViewerReadyOptions } from "../types/index.js";

export interface ReadyCompletion {
  cleanup: () => void;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface ReadyLifecycleOptions {
  timeoutMs: number;
  viewerUrl: string;
  readyOptions: ViewerReadyOptions;
  onSlow: () => void;
  onSettled: () => void;
  onFailure: (error: Error) => void;
  onTransportMessage: (
    handler: (message: ProtocolIncomingMessage) => void
  ) => () => void;
  onCanvasReadyMessage: (handler: () => void) => () => void;
  hasReceivedCanvasReady: () => boolean;
  onCanvasReady: (completion: ReadyCompletion) => void;
  onProtocolReady: (
    message: ProtocolIncomingMessage,
    completion: ReadyCompletion
  ) => void;
}

export interface ReadyLifecycle {
  promise: Promise<void>;
  cleanup: () => void;
  reject: (error: Error) => void;
}

export function createReadyLifecycle(
  options: ReadyLifecycleOptions
): ReadyLifecycle {
  let cleanupOperation = () => {};
  let rejectOperation = (_error: Error) => {};

  const promise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let unsubscribeTransport: (() => void) | null = null;
    let unsubscribeCanvasReady: (() => void) | null = null;
    let timeoutId: number;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      options.readyOptions.signal?.removeEventListener("abort", abort);
      unsubscribeTransport?.();
      unsubscribeCanvasReady?.();
    };

    const complete = (callback: () => void): boolean => {
      if (settled) {
        return false;
      }

      settled = true;
      cleanup();
      options.onSettled();
      callback();
      return true;
    };

    const completion: ReadyCompletion = {
      cleanup,
      resolve: () => {
        complete(resolve);
      },
      reject: (error) => {
        complete(() => reject(error));
      }
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      options.onFailure(error);
      completion.reject(error);
    };

    const abort = () => {
      fail(createViewerNotReadyError("RasterexViewer.ready() was aborted.", {
        stage: "ready",
        reason: "aborted"
      }));
    };

    timeoutId = window.setTimeout(() => {
      options.onSlow();
      fail(createCanvasReadyTimeoutError(options.timeoutMs, options.viewerUrl));
    }, options.timeoutMs);
    options.readyOptions.signal?.addEventListener("abort", abort, { once: true });

    if (options.readyOptions.signal?.aborted) {
      abort();
      return;
    }

    unsubscribeTransport = options.onTransportMessage((message) => {
      options.onProtocolReady(message, completion);
    });

    if (options.hasReceivedCanvasReady()) {
      options.onCanvasReady(completion);
    } else {
      unsubscribeCanvasReady = options.onCanvasReadyMessage(() => {
        options.onCanvasReady(completion);
      });
    }

    cleanupOperation = cleanup;
    rejectOperation = reject;
  });

  return {
    promise,
    cleanup: () => cleanupOperation(),
    reject: (error) => rejectOperation(error)
  };
}
