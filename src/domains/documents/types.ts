import type { RasterexViewerError } from "../../errors.js";
import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  DomainEventHandler,
  DomainEventUnsubscribe
} from "../../utils/DomainEventEmitter.js";

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

export type DocumentFileSource = "url" | "file";

export interface DocumentFileReadyEvent {
  requestId?: string;
  source: DocumentFileSource;
  fileUrl?: string;
  fileId?: string | number;
  fileIndex?: number;
  fileName?: string;
}

export type DocumentFileLoadFailedReason =
  | "invalid_file_url"
  | "invalid_request"
  | "timeout"
  | "open_failed";

export interface DocumentFileLoadFailedEvent {
  requestId?: string;
  fileUrl?: string;
  reason: DocumentFileLoadFailedReason;
}

export interface DocumentOpenResult {
  requestId: string;
  activeId?: string;
  fileReady: DocumentFileReadyEvent;
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
  correlation: "requestId" | "unavailable";
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
  fileReady: DocumentFileReadyEvent;
  fileLoadFailed: DocumentFileLoadFailedEvent;
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
