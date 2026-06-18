export { PROTOCOL_VERSION, SDK_NAME } from "./constants.js";
export { CAPABILITIES } from "./capabilities.js";
export {
  ERROR_CODES,
  ERROR_DETECTION_CONFIDENCE
} from "./errors.js";
export { VIEWER_READY_MESSAGE_TYPE } from "./handshake.js";

export type { Capability } from "./capabilities.js";
export type {
  CompatibilityResult,
  CompatibilityState
} from "./compatibility.js";
export type {
  MessageEnvelope,
  ProtocolIncomingMessage,
  ResponseEnvelope
} from "./envelope.js";
export type {
  ErrorCode,
  ErrorDetectionConfidence,
  ProtocolErrorPayload
} from "./errors.js";
export type { ViewerReadyMessage } from "./handshake.js";
