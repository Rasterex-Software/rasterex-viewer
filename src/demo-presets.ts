export const takeoffDemo = {
  id: "takeoff",
  label: "Takeoff Demo",
  viewerUrl: "https://takeoff.viewsoft.com",
  targetOrigin: "https://takeoff.viewsoft.com",
  capabilities: ["iframe"] as const
};

export const DEMO_VIEWER_PRESETS = {
  takeoff: takeoffDemo
};
