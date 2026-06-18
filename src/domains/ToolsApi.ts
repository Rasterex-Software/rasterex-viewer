import { ERROR_CODES } from "@rasterex/viewer-protocol";

import {
  createCommandTimeoutError,
  createViewerNotReadyError,
  RasterexViewerError
} from "../errors.js";
import {
  DomainEventEmitter,
  type DomainEventHandler,
  type DomainEventUnsubscribe
} from "../utils/DomainEventEmitter.js";
import type {
  CanvasMessage,
  CanvasMessageBroker
} from "../messaging/CanvasMessageBroker.js";

export type ToolGroup = "drawing" | "annotation" | "measurement";

export type ToolAction =
  | "SHAPE_RECTANGLE"
  | "SHAPE_RECTANGLE_ROUNDED"
  | "SHAPE_ELLIPSE"
  | "SHAPE_CLOUD"
  | "SHAPE_POLYGON"
  | "ARROW_SINGLE_END"
  | "ARROW_FILLED_SINGLE_END"
  | "ARROW_BOTH_ENDS"
  | "ARROW_FILLED_BOTH_ENDS"
  | "TEXT"
  | "CALLOUT"
  | "NOTE"
  | "ERASE"
  | "PAINT_HIGHLIGHTER"
  | "PAINT_FREEHAND"
  | "PAINT_TEXT_HIGHLIGHTING"
  | "PAINT_POLYLINE"
  | "STAMP"
  | "IMAGES_LIBRARY"
  | "SYMBOLS_LIBRARY"
  | "QR_CODE"
  | "LINKS_LIBRARY"
  | "MARKUP_LOCK"
  | "NO_SCALE"
  | "SCALE_SETTING"
  | "CALIBRATE"
  | "MEASURE_CONTINUOUS"
  | "MEASURE_LENGTH"
  | "MEASURE_AREA"
  | "MEASURE_PATH"
  | "MEASURE_ARC"
  | "MEASURE_ANGLE_CCLOCKWISE"
  | "MEASURE_RECTANGULAR_AREA"
  | "COUNT"
  | "SNAP";

export type NavigationToolAction =
  | "MAGNIFY"
  | "VECTORINFO"
  | "BLOCKINFO"
  | "ZOOM_IN"
  | "ZOOM_OUT"
  | "FIT_WIDTH"
  | "FIT_HEIGHT"
  | "ZOOM_WINDOW"
  | "FIT_TO_WINDOW"
  | "ROTATE"
  | "HIDE_MARKUPS"
  | "BACKGROUND"
  | "MONOCHROME"
  | "BIRDSEYE"
  | "SEARCH_TEXT"
  | "SELECT_TEXT"
  | "TOGGLECYCLE"
  | "GRAYSCALE";

export interface ToolStyleOptions {
  color?: string;
  strokeColor?: string;
  fillColor?: string;
  opacity?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
  strokeWidth?: number;
}

export interface ToolSetOptions {
  action: ToolAction;
  group?: ToolGroup;
  enabled?: boolean;
  style?: ToolStyleOptions;
  requestId?: string;
  timeoutMs?: number;
}

export interface CanvasToolControlOptions {
  group?: ToolGroup;
  action?: string;
  enabled?: boolean;
}

export interface ToolControlResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

export interface NavigationToolSetOptions {
  action: NavigationToolAction;
  enabled?: boolean;
  value?: number;
  searchText?: string;
  searchCaseSensitive?: boolean;
  searchForward?: boolean;
  requestId?: string;
  timeoutMs?: number;
}

export interface NavigationToolControlResult {
  success: boolean;
  requestId?: string;
  action?: string;
  command?: "clear";
  enabled?: boolean;
  error?: string;
}

export interface ThreeDToolOptions {
  enabled?: boolean;
  emitSelectionEvents?: boolean;
  distance?: number;
  valuePercent?: number;
  x?: number;
  y?: number;
  z?: number;
  requestId?: string;
  timeoutMs?: number;
}

export interface ThreeDToolResult {
  success: boolean;
  requestId?: string;
  enabled?: boolean;
  emitSelectionEvents?: boolean;
  error?: string;
}

