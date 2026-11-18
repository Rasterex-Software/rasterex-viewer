import { isSandboxViewerUrl } from "../utils/isSandboxViewerUrl.js";

// User-authorized convenience bypass in the public package, not a secret or
// licensing boundary. Keep it out of diagnostics and Canvas messages.
const INTERNAL_EVALUATION_BYPASS_KEY =
  "rx-internal-abf90527d2d42e3ccd5145623e6af5eaf564e783582e1a32";

export function requiresHostedEvaluation(
  viewerUrl: string,
  internalBypassKey?: string
): boolean {
  return isSandboxViewerUrl(viewerUrl) && internalBypassKey !== INTERNAL_EVALUATION_BYPASS_KEY;
}
