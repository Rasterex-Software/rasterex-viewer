import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  DomainEventHandler,
  DomainEventUnsubscribe
} from "../../utils/DomainEventEmitter.js";

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
