import {
  createCommandTimeoutError,
  createDocumentLoadFailedError,
  createViewerNotReadyError
} from "../errors.js";
import type { RasterexViewerError } from "../errors.js";
import {
  DomainEventEmitter,
  type DomainEventHandler,
  type DomainEventUnsubscribe
} from "../utils/DomainEventEmitter.js";
import { createRequestId } from "../utils/createRequestId.js";
import type {
  CanvasMessage,
  CanvasMessageBroker,
  CanvasMessageUnsubscribe
} from "../messaging/CanvasMessageBroker.js";

export interface DocumentOpenOptions {
  url?: string;
  path?: string;
  displayName?: string;
  name?: string;
  cacheId?: string;
  mime?: string;
  requestId?: string;
}

export interface DocumentOpenFileOptions {
  cacheId?: string;
  requestId?: string;
}

export interface SetActiveFileByIndexOptions {
  index: number;
}

export interface SelectPageOptions {
  pageIndex?: number;
  pageNumber?: number;
}

export interface DocumentExportOptions {
  timeoutMs?: number;
}

export interface DocumentExportResult {
  fileUrl: string;
}

export type PageRange = [number] | [number, number];

export type PageManipulationAction =
  | "move-top"
  | "move-bottom"
  | "move-up"
  | "move-down"
  | "rotate-r"
  | "rotate-l"
  | "page-copy"
  | "page-paste"
  | "page-extract"
  | "page-extract-delete"
  | "page-delete"
  | "page-insert"
  | "page-replace"
  | "page-insert-blank";

export interface PageManipulationOptions {
  action: PageManipulationAction;
  pageRange?: PageRange[];
  targetPageIndex?: number;
  file?: File;
  selectedPages?: PageRange[];
  count?: number;
  width?: number;
  height?: number;
  timeoutMs?: number;
}

