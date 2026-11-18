import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";

export interface GlobalAppearanceOptions {
  strokeColor?: string;
  fillColor?: string;
  textColor?: string;
  lineWidth?: number;
  lineStyle?: number;
  transparency?: number;
}

export interface AnnotationProperties {
  strokeColor?: string;
  fillColor?: string;
  textColor?: string;
  lineWidth?: number;
  lineStyle?: number;
  transparency?: number;
  locked?: boolean;
  text?: string;
  countType?: number;
  arrowType?: number;
  measureType?: number;
}

export interface GetAnnotationPropertiesOptions { guid: string; timeoutMs?: number; }
export interface SetAnnotationPropertiesOptions { guid: string; props: AnnotationProperties; }
export interface AnnotationPropertiesResult { guid: string; success: boolean; props?: AnnotationProperties; error?: string; [key: string]: unknown; }
export type MeasurementAppearanceMode = "legacy" | "modern";

export interface SetMeasurementAppearanceOptions {
  mode: MeasurementAppearanceMode;
  requestId?: string;
  timeoutMs?: number;
}

export interface MeasurementAppearanceResult {
  success: boolean;
  mode: MeasurementAppearanceMode;
  requestId: string;
  error?: string;
}

export interface StylesApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
  commandTimeoutMs: number;
  /** Advertised viewer capabilities; required by setMeasurementAppearance. */
  getCapabilities?: () => readonly string[] | null;
}
