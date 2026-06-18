import {
  createDocumentLoadFailedError,
  createViewerNotReadyError
} from "../errors.js";
import type { RasterexViewerError } from "../errors.js";
import {
  DomainEventEmitter,
  type DomainEventHandler,
  type DomainEventUnsubscribe
} from "../utils/DomainEventEmitter.js";
import type { CanvasMessageBroker } from "../messaging/CanvasMessageBroker.js";

export interface DocumentOpenOptions {
  url?: string;
  path?: string;
  displayName?: string;
  name?: string;
  cacheId?: string;
  mime?: string;
}

export interface CanvasFileTabsPayload {
  tabs: unknown[];
  activeId: string;
}

export interface CanvasFileInfoPayload {
  fileInfo: unknown | null;
  activeId: string;
  activeIndex?: number;
}

export interface CanvasPageListPayload {
  requestId?: string;
  activeId: string;
  activeIndex?: number;
  currentPage: number;
  pageCount: number;
  pages: unknown[];
}

export interface DocumentOpenResult {
  activeId?: string;
  fileInfo?: CanvasFileInfoPayload;
  fileTabs?: CanvasFileTabsPayload;
  pageList?: CanvasPageListPayload;
}

export interface DocumentOpeningEvent {
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
  activeId?: string;
  activeIndex?: number;
  currentPage: number;
  pageCount: number;
  pages: unknown[];
}

export interface DocumentEventMap {
  opening: DocumentOpeningEvent;
  opened: DocumentOpenedEvent;
  failed: DocumentFailedEvent;
  pageChanged: DocumentPageChangedEvent;
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

  constructor(options: DocumentsApiOptions) {
    this.getBroker = options.getBroker;
    this.getIsReady = options.getIsReady;
    this.commandTimeoutMs = options.commandTimeoutMs;
  }

  on<TEventName extends DocumentEventName>(
    eventName: TEventName,
    handler: DocumentEventHandler<TEventName>
  ): DocumentEventUnsubscribe {
    return this.events.on(eventName, handler);
  }

  open(options: DocumentOpenOptions): Promise<DocumentOpenResult> {
    if (!this.getIsReady()) {
      const error = createViewerNotReadyError(
        "RasterexViewer must be ready before opening a document."
      );
      this.emitFailed(options, error);
      return Promise.reject(error);
    }

    if (!options.url && !options.path) {
      const error = createDocumentLoadFailedError(
        "Document open requires url or path.",
        {
          options
        }
      );
      this.emitFailed(options, error);
      return Promise.reject(error);
    }

    const broker = this.getBroker();

    if (!broker) {
      const error = createViewerNotReadyError(
        "Rasterex Canvas message broker is not available."
      );
      this.emitFailed(options, error);
      return Promise.reject(error);
    }

    return new Promise<DocumentOpenResult>((resolve, reject) => {
      const result: DocumentOpenResult = {};
      let progressEnded = false;
      let openedEmitted = false;

      const cleanupCallbacks: Array<() => void> = [];

      const cleanup = () => {
        globalThis.clearTimeout(timeoutId);

        for (const cleanupCallback of cleanupCallbacks) {
          cleanupCallback();
        }
      };

      const tryResolve = () => {
        if (
          progressEnded &&
          (result.fileInfo || result.fileTabs || result.pageList)
        ) {
          cleanup();
          if (!openedEmitted) {
            openedEmitted = true;
            this.events.emit("opened", {
              ...result,
              source: "current-canvas",
              correlation: "inferred"
            });
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
          result.fileInfo = message.payload;
          result.activeId = message.payload?.activeId ?? result.activeId;
          tryResolve();
        })
      );
      cleanupCallbacks.push(
        broker.on<CanvasFileTabsPayload>("fileTabs", (message) => {
          result.fileTabs = message.payload;
          result.activeId = message.payload?.activeId ?? result.activeId;
          tryResolve();
        })
      );
      cleanupCallbacks.push(
        broker.on<CanvasPageListPayload>("pageList", (message) => {
          result.pageList = message.payload;
          result.activeId = message.payload?.activeId ?? result.activeId;
          if (message.payload) {
            this.events.emit("pageChanged", {
              activeId: message.payload.activeId,
              activeIndex: message.payload.activeIndex,
              currentPage: message.payload.currentPage,
              pageCount: message.payload.pageCount,
              pages: message.payload.pages
            });
          }
          tryResolve();
        })
      );
      cleanupCallbacks.push(
        broker.on("progressEnd", () => {
          progressEnded = true;
          tryResolve();
        })
      );

      this.events.emit("opening", {
        url: options.url,
        path: options.path,
        displayName: options.displayName ?? options.name
      });

      broker.send("view", {
        fileUrl: options.url,
        filePath: options.path,
        displayName: options.displayName,
        name: options.name,
        cacheId: options.cacheId,
        mime: options.mime
      });
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
