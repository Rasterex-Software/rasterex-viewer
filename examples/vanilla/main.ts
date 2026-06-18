import { createViewer } from "../../src";
import { takeoffDemo } from "../../src/demo-presets";

const viewer = createViewer({
  container: "#viewer",
  viewerUrl: takeoffDemo.viewerUrl,
  targetOrigin: takeoffDemo.targetOrigin,
  iframeTitle: takeoffDemo.label,
  iframeAttributes: {
    allow: "fullscreen"
  }
});

void viewer.mount();
