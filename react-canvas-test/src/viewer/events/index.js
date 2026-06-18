import { subscribeToDiagnosticsEvents } from "./diagnosticsEvents.js";
import { subscribeToDocumentEvents } from "./documentEvents.js";

export function subscribeToViewerEvents(viewer, dispatch) {
  return [
    ...subscribeToDiagnosticsEvents(viewer, dispatch),
    ...subscribeToDocumentEvents(viewer, dispatch)
  ];
}

