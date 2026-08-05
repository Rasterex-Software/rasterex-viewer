import {
  DEFAULT_TARGET_ORIGIN,
  DEFAULT_VIEWER_URL
} from "./constants.js";

export const sandboxCanvas = {
  id: "sandbox-canvas",
  label: "Sandbox Canvas",
  viewerUrl: DEFAULT_VIEWER_URL,
  targetOrigin: DEFAULT_TARGET_ORIGIN,
  capabilities: ["iframe"] as const
};

export const betaViewerDemo = sandboxCanvas;

export const DEMO_VIEWER_PRESETS = {
  sandboxCanvas,
  betaViewer: sandboxCanvas
};
