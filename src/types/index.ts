import type { CompatibilityResult } from "../protocol/index.js";

export interface RasterexViewerOptions {
  container: HTMLElement | string;
  /** Optional company details and internal evaluation bypass. */
  evaluation?: EvaluationRegistrationOptions;
  viewerUrl?: string;
  targetOrigin?: string;
  connectTimeoutMs?: number;
  readyTimeoutMs?: number;
  commandTimeoutMs?: number;
  debug?: boolean;
  iframeTitle?: string;
  iframeClassName?: string;
  iframeAttributes?: Record<string, string>;
}

export interface EvaluationRegistrationOptions {
  /** Extractable internal convenience key; skips evaluation, not Canvas readiness. */
  internalBypassKey?: string;
  /** Optional company name; provide it together with `email`. */
  company?: string;
  /** Optional email address; provide it together with `company`. */
  email?: string;
}

export interface ViewerReadyOptions {
  signal?: AbortSignal;
}

export type ViewerState =
  | "idle"
  | "mounting"
  | "mounted"
  | "handshaking"
  | "ready"
  | "error"
  | "destroyed";

export interface RasterexViewerInfo {
  sdkInstanceId: string;
  canvasSessionId: string | null;
  sdkVersion: string;
  protocolVersion: string;
  viewerUrl: string;
  targetOrigin: string;
  state: ViewerState;
  canvasVersion: string | null;
  buildDate: string | null;
  /** SDK baseline plus capabilities advertised by the active Canvas viewer. */
  capabilities: readonly string[] | null;
  minimumSdkVersion: string | null;
  compatibility: CompatibilityResult | null;
}
