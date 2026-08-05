import { createDocumentLoadFailedError } from "../../errors.js";
import type { RasterexViewerError } from "../../errors.js";
import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  CanvasFileInfoPayload,
  CanvasFileTabsPayload,
  CanvasPageListPayload,
  DocumentFileLoadFailedEvent,
  DocumentFileReadyEvent,
  DocumentFileSource,
  DocumentOpenOptions,
  DocumentOpenResult,
  DocumentOpenedEvent
} from "./types.js";

export interface DocumentOpenOperation {
  promise: Promise<DocumentOpenResult>;
  cancel: (error: RasterexViewerError) => void;
  start: () => void;
}

interface CreateDocumentOpenOperationOptions {
  broker: CanvasMessageBroker;
  options: DocumentOpenOptions;
  requestId: string;
  source: DocumentFileSource;
  requiresRequestId: boolean;
  timeoutMs: number;
  send: () => void;
  onOpening: () => void;
  onOpened: (
    result: DocumentOpenResult,
    correlation: DocumentOpenedEvent["correlation"]
  ) => void;
  onFailed: (error: RasterexViewerError) => void;
  onSettled: () => void;
}

export function createDocumentOpenOperation(
  options: CreateDocumentOpenOperationOptions
): DocumentOpenOperation {
  const {
    broker,
    requestId,
    requiresRequestId,
    timeoutMs,
    send,
    onOpening,
    onOpened,
    onFailed,
    onSettled
  } = options;
  const result: Omit<DocumentOpenResult, "fileReady"> = { requestId };
  const cleanups: Array<() => void> = [];
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let settled = false;
  let resolvePromise!: (result: DocumentOpenResult) => void;
  let rejectPromise!: (error: RasterexViewerError) => void;

  const cleanup = () => {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
      timeoutId = null;
    }

    for (const unsubscribe of cleanups) {
      unsubscribe();
    }

    onSettled();
  };

  const rejectOpen = (error: RasterexViewerError) => {
    if (settled) return;

    settled = true;
    cleanup();
    onFailed(error);
    rejectPromise(error);
  };

  const promise = new Promise<DocumentOpenResult>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const isCurrent = (payload: { requestId?: string } | undefined) =>
    requiresRequestId
      ? payload?.requestId === requestId
      : !payload?.requestId || payload.requestId === requestId;

  const start = () => {
    if (settled || timeoutId !== null) return;

    cleanups.push(
      broker.on<CanvasFileInfoPayload>("fileInfo", (message) => {
        if (!isCurrent(message.payload)) return;
        result.fileInfo = message.payload;
        result.activeId = message.payload?.activeId ?? result.activeId;
      }),
      broker.on<CanvasFileTabsPayload>("fileTabs", (message) => {
        if (!isCurrent(message.payload)) return;
        result.fileTabs = message.payload;
        result.activeId = message.payload?.activeId ?? result.activeId;
      }),
      broker.on<CanvasPageListPayload>("pageList", (message) => {
        if (!isCurrent(message.payload)) return;
        result.pageList = message.payload;
        result.activeId = message.payload?.activeId ?? result.activeId;
      }),
      broker.on<DocumentFileReadyEvent>("fileReady", (message) => {
        if (!isDocumentFileReadyEvent(message.payload) || !isCurrent(message.payload)) return;

        settled = true;
        const openResult: DocumentOpenResult = { ...result, fileReady: message.payload };
        cleanup();
        onOpened(openResult, requiresRequestId ? "requestId" : "unavailable");
        resolvePromise(openResult);
      }),
      broker.on<DocumentFileLoadFailedEvent>("fileLoadFailed", (message) => {
        if (!isDocumentFileLoadFailedEvent(message.payload) || !isCurrent(message.payload)) {
          return;
        }

        rejectOpen(
          createDocumentLoadFailedError("Canvas could not open the requested file.", {
            requestId,
            source: options.source,
            fileUrl: message.payload.fileUrl,
            reason: message.payload.reason
          })
        );
      })
    );

    timeoutId = globalThis.setTimeout(() => {
      rejectOpen(
        createDocumentLoadFailedError(
          "Document open did not receive a fileReady or fileLoadFailed event before timeout.",
          { timeoutMs }
        )
      );
    }, timeoutMs);

    onOpening();
    if (settled) return;

    try {
      send();
    } catch (error) {
      rejectOpen(
        createDocumentLoadFailedError("Document open command could not be sent.", {
          requestId,
          cause: error instanceof Error ? error.message : String(error)
        })
      );
    }
  };

  return { promise, cancel: rejectOpen, start };
}

export function isDocumentFileReadyEvent(
  payload: unknown
): payload is DocumentFileReadyEvent {
  if (!payload || typeof payload !== "object") return false;

  const event = payload as Partial<DocumentFileReadyEvent>;
  return (
    (event.source === "url" || event.source === "file") &&
    (event.requestId === undefined || typeof event.requestId === "string") &&
    (event.fileUrl === undefined || typeof event.fileUrl === "string") &&
    (event.fileId === undefined ||
      typeof event.fileId === "string" ||
      typeof event.fileId === "number") &&
    (event.fileIndex === undefined || typeof event.fileIndex === "number") &&
    (event.fileName === undefined || typeof event.fileName === "string")
  );
}

export function isDocumentFileLoadFailedEvent(
  payload: unknown
): payload is DocumentFileLoadFailedEvent {
  if (!payload || typeof payload !== "object") return false;

  const event = payload as Partial<DocumentFileLoadFailedEvent>;
  return (
    (event.reason === "invalid_file_url" ||
      event.reason === "invalid_request" ||
      event.reason === "timeout" ||
      event.reason === "open_failed") &&
    (event.requestId === undefined || typeof event.requestId === "string") &&
    (event.fileUrl === undefined || typeof event.fileUrl === "string")
  );
}