export interface StampPanelResult {
  success: boolean;
  requestId?: string;
  command?: "open" | "close" | "toggle";
  opened?: boolean;
  error?: string;
}

export interface StampUploadOptions {
  urls: string[];
  openStampPanel?: boolean;
  requestId?: string;
  timeoutMs?: number;
}

export interface StampUploadItemResult {
  source: string;
  success: boolean;
  duplicate?: boolean;
  stamp?: {
    id: unknown;
    name: string;
    src: string;
    type: string;
    width: number;
    height: number;
    originalFileName?: string;
  };
  error?: string;
}

export interface StampUploadResult {
  success: boolean;
  requestId?: string;
  opened?: boolean;
  results: StampUploadItemResult[];
  error?: string;
}

export interface CustomToolbarButtonOptions {
  target?: "topnav" | "annotation";
  id: string;
  label: string;
  icon?: string;
  svgIcon?: string;
  toggle?: boolean;
}

export interface RemoveToolbarButtonOptions {
  target?: "topnav" | "annotation";
  id: string;
}

export interface ThreeDPartSelectedEvent {
  eventVersion: "1.0";
  selectedAt: string;
  file?: {
    id?: string | number;
    name?: string;
    type?: string;
    index?: number;
  };
  part?: {
    id?: string | number;
    expressId?: string | number;
    globalId?: string;
    name?: string;
    type?: string;
  };
  properties: Record<string, unknown>;
  display: Array<{ label: string; value: string }>;
}

export interface ThreeDPartSelectionClearedEvent {
  eventVersion: "1.0";
  clearedAt: string;
}

export interface ToolbarClickEvent {
  id: string;
  active: boolean;
}

export interface ToolsThreeDEventMap {
  partSelected: ThreeDPartSelectedEvent;
  selectionCleared: ThreeDPartSelectionClearedEvent;
}

export interface ToolsToolbarEventMap {
  click: ToolbarClickEvent;
}

export type ToolsThreeDEventName = keyof ToolsThreeDEventMap;
export type ToolsThreeDEventHandler<TEventName extends ToolsThreeDEventName> =
  DomainEventHandler<ToolsThreeDEventMap[TEventName]>;
export type ToolsToolbarEventName = keyof ToolsToolbarEventMap;
export type ToolsToolbarEventHandler<TEventName extends ToolsToolbarEventName> =
  DomainEventHandler<ToolsToolbarEventMap[TEventName]>;
export type ToolsEventUnsubscribe = DomainEventUnsubscribe;

export interface ToolsApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
}

interface RequestResultMessage<TPayload> extends CanvasMessage<TPayload> {
  requestId?: string;
  success?: boolean;
  id?: string;
  active?: boolean;
}

interface RequestPayload {
  requestId?: string;
  [key: string]: unknown;
}

export class ToolsApi {
  readonly navigation: ToolsNavigationApi;
  readonly threeD: ToolsThreeDApi;
  readonly stamps: ToolsStampsApi;
  readonly symbols: ToolsSymbolsApi;
  readonly toolbar: ToolsToolbarApi;

  private readonly getBroker: () => CanvasMessageBroker | null;
  private readonly getIsReady: () => boolean;
  private readonly commandTimeoutMs: number;

  constructor(options: ToolsApiOptions) {
    this.getBroker = options.getBroker;
    this.getIsReady = options.getIsReady;
    this.commandTimeoutMs = options.commandTimeoutMs;
    this.navigation = new ToolsNavigationApi(options);
    this.threeD = new ToolsThreeDApi(options);
    this.stamps = new ToolsStampsApi(options);
    this.symbols = new ToolsSymbolsApi(options);
    this.toolbar = new ToolsToolbarApi(options);
  }

  set(options: ToolSetOptions): Promise<ToolControlResult> {
    return this.sendWithResult<ToolControlResult>(
      "toolControlV2",
      "toolControlV2Result",
      {
        requestId: options.requestId,
        group: options.group,
        action: options.action,
        enabled: options.enabled,
        style: options.style
      },
      options.timeoutMs
    );
  }

  clear(): void {
    this.sendFireAndForget("toolControl", {
      command: "clear"
    });
  }

