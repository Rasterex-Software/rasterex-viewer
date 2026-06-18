import { VIEWER_STATUS } from "../viewerStatus.js";

export const initialViewerState = {
  status: VIEWER_STATUS.idle,
  info: null,
  error: null,
  openResult: null,
  diagnostics: []
};

