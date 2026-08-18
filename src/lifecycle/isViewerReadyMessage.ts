import {
  VIEWER_READY_MESSAGE_TYPE,
  type ViewerReadyMessage
} from "../protocol/index.js";

export function isViewerReadyMessage(
  message: unknown,
  sdkInstanceId: string
): message is ViewerReadyMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<ViewerReadyMessage>;

  return (
    candidate.type === VIEWER_READY_MESSAGE_TYPE &&
    candidate.sdkInstanceId === sdkInstanceId &&
    typeof candidate.canvasSessionId === "string" &&
    typeof candidate.protocolVersion === "string" &&
    typeof candidate.canvasVersion === "string" &&
    typeof candidate.buildDate === "string" &&
    Array.isArray(candidate.capabilities) &&
    typeof candidate.minimumSdkVersion === "string"
  );
}
