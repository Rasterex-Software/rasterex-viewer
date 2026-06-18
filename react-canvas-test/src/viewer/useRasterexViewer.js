import { useCallback, useEffect, useReducer, useRef } from "react";
import { getDisplayName } from "./documentNames.js";
import { subscribeToViewerEvents } from "./events/index.js";
import { createViewer } from "./rasterexSdk.js";
import { initialViewerState } from "./state/initialViewerState.js";
import { viewerReducer } from "./state/viewerReducer.js";
import { toViewerError } from "./viewerErrors.js";
import { viewerOptions } from "./viewerConfig.js";
import { VIEWER_STATUS } from "./viewerStatus.js";

export function useRasterexViewer() {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const eventCleanupsRef = useRef([]);
  const [state, dispatch] = useReducer(viewerReducer, initialViewerState);

  const isReady = state.info?.state === "ready";
  const isBusy =
    state.status === VIEWER_STATUS.mounting ||
    state.status === VIEWER_STATUS.opening;

  const cleanupViewer = useCallback(() => {
    for (const cleanup of eventCleanupsRef.current) {
      cleanup();
    }

    eventCleanupsRef.current = [];
    viewerRef.current?.destroy();
    viewerRef.current = null;
  }, []);

  const refreshInfo = useCallback(() => {
    const viewer = viewerRef.current;

    if (viewer) {
      dispatch({
        type: "viewer.infoRefreshed",
        info: viewer.getInfo()
      });
    }
  }, []);

  const mountViewer = useCallback(async () => {
    cleanupViewer();
    dispatch({ type: "viewer.mounting" });

    const viewer = createViewer({
      container: containerRef.current,
      ...viewerOptions
    });

    viewerRef.current = viewer;
    eventCleanupsRef.current = subscribeToViewerEvents(viewer, dispatch);

    try {
      await viewer.mount();
      dispatch({
        type: "viewer.mounted",
        info: viewer.getInfo()
      });

      await viewer.ready();
      dispatch({
        type: "viewer.ready",
        info: viewer.getInfo()
      });
    } catch (caughtError) {
      dispatch({
        type: "viewer.failed",
        error: toViewerError(caughtError),
        info: viewer.getInfo()
      });
    }
  }, [cleanupViewer]);

  const stopViewer = useCallback(() => {
    cleanupViewer();
    dispatch({ type: "viewer.destroyed" });
  }, [cleanupViewer]);

  const openDocument = useCallback(async (documentUrl) => {
    const viewer = viewerRef.current;
    const url = documentUrl.trim();

    if (!viewer || !url) {
      return;
    }

    try {
      await viewer.documents.open({
        url,
        displayName: getDisplayName(url)
      });
    } catch (caughtError) {
      dispatch({
        type: "document.failed",
        error: toViewerError(caughtError),
        info: viewer.getInfo()
      });
    }
  }, []);

  useEffect(() => {
    const startMount = globalThis.setTimeout(() => {
      mountViewer();
    }, 0);

    return () => {
      globalThis.clearTimeout(startMount);
      cleanupViewer();
    };
  }, [cleanupViewer, mountViewer]);

  return {
    containerRef,
    status: state.status,
    info: state.info,
    error: state.error,
    openResult: state.openResult,
    diagnostics: state.diagnostics,
    isReady,
    isBusy,
    mountViewer,
    stopViewer,
    openDocument,
    refreshInfo
  };
}
