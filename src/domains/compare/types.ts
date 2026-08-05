import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";
import type {
  DomainEventHandler,
  DomainEventUnsubscribe
} from "../../utils/DomainEventEmitter.js";

export interface CompareAlignPayload {
  backgroundUrl?: string;
  overlayUrl?: string;
  backgroundFileName?: string;
  overlayFileName?: string;
  outputName?: string;
  dpi?: number;
  backgroundColor?: string;
  overlayColor?: string;
  equalColor?: string;
  alignArray?: Array<Record<string, unknown>>;
}

export interface ComparisonResult {
  relativePath: string;
  outputFileUrl: string;
  activeFile: unknown;
  otherFile: unknown;
  activeFileUrl?: string;
  otherFileUrl?: string;
  activeColor?: unknown;
  otherColor?: unknown;
  activeSetAs?: unknown;
  otherSetAs?: unknown;
  alignarray?: Array<Record<string, unknown>>;
  dpi?: number;
  name?: string;
  index?: number;
  mode?: "compare" | "align";
  backgroundUrl?: string;
  overlayUrl?: string;
}

export interface ComparisonErrorPayload {
  mode?: "compare" | "align";
  message: string;
}

export interface CompareProgressStartEvent {
  message: string;
}

/** @deprecated Canvas comparison-markup save is compatibility-only. */
export interface CompareSaveOptions {
  outputName?: string;
}

export interface CompareEventMap {
  progressStart: CompareProgressStartEvent;
  progressEnd: undefined;
  comparisonComplete: ComparisonResult | undefined;
  comparisonError: ComparisonErrorPayload;
  compareSaveComplete: string | undefined;
  comparisonMarkupChanged: boolean;
}

export type CompareEventName = keyof CompareEventMap;
export type CompareEventHandler<TEventName extends CompareEventName> =
  DomainEventHandler<CompareEventMap[TEventName]>;
export type CompareEventUnsubscribe = DomainEventUnsubscribe;

export interface CompareApiOptions {
  getBroker: () => CanvasMessageBroker | null;
  getIsReady: () => boolean;
}
