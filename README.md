# Rasterex Viewer SDK

Lightweight, framework-independent npm SDK for embedding hosted Rasterex viewer/demo pages in an iframe.

This package does not include Rasterex Canvas or any hosted demo application. The SDK only creates and manages an iframe that points to a hosted Rasterex URL, such as the fully working Takeoff demo.

## Current Scope

The current SDK provides:

- core iframe lifecycle through `createViewer(...)` and `RasterexViewer`
- explicit `mount()`, `ready()`, command, and `destroy()` flow
- structured errors and diagnostics
- safe `targetOrigin` derivation
- current Canvas document opening through `viewer.documents.open(...)`
- normalized document domain events
- current Canvas tool control through `viewer.tools`
- current Canvas annotation events and data reads through `viewer.annotations`
- advanced raw Canvas access through `viewer.canvas`
- hosted demo presets through `@rasterex/viewer/demo-presets`

Export, save, React package adapters, Vue package adapters, and Angular package adapters are not implemented yet.

## Install

```sh
npm install
```

## Build

```sh
npm run build
```

## Package Entrypoints

```ts
import { createViewer, createDocumentViewer } from "@rasterex/viewer";
import { takeoffDemo } from "@rasterex/viewer/demo-presets";
```

Current public entrypoints:

```txt
@rasterex/viewer               core SDK
@rasterex/viewer/demo-presets  hosted demo URLs only
@rasterex/viewer-protocol      shared protocol constants and types
```

Framework adapter entrypoints such as `@rasterex/viewer/react`, `@rasterex/viewer/vue`, and `@rasterex/viewer/angular` are planned but are not exported yet.

## Quick Start: Document Viewer

For the common case where an app should mount Canvas and immediately open a document, use `createDocumentViewer(...)`:

```ts
import { createDocumentViewer } from "@rasterex/viewer";

const viewer = await createDocumentViewer({
  container: "#viewer",
  viewerUrl: "https://beta.viewer.viewsoft.com/",
  document: {
    url: "https://pdfobject.com/pdf/sample.pdf",
    displayName: "sample.pdf"
  }
});

viewer.destroy();
```

This helper runs the same lifecycle as the full API:

```txt
create -> mount -> ready -> documents.open
```

If the workflow fails before returning, the helper destroys the viewer before rethrowing the original structured error. After a successful return, cleanup is still the caller's responsibility.

## Use the Takeoff Demo Preset

```ts
import { createViewer } from "@rasterex/viewer";
import { takeoffDemo } from "@rasterex/viewer/demo-presets";

const viewer = createViewer({
  container: "#viewer",
  viewerUrl: takeoffDemo.viewerUrl,
  targetOrigin: takeoffDemo.targetOrigin
});

await viewer.mount();

viewer.destroy();
```

`takeoffDemo.viewerUrl` points to `https://takeoff.viewsoft.com`, a hosted demo app. It is loaded as a complete iframe page, not as a Protocol V1 messaging API target.

Demo URLs are only exported from the demo-only subpath:

```ts
import { DEMO_VIEWER_PRESETS, takeoffDemo } from "@rasterex/viewer/demo-presets";
```

The main `@rasterex/viewer` entrypoint does not export hosted demo URLs. This keeps production and air-gapped bundles free of hardcoded external demo URLs unless the application explicitly imports the demo preset entrypoint.

## Use a Custom Viewer URL

```ts
import { createViewer } from "@rasterex/viewer";

const viewer = createViewer({
  container: document.getElementById("viewer")!,
  viewerUrl: "https://your-hosted-rasterex-viewer.example.com",
  targetOrigin: "https://your-hosted-rasterex-viewer.example.com"
});

await viewer.mount();
```

If `targetOrigin` is omitted, the SDK derives it from `viewerUrl`.

Direct class construction also remains supported:

```ts
import { RasterexViewer } from "@rasterex/viewer";

const viewer = new RasterexViewer({
  container: "#viewer"
});
```

## Vanilla Demo

Run the local demo from this SDK repo before the package is published:

```sh
npm install
npm run build
npm run dev
```

Open the URL printed by Vite. The page loads the Takeoff Demo preset in a full-page iframe.

