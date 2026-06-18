export function subscribeToDiagnosticsEvents(viewer, dispatch) {
  return [
    viewer.diagnostics.on("iframe.mount.resolved", (event) => {
      dispatchDiagnostic(dispatch, "iframe mounted", event);
    }),
    viewer.diagnostics.on("handshake.complete", (event) => {
      dispatchDiagnostic(dispatch, "viewer ready", event);
    }),
    viewer.diagnostics.on("compatibility.warning", (event) => {
      dispatchDiagnostic(dispatch, "compatibility note", event);
    }),
    viewer.diagnostics.on("canvas.command.sent", (event) => {
      dispatchDiagnostic(dispatch, "command sent", event);
    }),
    viewer.diagnostics.on("canvas.event.received", (event) => {
      dispatchDiagnostic(dispatch, "viewer event", event);
    }),
    viewer.diagnostics.on("transport.error", (event) => {
      dispatchDiagnostic(dispatch, "transport error", event);
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

