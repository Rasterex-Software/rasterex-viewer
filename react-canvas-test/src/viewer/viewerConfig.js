export const CANVAS_URL = "https://beta.viewer.viewsoft.com/";
export const DEFAULT_DOCUMENT_URL = "https://pdfobject.com/pdf/sample.pdf";

export const viewerOptions = {
  viewerUrl: CANVAS_URL,
  iframeTitle: "Rasterex Canvas Viewer",
  debug: true,
  readyTimeoutMs: 45000,
  commandTimeoutMs: 60000,
  iframeAttributes: {
    allow: "fullscreen"
  }
};

