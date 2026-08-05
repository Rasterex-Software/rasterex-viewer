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
export interface StylesApiOptions { getBroker: () => CanvasMessageBroker | null; getIsReady: () => boolean; commandTimeoutMs: number; }