  canvasControl(options: CanvasToolControlOptions): void {
    this.sendFireAndForget("toolControl", options);
  }

  private sendFireAndForget<TPayload>(type: string, payload: TPayload): void {
    if (!this.getIsReady()) {
      throw createViewerNotReadyError(
        "RasterexViewer must be ready before using viewer.tools.",
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

    broker.send(type, payload);
  }

  private sendWithResult<TResult extends { success: boolean; error?: string }>(
    type: string,
    resultType: string,
    payload: RequestPayload,
    timeoutMs = this.commandTimeoutMs
  ): Promise<TResult> {
    return sendCanvasCommandWithResult({
      getBroker: this.getBroker,
      getIsReady: this.getIsReady,
      type,
      resultType,
      payload,
      timeoutMs
    });
  }
}

export class ToolsNavigationApi {
  private readonly options: ToolsApiOptions;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  set(options: NavigationToolSetOptions): Promise<NavigationToolControlResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "navigationToolControl",
      resultType: "navigationToolControlResult",
      payload: {
        requestId: options.requestId,
        action: options.action,
        enabled: options.enabled,
        value: options.value,
        searchText: options.searchText,
        searchCaseSensitive: options.searchCaseSensitive,
        searchForward: options.searchForward
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs
    });
  }

  clear(
    options: { requestId?: string; timeoutMs?: number } = {}
  ): Promise<NavigationToolControlResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "navigationToolControl",
      resultType: "navigationToolControlResult",
      payload: {
        requestId: options.requestId,
        command: "clear"
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs
    });
  }
}

export class ToolsThreeDApi {
  private readonly options: ToolsApiOptions;
  private readonly events = new DomainEventEmitter<ToolsThreeDEventMap>();
  private partSelectedCleanup: (() => void) | null = null;
  private selectionClearedCleanup: (() => void) | null = null;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  on<TEventName extends ToolsThreeDEventName>(
    eventName: TEventName,
    handler: ToolsThreeDEventHandler<TEventName>
  ): ToolsEventUnsubscribe {
    this.ensureEventBridge(eventName);
    return this.events.on(eventName, handler);
  }

  setBirdEyeView(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("setBirdEyeView", options);
  }

  resetModel(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("reset3DModel", options);
  }

  setSelect(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DSelect", options);
  }

  setMarkupSelect(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DMarkupSelect", options);
  }

  setWalkthrough(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DWalkthrough", options);
  }

  setHidePartsMode(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DHidePartsMode", options);
  }

  setExplode(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DExplode", options);
  }

  setTransparency(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DTransparency", options);
  }

  setCrossSection(options: ThreeDToolOptions = {}): Promise<ThreeDToolResult> {
    return this.send("set3DCrossSection", options);
  }

  private send(
    type: string,
    options: ThreeDToolOptions
  ): Promise<ThreeDToolResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type,
      resultType: `${type}Result`,
      payload: {
        requestId: options.requestId,
        enabled: options.enabled,
        emitSelectionEvents: options.emitSelectionEvents,
        distance: options.distance,
        valuePercent: options.valuePercent,
        x: options.x,
        y: options.y,
        z: options.z
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs
    });
  }

  private ensureEventBridge(eventName: ToolsThreeDEventName): void {
    const broker = requireReadyBroker({
      ...this.options,
      type: eventName
    });

    if (eventName === "partSelected" && !this.partSelectedCleanup) {
      this.partSelectedCleanup = broker.on<ThreeDPartSelectedEvent>(
        "threeDPartSelected",
        (message) => {
          if (message.payload) {
            this.events.emit("partSelected", message.payload);
          }
        }
      );
    }

    if (eventName === "selectionCleared" && !this.selectionClearedCleanup) {
      this.selectionClearedCleanup = broker.on<ThreeDPartSelectionClearedEvent>(
        "threeDPartSelectionCleared",
        (message) => {
          if (message.payload) {
            this.events.emit("selectionCleared", message.payload);
          }
        }
      );
    }
  }
}

export class ToolsStampsApi {
  private readonly options: ToolsApiOptions;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  open(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("open", options);
  }

