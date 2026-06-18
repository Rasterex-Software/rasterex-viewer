import { toViewerError } from "../viewerErrors.js";

export function subscribeToDocumentEvents(viewer, dispatch) {
  return [
    viewer.documents.on("opening", (event) => {
      dispatchDiagnostic(dispatch, "document opening", event);
      dispatch({ type: "document.opening" });
    }),
    viewer.documents.on("opened", (event) => {
      dispatchDiagnostic(dispatch, "document opened", event);
      dispatch({
        type: "document.opened",
        result: event,
        info: viewer.getInfo()
      });
    }),
    viewer.documents.on("failed", (event) => {
      dispatchDiagnostic(dispatch, "document failed", event);
      dispatch({
        type: "document.failed",
        error: toViewerError(event.error),
        info: viewer.getInfo()
      });
    }),
    viewer.documents.on("pageChanged", (event) => {
      dispatchDiagnostic(dispatch, "page changed", event);
    })
  ];
}

function dispatchDiagnostic(dispatch, name, payload) {
  dispatch({
    type: "diagnostic.received",
    name,
    payload
  });
}

