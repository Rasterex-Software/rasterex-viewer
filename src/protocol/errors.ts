export const ERROR_CODES = {
  sslMixedContent: "SSL_MIXED_CONTENT",
  canvasUnreachable: "CANVAS_UNREACHABLE",
  canvasIframeError: "CANVAS_IFRAME_ERROR",
  canvasLoadTimeout: "CANVAS_LOAD_TIMEOUT",
  canvasReadyTimeout: "CANVAS_READY_TIMEOUT",
  originMismatch: "ORIGIN_MISMATCH",
  basePathMismatch: "BASE_PATH_MISMATCH",
  incompatibleCanvas: "INCOMPATIBLE_CANVAS",
  degradedCanvas: "DEGRADED_CANVAS",
  incompatibleSdk: "INCOMPATIBLE_SDK",
  capabilityNotSupported: "CAPABILITY_NOT_SUPPORTED",
  viewerNotReady: "VIEWER_NOT_READY",
  commandTimeout: "COMMAND_TIMEOUT",
  documentLoadFailed: "DOCUMENT_LOAD_FAILED",
  evaluationExpired: "EVALUATION_EXPIRED",
  invalidToken: "INVALID_TOKEN",
  evaluationRegistrationRequired: "EVALUATION_REGISTRATION_REQUIRED",
  evaluationRegistrationFailed: "EVALUATION_REGISTRATION_FAILED",
  evaluationValidationFailed: "EVALUATION_VALIDATION_FAILED",
  unknownCommand: "UNKNOWN_COMMAND"
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ErrorDetectionConfidence =
  | "RELIABLE"
  | "TIMEOUT_BASED"
  | "BEST_EFFORT";

export const ERROR_DETECTION_CONFIDENCE = {
  [ERROR_CODES.sslMixedContent]: "RELIABLE",
  [ERROR_CODES.canvasUnreachable]: "BEST_EFFORT",
  [ERROR_CODES.canvasIframeError]: "BEST_EFFORT",
  [ERROR_CODES.canvasLoadTimeout]: "TIMEOUT_BASED",
  [ERROR_CODES.canvasReadyTimeout]: "TIMEOUT_BASED",
  [ERROR_CODES.originMismatch]: "RELIABLE",
  [ERROR_CODES.basePathMismatch]: "BEST_EFFORT",
  [ERROR_CODES.incompatibleCanvas]: "RELIABLE",
  [ERROR_CODES.degradedCanvas]: "RELIABLE",
  [ERROR_CODES.incompatibleSdk]: "RELIABLE",
  [ERROR_CODES.capabilityNotSupported]: "RELIABLE",
  [ERROR_CODES.viewerNotReady]: "RELIABLE",
  [ERROR_CODES.commandTimeout]: "TIMEOUT_BASED",
  [ERROR_CODES.documentLoadFailed]: "RELIABLE",
  [ERROR_CODES.evaluationExpired]: "RELIABLE",
  [ERROR_CODES.invalidToken]: "RELIABLE",
  [ERROR_CODES.evaluationRegistrationRequired]: "RELIABLE",
  [ERROR_CODES.evaluationRegistrationFailed]: "BEST_EFFORT",
  [ERROR_CODES.evaluationValidationFailed]: "BEST_EFFORT",
  [ERROR_CODES.unknownCommand]: "RELIABLE"
} as const satisfies Record<ErrorCode, ErrorDetectionConfidence>;

export interface ProtocolErrorPayload {
  code: ErrorCode;
  message: string;
  context?: Record<string, unknown>;
}
