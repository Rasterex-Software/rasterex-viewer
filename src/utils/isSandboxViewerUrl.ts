import { DEFAULT_VIEWER_URL } from "../constants.js";

const DEFAULT_VIEWER_ORIGIN = new URL(DEFAULT_VIEWER_URL).origin;

export function isSandboxViewerUrl(viewerUrl: string): boolean {
  return new URL(viewerUrl).origin === DEFAULT_VIEWER_ORIGIN;
}
