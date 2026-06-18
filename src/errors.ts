import {
  ERROR_CODES,
  type ErrorCode
} from "@rasterex/viewer-protocol";

import { SDK_VERSION } from "./constants.js";

export interface RasterexViewerErrorOptions {
  code: ErrorCode;
  message: string;
  sdkInstanceId?: string;
  canvasVersion?: string | null;
  sdkVersion?: string;
  context?: Record<string, unknown>;
  timestamp?: string;
}

export class RasterexViewerError extends Error {
  readonly code: ErrorCode;
  readonly sdkInstanceId: string;
  readonly canvasVersion: string | null;
  readonly sdkVersion: string;
  readonly context: Record<string, unknown>;
  readonly timestamp: string;

  constructor(options: RasterexViewerErrorOptions) {
    super(options.message);

    this.name = "RasterexViewerError";
    this.code = options.code;
    this.sdkInstanceId = options.sdkInstanceId ?? "unknown";
    this.canvasVersion = options.canvasVersion ?? null;
    this.sdkVersion = options.sdkVersion ?? SDK_VERSION;
    this.context = options.context ?? {};
    this.timestamp = options.timestamp ?? new Date().toISOString();
  }
}

export function createCanvasLoadTimeoutError(
  timeoutMs: number
): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.canvasLoadTimeout,
    message: `Rasterex Canvas iframe failed to load within ${timeoutMs / 1000} seconds.`,
    context: {
      timeoutMs
    }
  });
}

export function createCanvasIframeError(): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.canvasIframeError,
    message: "Rasterex Canvas iframe failed to load."
  });
}

export function createContainerNotFoundError(
  container: string
): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.canvasIframeError,
    message: `RasterexViewer container not found: ${container}`,
    context: {
      container
    }
  });
}

export function createCanvasReadyTimeoutError(
  timeoutMs: number
): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.canvasReadyTimeout,
    message: `Rasterex Canvas did not send viewer.ready within ${timeoutMs / 1000} seconds.`,
    context: {
      timeoutMs
    }
  });
}

export function createViewerNotReadyError(
  message: string,
  context?: Record<string, unknown>
): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.viewerNotReady,
    message,
    context
  });
}

export function createCommandTimeoutError(
  id: string,
  type: string,
  timeoutMs: number
): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.commandTimeout,
    message: `Rasterex command ${type} timed out after ${timeoutMs / 1000} seconds.`,
    context: {
      id,
      type,
      timeoutMs
    }
  });
}

export function createCapabilityNotSupportedError(
  capability: string
): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.capabilityNotSupported,
    message: `Rasterex capability is not supported: ${capability}`,
    context: {
      capability
    }
  });
}

export function createDocumentLoadFailedError(
  message: string,
  context?: Record<string, unknown>
): RasterexViewerError {
  return new RasterexViewerError({
    code: ERROR_CODES.documentLoadFailed,
    message,
    context
  });
}