  close(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("close", options);
  }

  toggle(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("toggle", options);
  }

  upload(options: StampUploadOptions): Promise<StampUploadResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "uploadStamp",
      resultType: "uploadStampResult",
      payload: {
        requestId: options.requestId,
        urls: options.urls,
        openStampPanel: options.openStampPanel
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs
    });
  }

  private control(
    command: "open" | "close" | "toggle",
    options: { requestId?: string; timeoutMs?: number }
  ): Promise<StampPanelResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "stampControl",
      resultType: "stampControlResult",
      payload: {
        requestId: options.requestId,
        command
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs
    });
  }
}

export class ToolsSymbolsApi {
  private readonly options: ToolsApiOptions;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  open(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("open", options);
  }

  close(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("close", options);
  }

  toggle(options: { requestId?: string; timeoutMs?: number } = {}): Promise<StampPanelResult> {
    return this.control("toggle", options);
  }

  private control(
    command: "open" | "close" | "toggle",
    options: { requestId?: string; timeoutMs?: number }
  ): Promise<StampPanelResult> {
    return sendCanvasCommandWithResult({
      ...this.options,
      type: "symbolsControl",
      resultType: "symbolsControlResult",
      payload: {
        requestId: options.requestId,
        command
      },
      timeoutMs: options.timeoutMs ?? this.options.commandTimeoutMs
    });
  }
}

export class ToolsToolbarApi {
  private readonly options: ToolsApiOptions;
  private readonly events = new DomainEventEmitter<ToolsToolbarEventMap>();
  private clickCleanup: (() => void) | null = null;

  constructor(options: ToolsApiOptions) {
    this.options = options;
  }

  addButton(options: CustomToolbarButtonOptions): void {
    requireReadyBroker({
      ...this.options,
      type: "addToolbarButton"
    }).send("addToolbarButton", options);
  }

  removeButton(options: RemoveToolbarButtonOptions): void {
    requireReadyBroker({
      ...this.options,
      type: "removeToolbarButton"
    }).send("removeToolbarButton", options);
  }

  on<TEventName extends ToolsToolbarEventName>(
    eventName: TEventName,
    handler: ToolsToolbarEventHandler<TEventName>
  ): ToolsEventUnsubscribe {
    if (eventName === "click" && !this.clickCleanup) {
      this.clickCleanup = requireReadyBroker({
        ...this.options,
        type: "toolbarClick"
      }).on("toolbarClick", (message) => {
        const toolbarMessage = message as RequestResultMessage<unknown>;
        const id = toolbarMessage.id;

        if (typeof id === "string") {
          this.events.emit("click", {
            id,
            active: toolbarMessage.active === true
          });
        }
      });
    }

    return this.events.on(eventName, handler);
  }
}

function sendCanvasCommandWithResult<TResult extends { success: boolean; error?: string }>(
  options: Pick<ToolsApiOptions, "getBroker" | "getIsReady"> & {
    type: string;
    resultType: string;
    payload: RequestPayload;
    timeoutMs: number;
  }
): Promise<TResult> {
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
      const payloadRequestId = resultPayload?.requestId;
      const topLevelRequestId = resultMessage.requestId;

      if (
        topLevelRequestId &&
        topLevelRequestId !== requestId &&
        payloadRequestId !== requestId
      ) {
        return;
      }

      if (
        payloadRequestId &&
        payloadRequestId !== requestId &&
        topLevelRequestId !== requestId
      ) {
        return;
      }

      globalThis.clearTimeout(timeoutId);
      cleanup();

      if (!message.payload) {
        reject(createCanvasToolError(options.type, "Canvas returned an empty tool result."));
        return;
      }

      if (message.payload.success === false) {
        reject(
          createCanvasToolError(
            options.type,
            message.payload.error ?? "Canvas tool command failed.",
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

function requireReadyBroker(
  options: Pick<ToolsApiOptions, "getBroker" | "getIsReady"> & { type: string }
): CanvasMessageBroker {
  if (!options.getIsReady()) {
    throw createViewerNotReadyError(
      "RasterexViewer must be ready before using viewer.tools.",
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

function createCanvasToolError(
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
  return `tools-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
