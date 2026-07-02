import { PROTOCOL_VERSION, CAPABILITIES } from "../protocol/index.js";

import { SDK_VERSION } from "../constants.js";

export interface CompatibilityMatrixEntry {
  sdkVersion: string;
  protocolVersion: string;
  minimumCanvasVersion: string;
  currentCanvasVersion: string;
  requiredCapabilities: readonly string[];
}

export const SDK_COMPATIBILITY_MATRIX: readonly CompatibilityMatrixEntry[] = [
  {
    sdkVersion: SDK_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    minimumCanvasVersion: "0.0.0",
    currentCanvasVersion: "0.0.0",
    requiredCapabilities: [CAPABILITIES.iframe]
  }
];
