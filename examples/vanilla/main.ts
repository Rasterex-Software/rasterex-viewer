import { createViewer } from "../../src";

const viewer = createViewer({
  container: "#viewer",
  iframeAttributes: {
    allow: "fullscreen"
  }
});

void viewer.mount();
