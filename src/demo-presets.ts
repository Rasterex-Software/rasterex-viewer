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

export const takeoffDemo = {
  id: "takeoff",
  label: "Takeoff Demo",
  viewerUrl: "https://takeoff.viewsoft.com",
  targetOrigin: "https://takeoff.viewsoft.com",
  capabilities: ["iframe"] as const
};

export const DEMO_VIEWER_PRESETS = {
  sandboxCanvas,
  betaViewer: sandboxCanvas,
  takeoff: takeoffDemo
};
