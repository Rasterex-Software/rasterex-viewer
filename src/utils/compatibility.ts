import type {
  Capability,
  CompatibilityResult
} from "../protocol/index.js";

import { PROTOCOL_VERSION, ERROR_CODES } from "../protocol/index.js";
import { SDK_VERSION } from "../constants.js";
import { SDK_COMPATIBILITY_MATRIX } from "../compat/matrix.js";
import { RasterexViewerError } from "../errors.js";

export interface EvaluateCompatibilityOptions {
  protocolVersion: string;
  canvasVersion: string;
  minimumSdkVersion: string;
  capabilities: readonly Capability[];
}

export interface CompatibilityEvaluation {
  result: CompatibilityResult;
  error: RasterexViewerError | null;
}

export function evaluateCompatibility(
  options: EvaluateCompatibilityOptions
): CompatibilityEvaluation {
  const invalidVersionField = getInvalidVersionField({
    sdkVersion: SDK_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    canvasProtocolVersion: options.protocolVersion,
    canvasVersion: options.canvasVersion,
    minimumSdkVersion: options.minimumSdkVersion
  });

  if (invalidVersionField) {
    return {
      result: {
        state: "incompatible",
        reason: `Invalid compatibility version value: ${invalidVersionField}.`
      },
      error: new RasterexViewerError({
        code: ERROR_CODES.incompatibleCanvas,
        message: `Invalid compatibility version value: ${invalidVersionField}.`,
        canvasVersion: options.canvasVersion,
        context: {
          field: invalidVersionField,
          sdkVersion: SDK_VERSION,
          protocolVersion: PROTOCOL_VERSION,
          canvasProtocolVersion: options.protocolVersion,
          canvasVersion: options.canvasVersion,
          minimumSdkVersion: options.minimumSdkVersion
        }
      })
    };
  }

  const matrixEntry = SDK_COMPATIBILITY_MATRIX.find(
    (entry) =>
      entry.sdkVersion === SDK_VERSION &&
      entry.protocolVersion === PROTOCOL_VERSION
  );

  if (!matrixEntry) {
    return {
      result: {
        state: "incompatible",
        reason: "No compatibility matrix entry exists for this SDK/protocol pair."
      },
      error: new RasterexViewerError({
        code: ERROR_CODES.incompatibleCanvas,
        message: "No compatibility matrix entry exists for this SDK/protocol pair.",
        context: {
          sdkVersion: SDK_VERSION,
          protocolVersion: PROTOCOL_VERSION
        }
      })
    };
  }

  if (options.protocolVersion !== PROTOCOL_VERSION) {
    return {
      result: {
        state: "incompatible",
        reason: "Canvas protocol version does not match SDK protocol version."
      },
      error: new RasterexViewerError({
        code: ERROR_CODES.incompatibleCanvas,
        message: "Canvas protocol version does not match SDK protocol version.",
        canvasVersion: options.canvasVersion,
        context: {
          sdkProtocolVersion: PROTOCOL_VERSION,
          canvasProtocolVersion: options.protocolVersion
        }
      })
    };
  }

  if (compareVersions(options.canvasVersion, matrixEntry.minimumCanvasVersion) < 0) {
    return {
      result: {
        state: "incompatible",
        reason: "Canvas version is below the minimum supported version."
      },
      error: new RasterexViewerError({
        code: ERROR_CODES.incompatibleCanvas,
        message: "Canvas version is below the minimum supported version.",
        canvasVersion: options.canvasVersion,
        context: {
          canvasVersion: options.canvasVersion,
          minimumCanvasVersion: matrixEntry.minimumCanvasVersion
        }
      })
    };
  }

  if (compareVersions(SDK_VERSION, options.minimumSdkVersion) < 0) {
    return {
      result: {
        state: "incompatible",
        reason: "SDK version is below the minimum version required by Canvas."
      },
      error: new RasterexViewerError({
        code: ERROR_CODES.incompatibleSdk,
        message: "SDK version is below the minimum version required by Canvas.",
        canvasVersion: options.canvasVersion,
        context: {
          sdkVersion: SDK_VERSION,
          minimumSdkVersion: options.minimumSdkVersion
        }
      })
    };
  }

  const unsupportedCapabilities = matrixEntry.requiredCapabilities.filter(
    (capability) => !options.capabilities.includes(capability as Capability)
  );

  if (unsupportedCapabilities.length > 0) {
    return {
      result: {
        state: "degraded",
        reason: "Canvas does not advertise all SDK-required capabilities.",
        unsupportedCapabilities
      },
      error: null
    };
  }

  if (compareVersions(options.canvasVersion, matrixEntry.currentCanvasVersion) < 0) {
    return {
      result: {
        state: "degraded",
        reason: "Canvas version is supported but older than the current SDK target."
      },
      error: null
    };
  }

  return {
    result: {
      state: "compatible"
    },
    error: null
  };
}

export function compareVersions(left: string, right: string): number {
  assertVersion(left, "left");
  assertVersion(right, "right");

  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

function getInvalidVersionField(
  versions: Record<string, string>
): string | null {
  for (const [field, version] of Object.entries(versions)) {
    if (!isVersionString(version)) {
      return field;
    }
  }

  return null;
}

function assertVersion(version: string, label: string): void {
  if (!isVersionString(version)) {
    throw new RangeError(`${label} must be a dot-separated numeric version.`);
  }
}

function isVersionString(version: string): boolean {
  return /^\d+(?:\.\d+)*$/.test(version);
}

function parseVersionParts(version: string): number[] {
  return version
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10));
}