The vanilla demo imports the SDK and demo preset directly from local source code:

```ts
import { createViewer } from "../../src";
import { takeoffDemo } from "../../src/demo-presets";
```

It does not require the package to be published to npm for local testing.

## API

```ts
interface RasterexViewerOptions {
  container: HTMLElement | string;
  viewerUrl?: string;
  targetOrigin?: string;
  connectTimeoutMs?: number;
  readyTimeoutMs?: number;
  commandTimeoutMs?: number;
  debug?: boolean;
  iframeTitle?: string;
  iframeClassName?: string;
  iframeAttributes?: Record<string, string>;
}
```

If `targetOrigin` is omitted, the SDK derives it from `viewerUrl`:

```ts
new URL(viewerUrl).origin
```

`connectTimeoutMs` controls iframe load timeout handling. `readyTimeoutMs` controls viewer readiness timeout handling. `commandTimeoutMs` controls current Canvas document-open and tool-control timeout handling.

## Protocol Readiness

`mount()` confirms that the iframe loaded. `ready()` is reserved for Protocol V1 Canvas deployments that emit a `viewer.ready` handshake.

```ts
await viewer.mount();
await viewer.ready();
```

Hosted demo URLs are not expected to emit Protocol V1 `viewer.ready`, so do not call `ready()` against those demos unless you are testing a Canvas build that implements Protocol V1 or the current Canvas `viewerReady` event.

After `viewer.ready`, the SDK evaluates compatibility as:

```txt
compatible
degraded
incompatible
```

The result is available from `viewer.getInfo().compatibility`.

## Diagnostics

Diagnostics are infrastructure events. They are separate from future Canvas application events.

```ts
const unsubscribe = viewer.diagnostics.on("transport.error", (event) => {
  console.error(event.error);
});

unsubscribe();
```

Set `debug: true` to pipe structured diagnostics to `console.debug`:

```ts
const viewer = new RasterexViewer({
  container: "#viewer",
  debug: true
});
```

## Internal Transport

The package includes an `IframeTransport` class for future protocol phases. It owns low-level `postMessage` send/receive behavior and validates message origin, source iframe window, and `sdkInstanceId`.

The current document, tool, and annotation APIs use the current Canvas message broker. Protocol V1 request/response command transport is still planned.

The package also includes a `MessageClient` request/response primitive for future domain APIs. It is responsible for request IDs, response matching, command timeouts, readiness checks, capability checks, and pending request cleanup.

Export, compare, and layer domain APIs are still planned.

## Open A Document

Current Canvas builds support the file-open message structure described in `helper-docs-postmessage/IFRAME_AND_FILE_LOAD_EVENTS.md`.

For full application control, prefer the explicit lifecycle:

After `mount()` and `ready()`, use:

```ts
const offOpening = viewer.documents.on("opening", (event) => {
  console.log("Opening document", event.url ?? event.path);
});
const offOpened = viewer.documents.on("opened", (event) => {
  console.log("Document opened", event.activeId, event.pageCount);
});
const offFailed = viewer.documents.on("failed", (event) => {
  console.error(event.error.code, event.error.message);
});
const offPageChanged = viewer.documents.on("pageChanged", (event) => {
  console.log("Page", event.currentPage, "of", event.pageCount);
});

const result = await viewer.documents.open({
  url: "/documents/sample.pdf",
  displayName: "sample.pdf",
  cacheId: "optional-cache-id",
  mime: "application/pdf"
});

offOpening();
offOpened();
offFailed();
offPageChanged();
```

With the current Canvas message broker, this sends Canvas command `view` and resolves after the viewer sends file metadata events plus `progressEnd`.

Current Canvas file events are not request-correlated. The SDK marks `viewer.documents.on("opened", ...)` events as inferred from the active Canvas file metadata until Protocol V1 provides request/response envelopes.

Protocol V1 `document.open` request/response is still planned for a future Canvas-side implementation.

## Control Tools

Current Canvas builds support the tool-control message structure described in `TOOL_CONTROL_EVENTS.md`.

After `mount()` and `ready()`, use `viewer.tools` for drawing, annotation, measurement, navigation, 3D, stamp, symbol, and custom toolbar controls:

