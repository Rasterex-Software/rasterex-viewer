# Rasterex Canvas React Example

Customer-facing React example for embedding Rasterex Canvas through the Rasterex Viewer SDK.

It mounts:

```txt
https://beta.viewer.viewsoft.com/
```

It demonstrates:

* creating a viewer with `createViewer`
* mounting the hosted Canvas iframe
* waiting for viewer readiness
* opening a document with `viewer.documents.open(...)`
* showing a polished application shell around the embedded viewer
* exposing diagnostics as an advanced detail

## Example Structure

The example is intentionally split like an enterprise React app instead of putting SDK setup, lifecycle, and UI in one component.

```txt
src/
  App.jsx                         page composition only
  components/
    TopBar.jsx                    application chrome
    ViewerCanvas.jsx              iframe mount surface
    SidePanel.jsx                 right-side workflow container
    DocumentOpenPanel.jsx         document URL form
    ConnectionPanel.jsx           viewer state and Canvas metadata
    DiagnosticsPanel.jsx          infrastructure diagnostics
    ViewerMessages.jsx            error and success states
  viewer/
    viewerConfig.js               Canvas URL and SDK timeout options
    useRasterexViewer.js          SDK lifecycle and command orchestration
    events/
      index.js                    central event subscription registry
      diagnosticsEvents.js        infrastructure diagnostic subscriptions
      documentEvents.js           stable document domain subscriptions
    state/
      initialViewerState.js       initial reducer state
      viewerReducer.js            status, error, result, and diagnostics transitions
    rasterexSdk.js                SDK import boundary for local vs published package
    viewerErrors.js               RasterexViewerError normalization
    documentNames.js              document display-name helper
    viewerStatus.js               UI status labels
```

Most consuming applications should keep SDK lifecycle orchestration in a hook or service like `viewer/useRasterexViewer.js`, keep grouped subscriptions in `viewer/events/`, and keep UI transitions in a reducer under `viewer/state/`.

## Run

From the repo root:

```powershell
npm.cmd run build
cd react-canvas-test
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1
```

Open the URL printed by Vite.

## SDK Import Boundary

The example imports the SDK through one local boundary file:

```js
// src/viewer/rasterexSdk.js
export { RasterexViewerError, createViewer } from "../../../dist/index.js";
```

For a consuming application, change only that file to use the published package:

```js
export { RasterexViewerError, createViewer } from "@rasterex/viewer";
```

## Main Flow

This example intentionally uses the explicit enterprise lifecycle in `src/viewer/useRasterexViewer.js`:

```js
const viewer = createViewer({
  container: containerRef.current,
  ...viewerOptions
});

await viewer.mount();
await viewer.ready();

await viewer.documents.open({
  url: documentUrl,
  displayName: getDisplayName(documentUrl)
});
```

For a smaller quick-start screen, the SDK also provides `createDocumentViewer(...)`:

```js
const viewer = await createDocumentViewer({
  container: containerRef.current,
  ...viewerOptions,
  document: {
    url: "https://pdfobject.com/pdf/sample.pdf",
    displayName: "sample.pdf"
  }
});
```

This example does not use the helper because it demonstrates lifecycle state, diagnostics, document events, and cleanup patterns that enterprise apps usually need.

The example subscribes to stable SDK document events in `src/viewer/events/documentEvents.js`:

```js
viewer.documents.on("opening", handler);
viewer.documents.on("opened", handler);
viewer.documents.on("failed", handler);
viewer.documents.on("pageChanged", handler);
```

Raw Canvas events such as `fileInfo`, `fileTabs`, and `pageList` are intentionally not used by the React UI. They remain available through `viewer.canvas` for advanced integrations.

## Event Architecture

The React example treats SDK events as the source of UI transitions:

```txt
SDK event -> viewer/events/* -> dispatch(action) -> viewerReducer -> UI props
```

That keeps the app manageable when more document, annotation, measurement, tool, and layer events are added. New event groups should be added as separate files under `src/viewer/events/`, then registered in `src/viewer/events/index.js`.
