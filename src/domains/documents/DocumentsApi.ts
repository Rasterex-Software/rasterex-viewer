import {
  createDocumentLoadFailedError,
  createViewerNotReadyError
} from "../../errors.js";
import type { RasterexViewerError } from "../../errors.js";
import { DomainEventEmitter } from "../../utils/DomainEventEmitter.js";
import { createRequestId } from "../../utils/createRequestId.js";
import type {
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../../messaging/CanvasMessageBroker.js";
import {
  createDocumentOpenOperation,
  isDocumentFileLoadFailedEvent,
  isDocumentFileReadyEvent
} from "./openLifecycle.js";
import { manipulateDocumentPages } from "./pageManipulation.js";
import type {
  CanvasFileInfoPayload,
  CanvasFileTabsPayload,
  CanvasPageListPayload,
  DocumentEventHandler,
  DocumentEventMap,
  DocumentEventName,
  DocumentEventUnsubscribe,
  DocumentExportOptions,
  DocumentExportResult,
  DocumentFileLoadFailedEvent,
  DocumentFileReadyEvent,
  DocumentOpenFileOptions,
  DocumentOpenOptions,
  DocumentOpenedEvent,
  DocumentOpenResult,
  DocumentsApiOptions,
  PageManipulationOptions,
  PageManipulationResult,
  SelectPageOptions,
  SetActiveFileByIndexOptions
} from "./types.js";
export type * from "./types.js";

export class DocumentsApi {
  private readonly getBroker: () => CanvasMessageBroker | null;
  private readonly getIsReady: () => boolean;
  private readonly commandTimeoutMs: number;
  private readonly events = new DomainEventEmitter<DocumentEventMap>();
  private activeOpenRequestId: string | null = null;
  private pendingOpenCancellation: ((error: RasterexViewerError) => void) | null = null;
  private exportInProgress = false;
  private broker: CanvasMessageBroker | null = null;
  private brokerCleanups: CanvasMessageUnsubscribe[] = [];

  constructor(options: DocumentsApiOptions) {
    this.getBroker = options.getBroker;
    this.getIsReady = options.getIsReady;
    this.commandTimeoutMs = options.commandTimeoutMs;
  }

  on<TEventName extends DocumentEventName>(
    eventName: TEventName,
    handler: DocumentEventHandler<TEventName>
  ): DocumentEventUnsubscribe {
    this.connect();
    return this.events.on(eventName, handler);
  }

  connect(): void {
    const broker = this.getBroker();

    if (!broker || broker === this.broker) {
      return;
    }

    this.disconnect();
    this.broker = broker;
    this.brokerCleanups = [
      broker.on<CanvasFileInfoPayload>("fileInfo", (message) => {
        if (message.payload) {
          this.events.emit("fileInfo", message.payload);
        }
      }),
      broker.on<CanvasFileTabsPayload>("fileTabs", (message) => {
        if (message.payload) {
          this.events.emit("fileTabs", message.payload);
        }
      }),
      broker.on<CanvasPageListPayload>("pageList", (message) => {
        if (message.payload) {
          this.events.emit("pageList", message.payload);
          this.emitPageChanged(message.payload);
        }
      }),
      broker.on<DocumentExportResult>("exportComplete", (message) => {
        if (isDocumentExportResult(message.payload)) {
          this.events.emit("exportComplete", message.payload);
        }
      }),
      broker.on<DocumentFileReadyEvent>("fileReady", (message) => {
        if (isDocumentFileReadyEvent(message.payload)) {
          this.events.emit("fileReady", message.payload);
        }
      }),
      broker.on<DocumentFileLoadFailedEvent>("fileLoadFailed", (message) => {
        if (isDocumentFileLoadFailedEvent(message.payload)) {
          this.events.emit("fileLoadFailed", message.payload);
        }
      })
    ];
  }

  disconnect(): void {
    this.pendingOpenCancellation?.(
      createViewerNotReadyError(
        "RasterexViewer was disconnected before document open completed."
      )
    );

    for (const cleanup of this.brokerCleanups) {
      cleanup();
    }

    this.brokerCleanups = [];
    this.broker = null;
  }

  open(options: DocumentOpenOptions): Promise<DocumentOpenResult> {
    const setupError = this.getOpenSetupError(options);

    if (setupError) {
      this.emitFailed(options, setupError);
      return Promise.reject(setupError);
    }

    const broker = this.getBroker();

    if (!broker) {
      const error = createViewerNotReadyError(
        "Rasterex Canvas message broker is not available."
      );
      this.emitFailed(options, error);
      return Promise.reject(error);
    }

    const requestId = options.requestId ?? createRequestId();
    this.activeOpenRequestId = requestId;

    return this.waitForCanvasOpen({
      broker,
      options,
      requestId,
      source: "url",
      requiresRequestId: true,
      send: () => {
        broker.send("viewAny", this.createViewPayload(options, requestId));
      }
    });
  }

  /** Opens a browser-local `File` through the Canvas `viewFile` command. */
  openFile(file: File, options: DocumentOpenFileOptions = {}): Promise<DocumentOpenResult> {
    const setupError = this.getOpenFileSetupError(file);

    if (setupError) {
      this.emitFailed(
        {
          displayName: file?.name
        },
        setupError
      );
      return Promise.reject(setupError);
    }

    const broker = this.getBroker();

    if (!broker) {
      const error = createViewerNotReadyError(
        "Rasterex Canvas message broker is not available."
      );
      this.emitFailed(
        {
          displayName: file.name
        },
        error
      );
      return Promise.reject(error);
    }

    const requestId = options.requestId ?? createRequestId();
    this.activeOpenRequestId = requestId;

    return this.waitForCanvasOpen({
      broker,
      options: {
        displayName: file.name,
        requestId
      },
      requestId,
      source: "file",
      requiresRequestId: false,
      send: () => {
        broker.send("viewFile", this.createViewFilePayload(file, options));
      }
    });
  }

  setActiveFileByIndex(indexOrOptions: number | SetActiveFileByIndexOptions): void {
    const fileIndex =
      typeof indexOrOptions === "number" ? indexOrOptions : indexOrOptions.index;
    const broker = this.requireReadyBroker("setActiveFileByIndex");

    broker.send("setActiveFileByIndex", {
      fileIndex
    });
  }

  selectPage(options: SelectPageOptions): void {
    if (typeof options.pageIndex !== "number" && typeof options.pageNumber !== "number") {
      throw createDocumentLoadFailedError(
        "Page selection requires pageIndex or pageNumber.",
        {
          options
        }
      );
    }

    const broker = this.requireReadyBroker("selectPage");

    broker.send("selectPage", {
      pageIndex: options.pageIndex,
      pageNumber: options.pageNumber
    });
  }

  export(options: DocumentExportOptions = {}): Promise<DocumentExportResult> {
    if (this.exportInProgress) {
      return Promise.reject(
        createDocumentLoadFailedError("A document export is already in progress.")
      );
    }

    const broker = this.requireReadyBroker("export");
    const timeoutMs = options.timeoutMs ?? this.commandTimeoutMs;
    this.exportInProgress = true;

    return new Promise<DocumentExportResult>((resolve, reject) => {
      const cleanup = broker.on<DocumentExportResult>("exportComplete", (message) => {
        if (!isDocumentExportResult(message.payload)) {
          return;
        }

        globalThis.clearTimeout(timeoutId);
        cleanup();
        this.exportInProgress = false;
        resolve(message.payload);
      });

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        this.exportInProgress = false;
        reject(
          createDocumentLoadFailedError(
            "Document export did not complete before timeout.",
            {
              timeoutMs
            }
          )
        );
      }, timeoutMs);

      broker.send("export");
    });
  }

  print(): void {
    const broker = this.requireReadyBroker("print");
    broker.send("print");
  }

  manipulatePages(options: PageManipulationOptions): Promise<PageManipulationResult> {
    const broker = this.requireReadyBroker("pageManipulation");
    return manipulateDocumentPages(broker, options, this.commandTimeoutMs);
  }

  private getOpenSetupError(
    options: DocumentOpenOptions
  ): RasterexViewerError | null {
    if (!this.getIsReady()) {
      return createViewerNotReadyError(
        "RasterexViewer must be ready before opening a document."
      );
    }

    if (!options.url && !options.path) {
      return createDocumentLoadFailedError(
        "Document open requires url or path.",
        {
          options
        }
      );
    }

    if (this.activeOpenRequestId) {
      return createDocumentLoadFailedError(
        "A document open is already in progress.",
        {
          activeRequestId: this.activeOpenRequestId
        }
      );
    }

    return null;
  }

  private getOpenFileSetupError(file: File): RasterexViewerError | null {
    if (!this.getIsReady()) {
      return createViewerNotReadyError(
        "RasterexViewer must be ready before opening a document."
      );
    }

    if (!file) {
      return createDocumentLoadFailedError("Document open requires a File.");
    }

    if (this.activeOpenRequestId) {
      return createDocumentLoadFailedError(
        "A document open is already in progress.",
        {
          activeRequestId: this.activeOpenRequestId
        }
      );
    }

    return null;
  }

  private requireReadyBroker(type: string): CanvasMessageBroker {
    if (!this.getIsReady()) {
      throw createViewerNotReadyError(
        "RasterexViewer must be ready before using viewer.documents.",
        {
          type
        }
      );
    }

    const broker = this.getBroker();

    if (!broker) {
      throw createViewerNotReadyError(
        "Rasterex Canvas message broker is not available.",
        {
          type
        }
      );
    }

    return broker;
  }

  private waitForCanvasOpen(
    context: {
      broker: CanvasMessageBroker;
      options: DocumentOpenOptions;
      requestId: string;
      source: "url" | "file";
      requiresRequestId: boolean;
      send: () => void;
    }
  ): Promise<DocumentOpenResult> {
    const operation = createDocumentOpenOperation({
      ...context,
      timeoutMs: this.commandTimeoutMs,
      onOpening: () => {
        this.events.emit("opening", {
          requestId: context.requestId,
          url: context.options.url,
          path: context.options.path,
          displayName: context.options.displayName ?? context.options.name
        });
      },
      onOpened: (result, correlation) => this.emitOpened(result, correlation),
      onFailed: (error) => this.emitFailed(context.options, error),
      onSettled: () => {
        if (this.activeOpenRequestId === context.requestId) {
          this.activeOpenRequestId = null;
        }
        if (this.pendingOpenCancellation === operation.cancel) {
          this.pendingOpenCancellation = null;
        }
      }
    });

    this.pendingOpenCancellation = operation.cancel;
    operation.start();
    return operation.promise;
  }

  private createViewPayload(
    options: DocumentOpenOptions,
    requestId: string
  ): Record<string, unknown> {
    return {
      requestId,
      fileUrl: options.url,
      filePath: options.path,
      displayName: options.displayName,
      name: options.name,
      cacheId: options.cacheId,
      mime: options.mime
    };
  }

  private createViewFilePayload(
    file: File,
    options: DocumentOpenFileOptions
  ): File | { file: File; cacheId: string } {
    if (!options.cacheId) {
      return file;
    }

    return {
      file,
      cacheId: options.cacheId
    };
  }

  private emitOpened(
    result: DocumentOpenResult,
    correlation: DocumentOpenedEvent["correlation"]
  ): void {
    this.events.emit("opened", {
      ...result,
      source: "current-canvas",
      correlation
    });
  }

  private emitPageChanged(payload: CanvasPageListPayload): void {
    this.events.emit("pageChanged", {
      requestId: payload.requestId,
      activeId: payload.activeId,
      activeIndex: payload.activeIndex,
      currentPage: payload.currentPage,
      pageCount: payload.pageCount,
      pages: payload.pages
    });
  }

  private emitFailed(
    options: DocumentOpenOptions,
    error: RasterexViewerError
  ): void {
    this.events.emit("failed", {
      error,
      url: options.url,
      path: options.path,
      displayName: options.displayName ?? options.name
    });
  }
}

function isDocumentExportResult(
  payload: DocumentExportResult | undefined
): payload is DocumentExportResult {
  return typeof payload?.fileUrl === "string" && payload.fileUrl.length > 0;
}