```ts
await viewer.tools.set({
  action: "SHAPE_RECTANGLE",
  enabled: true,
  style: {
    strokeColor: "#164863",
    fillColor: "#e6f2ff",
    strokeWidth: 2,
    fillOpacity: 0.25
  }
});

await viewer.tools.navigation.set({
  action: "SEARCH_TEXT",
  enabled: true,
  searchText: "pump"
});

await viewer.tools.threeD.setSelect({
  enabled: true,
  emitSelectionEvents: true
});

const offPartSelected = viewer.tools.threeD.on("partSelected", (event) => {
  console.log(event.part, event.properties);
});

await viewer.tools.stamps.open();
await viewer.tools.symbols.toggle();

offPartSelected();
```

`viewer.tools` maps to current Canvas broker events such as `toolControlV2`, `navigationToolControl`, `set3DSelect`, `stampControl`, `symbolsControl`, and `uploadStamp`. This is not yet a Protocol V1 command envelope.

Use `viewer.tools.canvasControl(...)` when you need the grouped Canvas `toolControl` command. New code that needs result handling should prefer `viewer.tools.set(...)`.

## Annotation Events And Data

Current Canvas builds support the annotation message structure described in `ANNOTATION_EVENTS.md`.

After `mount()` and `ready()`, use `viewer.annotations` for annotation selection, unselection, and data reads. Annotation event subscriptions may be registered before readiness:

```ts
const offCreated = viewer.annotations.on("created", (event) => {
  console.log(event.guid, event.data);
});

const offSelected = viewer.annotations.on("selected", (event) => {
  console.log(event.guid, event.dbUniqueID);
});

const offDeleted = viewer.annotations.on("deleted", (event) => {
  console.log(event.guid);
});

await viewer.annotations.getData({
  filter: "annotations"
});

viewer.annotations.select({
  guid: "markup-guid"
});

viewer.annotations.unselect();

offCreated();
offSelected();
offDeleted();
```

Supported annotation events:

```txt
created
createdWithDetail
selected
selectedWithDetail
deleted
deletedWithDetail
```

`viewer.annotations` maps to current Canvas broker events such as `annotationCreated`, `annotationSelected`, `annotationDeleted`, `selectAnnotation`, `unselectAnnotation`, and `getAnnotationData`. This is not yet a Protocol V1 annotation envelope.

`select(...)` and `unselect()` are fire-and-forget because current Canvas does not send explicit result events for those commands.

## Domain APIs

The public SDK should be consumed through stable product domains:

```ts
viewer.documents.open({ url: "/documents/sample.pdf" });
viewer.documents.on("opened", (event) => {
  console.log(event.activeId);
});
```

Current package domains:

```txt
viewer.documents     document open and document events
viewer.tools         drawing, annotation, measurement, navigation, 3D, stamp, symbol, and toolbar controls
viewer.annotations   annotation created/selected/deleted events, selection commands, and data reads
viewer.diagnostics   infrastructure diagnostics
viewer.canvas        advanced raw Canvas message bridge
```

Future domains will follow the same shape, for example `viewer.layers`, `viewer.export`, and `viewer.compare`.

## Advanced Canvas Bridge

Most applications should use domain APIs such as `viewer.documents.open(...)`.

For migration, debugging, or uncommon integrations, the SDK also exposes the current Canvas message broker through `viewer.canvas`:

```ts
const off = viewer.canvas.on("fileInfo", (message) => {
  console.log(message.payload);
});

viewer.canvas.send("view", {
  fileUrl: "https://pdfobject.com/pdf/sample.pdf",
  displayName: "sample.pdf"
});

off();
```

`viewer.canvas` is an advanced escape hatch. New application code should prefer stable SDK domain APIs when they exist.

SDK errors are thrown as structured `RasterexViewerError` instances:

```ts
try {
  await viewer.mount();
} catch (error) {
  if (error instanceof RasterexViewerError) {
    console.error(error.code, error.context, error.timestamp);
  }
}
```

`getInfo()` is safe to call before any future protocol handshake exists:

```ts
console.log(viewer.getInfo());
```

## Version Changes

Each package version should have a matching change note under:

```txt
docs/version-changes/
```

Use those files as source material for generated docs, release notes, and migration guides.
