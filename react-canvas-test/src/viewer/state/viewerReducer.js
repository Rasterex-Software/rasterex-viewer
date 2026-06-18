import { VIEWER_STATUS } from "../viewerStatus.js";

const MAX_DIAGNOSTIC_ITEMS = 10;

export function viewerReducer(state, action) {
  switch (action.type) {
    case "viewer.mounting":
      return {
        ...state,
        status: VIEWER_STATUS.mounting,
        info: null,
        error: null,
        openResult: null,
        diagnostics: []
      };

    case "viewer.mounted":
      return {
        ...state,
        status: VIEWER_STATUS.mounted,
        info: action.info
      };

    case "viewer.ready":
      return {
        ...state,
        status: VIEWER_STATUS.ready,
        info: action.info
      };

    case "viewer.infoRefreshed":
      return {
        ...state,
        info: action.info
      };

    case "viewer.failed":
      return {
        ...state,
        status: VIEWER_STATUS.error,
        error: action.error,
        info: action.info ?? state.info
      };

    case "viewer.destroyed":
      return {
        ...state,
        status: VIEWER_STATUS.destroyed,
        info: null,
        openResult: null
      };

    case "document.opening":
      return {
        ...state,
        status: VIEWER_STATUS.opening,
        error: null,
        openResult: null
      };

    case "document.opened":
      return {
        ...state,
        status: VIEWER_STATUS.opened,
        openResult: action.result,
        info: action.info ?? state.info
      };

    case "document.failed":
      return {
        ...state,
        status: VIEWER_STATUS.error,
        error: action.error,
        info: action.info ?? state.info
      };

    case "diagnostic.received":
      return {
        ...state,
        diagnostics: [
          createDiagnosticItem(
            action.name,
            action.payload,
            state.diagnostics.length
          ),
          ...state.diagnostics
        ].slice(0, MAX_DIAGNOSTIC_ITEMS)
      };

    default:
      return state;
  }
}

function createDiagnosticItem(name, payload, currentCount) {
  return {
    id: `${Date.now()}-${currentCount}`,
    name,
    time: new Date().toLocaleTimeString(),
    payload: sanitizeDiagnosticPayload(payload)
  };
}

function sanitizeDiagnosticPayload(payload) {
  return {
    sdkInstanceId: payload.sdkInstanceId,
    timestamp: payload.timestamp,
    type: payload.type,
    reason: payload.reason,
    canvasVersion: payload.canvasVersion,
    canvasSessionId: payload.canvasSessionId,
    url: payload.url,
    path: payload.path,
    displayName: payload.displayName,
    activeId: payload.activeId,
    currentPage: payload.currentPage,
    pageCount: payload.pageCount,
    source: payload.source,
    correlation: payload.correlation,
    errorCode: payload.error?.code
  };
}

