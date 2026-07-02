import type {
  Capability,
  CompatibilityResult
} from "./protocol/index.js";

export interface RasterexViewerOptions {
  container: HTMLElement | string;
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
  capabilities: readonly Capability[] | null;
  minimumSdkVersion: string | null;
  compatibility: CompatibilityResult | null;
}
