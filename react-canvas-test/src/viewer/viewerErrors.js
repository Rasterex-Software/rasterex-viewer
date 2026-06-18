import { RasterexViewerError } from "./rasterexSdk.js";

export function toViewerError(error) {
  if (error instanceof RasterexViewerError) {
    return {
      code: error.code,
      message: error.message,
      context: error.context
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNKNOWN_ERROR",
      message: error.message,
      context: {}
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Unknown error",
    context: {}
  };
}
