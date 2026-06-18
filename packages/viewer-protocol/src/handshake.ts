import type { Capability } from "./capabilities.js";

export const VIEWER_READY_MESSAGE_TYPE = "viewer.ready";

export interface ViewerReadyMessage {
  type: typeof VIEWER_READY_MESSAGE_TYPE;
  sdkInstanceId: string;
  canvasSessionId: string;
  protocolVersion: string;
  canvasVersion: string;
  buildDate: string;
  capabilities: readonly Capability[];
  minimumSdkVersion: string;
}