export interface PageManipulationResult {
  requestId: string;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export type CanvasFileTabIcon = "pdf" | "image" | "cad" | "doc" | "generic";

export interface CanvasFileTab {
  id: string;
  title: string;
  icon?: CanvasFileTabIcon;
  coreId?: string | number;
  index?: number;
}

export interface CanvasFileInfo {
  url?: string;
  name?: string;
  date?: unknown;
  width?: unknown;
  height?: unknown;
}

export interface CanvasPageListItem {
  index: number;
  pageNumber: number;
  title?: string;
  label: string;
  isSelected: boolean;
  thumbnailDataUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

export interface CanvasFileTabsPayload {
  requestId?: string;
  tabs: CanvasFileTab[];
  activeId: string;
}

export interface CanvasFileInfoPayload {
  requestId?: string;
  fileInfo: CanvasFileInfo | null;
  activeId: string;
  activeIndex?: number;
}

export interface CanvasPageListPayload {
  requestId?: string;
  activeId: string;
  activeIndex?: number;
  currentPage: number;
  pageCount: number;
  pages: CanvasPageListItem[];
}

export interface DocumentOpenResult {
  requestId: string;
  activeId?: string;
  fileInfo?: CanvasFileInfoPayload;
  fileTabs?: CanvasFileTabsPayload;
  pageList?: CanvasPageListPayload;
}

export interface DocumentOpeningEvent {
  requestId: string;
  url?: string;
  path?: string;
  displayName?: string;
}

export interface DocumentOpenedEvent extends DocumentOpenResult {
  source: "current-canvas";
  correlation: "inferred";
}

export interface DocumentFailedEvent {
  error: RasterexViewerError;
  url?: string;
  path?: string;
  displayName?: string;
}

export interface DocumentPageChangedEvent {
  requestId?: string;
  activeId?: string;
  activeIndex?: number;
  currentPage: number;
  pageCount: number;
  pages: CanvasPageListItem[];
}

export interface DocumentEventMap {
  opening: DocumentOpeningEvent;
  opened: DocumentOpenedEvent;
  failed: DocumentFailedEvent;
  pageChanged: DocumentPageChangedEvent;
  fileInfo: CanvasFileInfoPayload;
  fileTabs: CanvasFileTabsPayload;
  pageList: CanvasPageListPayload;
  exportComplete: DocumentExportResult;
}

export type DocumentEventName = keyof DocumentEventMap;
export type DocumentEventHandler<TEventName extends DocumentEventName> =
  DomainEventHandler<DocumentEventMap[TEventName]>;
export type DocumentEventUnsubscribe = DomainEventUnsubscribe;

export interface DocumentsApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}

export class DocumentsApi {
  private readonly getBroker: () => CanvasMessageBroker | null;
  private readonly getIsReady: () => boolean;
  private readonly commandTimeoutMs: number;
  private readonly events = new DomainEventEmitter<DocumentEventMap>();
  private activeOpenRequestId: string | null = null;
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
      send: () => {
        broker.send("viewAny", this.createViewPayload(options, requestId));
      }
    });
  }

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
    const requestId = createRequestId();
    const timeoutMs = options.timeoutMs ?? this.commandTimeoutMs;

    return new Promise<PageManipulationResult>((resolve, reject) => {
      const cleanup = broker.on<PageManipulationResult>(
        "pageManipulationResult",
        (message) => {
          const resultPayload = message.payload;
          const responseRequestId = getResultRequestId(message);

          if (!responseRequestId) {
            globalThis.clearTimeout(timeoutId);
            cleanup();
            reject(
              createDocumentLoadFailedError(
                "Page manipulation result did not include a requestId.",
                {
                  requestId,
                  result: resultPayload
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

          if (!resultPayload) {
            reject(
              createDocumentLoadFailedError(
                "Canvas returned an empty page manipulation result.",
                {
                  requestId
                }
              )
            );
            return;
          }

          if (resultPayload.success === false) {
            reject(
              createDocumentLoadFailedError(
                resultPayload.error ?? "Page manipulation failed.",
                {
                  requestId,
                  result: resultPayload
                }
              )
            );
            return;
          }

          resolve({
            ...resultPayload,
            requestId
          });
        }
      );

      const timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(createCommandTimeoutError(requestId, "pageManipulation", timeoutMs));
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
      send: () => void;
    }
  ): Promise<DocumentOpenResult> {
    const { broker, options, requestId, send } = context;
    return new Promise<DocumentOpenResult>((resolve, reject) => {
      const result: DocumentOpenResult = { requestId };
      let progressStarted = false;
      let progressEnded = false;
      let openedEmitted = false;

      const cleanupCallbacks: Array<() => void> = [];

      const cleanup = () => {
        globalThis.clearTimeout(timeoutId);
        this.clearActiveOpen(requestId);

        for (const cleanupCallback of cleanupCallbacks) {
          cleanupCallback();
        }
      };

      const isCurrentPayload = (payload: { requestId?: string } | undefined) =>
        this.isCurrentOpenPayload(payload, requestId);

      const tryResolve = () => {
        if (this.isOpenComplete(result, progressStarted, progressEnded)) {
          cleanup();
          if (!openedEmitted) {
            openedEmitted = true;
            this.emitOpened(result);
          }
          resolve(result);
        }
      };

      const timeoutId = globalThis.setTimeout(() => {
        const error = createDocumentLoadFailedError(
          "Document open did not produce file metadata before timeout.",
          {
            timeoutMs: this.commandTimeoutMs
          }
        );
        cleanup();
        this.emitFailed(options, error);
        reject(error);
      }, this.commandTimeoutMs);

      cleanupCallbacks.push(
        broker.on<CanvasFileInfoPayload>("fileInfo", (message) => {
          if (!isCurrentPayload(message.payload)) {
            return;
          }

          result.fileInfo = message.payload;
          result.activeId = message.payload?.activeId ?? result.activeId;
          tryResolve();
        })
      );
      cleanupCallbacks.push(
        broker.on<CanvasFileTabsPayload>("fileTabs", (message) => {
          if (!isCurrentPayload(message.payload)) {
            return;
          }

          result.fileTabs = message.payload;
          result.activeId = message.payload?.activeId ?? result.activeId;
          tryResolve();
        })
      );
      cleanupCallbacks.push(
        broker.on<CanvasPageListPayload>("pageList", (message) => {
          if (!isCurrentPayload(message.payload)) {
            return;
          }

          result.pageList = message.payload;
          result.activeId = message.payload?.activeId ?? result.activeId;
          tryResolve();
        })
      );
      cleanupCallbacks.push(
        broker.on<{ requestId?: string }>("progressStart", (message) => {
          if (!isCurrentPayload(message.payload)) {
            return;
          }

          progressStarted = true;
          tryResolve();
        })
      );
      cleanupCallbacks.push(
        broker.on<{ requestId?: string }>("progressEnd", (message) => {
          if (!isCurrentPayload(message.payload)) {
            return;
          }

          progressEnded = true;
          tryResolve();
        })
      );

      this.events.emit("opening", {
        requestId,
        url: options.url,
        path: options.path,
        displayName: options.displayName ?? options.name
      });

      send();
    });
  }

  private clearActiveOpen(requestId: string): void {
    if (this.activeOpenRequestId === requestId) {
      this.activeOpenRequestId = null;
    }
  }

  private isCurrentOpenPayload(
    payload: { requestId?: string } | undefined,
    requestId: string
  ): boolean {
    return !payload?.requestId || payload.requestId === requestId;
  }

  private isOpenComplete(
    result: DocumentOpenResult,
    progressStarted: boolean,
    progressEnded: boolean
  ): boolean {
    return (
      progressStarted &&
      progressEnded &&
      (result.fileInfo || result.fileTabs || result.pageList) !== undefined
    );
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

  private emitOpened(result: DocumentOpenResult): void {
    this.events.emit("opened", {
      ...result,
      source: "current-canvas",
      correlation: "inferred"
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

function getResultRequestId(
  message: CanvasMessage<PageManipulationResult>
): string | undefined {
  return message.payload?.requestId ?? (message as { requestId?: string }).requestId;
}
