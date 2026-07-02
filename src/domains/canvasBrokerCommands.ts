import { ERROR_CODES } from "../protocol/index.js";

import {
  createCommandTimeoutError,
  createViewerNotReadyError,
  RasterexViewerError
} from "../errors.js";
import type {
  CanvasMessage,
  CanvasMessageBroker
} from "../messaging/CanvasMessageBroker.js";

export interface CanvasBrokerAccess {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
}

export interface RequestPayload {
  requestId?: string;
  [key: string]: unknown;
}

export interface RequestResultMessage<TPayload> extends CanvasMessage<TPayload> {
  requestId?: string;
  success?: boolean;
  id?: string;
  active?: boolean;
}

export interface SendCanvasCommandWithResultOptions
  extends CanvasBrokerAccess {
  type: string;
  resultType: string;
  payload: RequestPayload;
  timeoutMs: number;
  apiName: string;
}

export function sendCanvasFireAndForget<TPayload>(
  options: CanvasBrokerAccess & {
    type: string;
    payload?: TPayload;
    apiName: string;
  }
): void {
  requireReadyBroker(options).send(options.type, options.payload);
}

export function sendCanvasCommandWithResult<
  TResult extends { success: boolean; error?: string }
>(options: SendCanvasCommandWithResultOptions): Promise<TResult> {
  const broker = requireReadyBroker(options);
  const requestId = options.payload.requestId ?? createLocalRequestId(options.type);
  const payload = {
    ...options.payload,
    requestId
  };

  return new Promise<TResult>((resolve, reject) => {
    const cleanup = broker.on<TResult>(options.resultType, (message) => {
      const resultMessage = message as RequestResultMessage<TResult>;
      const resultPayload = resultMessage.payload as
        | (TResult & { requestId?: string })
        | undefined;
      const responseRequestId = resultPayload?.requestId ?? resultMessage.requestId;

      if (!responseRequestId) {
        globalThis.clearTimeout(timeoutId);
        cleanup();
        reject(
          createCanvasCommandError(
            options.type,
            "Canvas command result did not include a requestId.",
            {
              requestId,
              result: message.payload
            }
          )
        );
        return;
      }

      if (responseRequestId !== requestId) {
        return;
      }

      globalThis.clearTimeout(timeoutId);
      cleanup();

      if (!message.payload) {
        reject(
          createCanvasCommandError(
            options.type,
            "Canvas returned an empty command result."
          )
        );
        return;
      }

      if (message.payload.success === false) {
        reject(
          createCanvasCommandError(
            options.type,
            message.payload.error ?? "Canvas command failed.",
            {
              requestId,
              result: message.payload
            }
          )
        );
        return;
      }

      resolve(message.payload);
    });

    const timeoutId = globalThis.setTimeout(() => {
      cleanup();
      reject(createCommandTimeoutError(requestId, options.type, options.timeoutMs));
    }, options.timeoutMs);

    broker.send(options.type, payload);
  });
}

export function requireReadyBroker(
  options: CanvasBrokerAccess & { type: string; apiName: string }
): CanvasMessageBroker {
  if (!options.getIsReady()) {
    throw createViewerNotReadyError(
      `RasterexViewer must be ready before using ${options.apiName}.`,
      {
        type: options.type
      }
    );
  }

  const broker = options.getBroker();

  if (!broker) {
    throw createViewerNotReadyError(
      "Rasterex Canvas message broker is not available.",
      {
        type: options.type
      }
    );
  }

  return broker;
}

export function createCanvasCommandError(
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

function createLocalRequestId(type: string): string {
  return `canvas-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
