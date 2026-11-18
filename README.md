# Rasterex Viewer SDK — JavaScript & TypeScript CAD, DWG & PDF Viewer

Embed technical drawings and documents in web applications with a
framework-independent JavaScript and TypeScript SDK. Rasterex Viewer loads a hosted or
self-hosted Rasterex Canvas deployment in an iframe and provides typed APIs for
documents, tools, markup, measurement, collaboration, and drawing comparison.

Open DWG, DXF, DGN, IFC, PDF, and 100+ other formats supported by your Rasterex
Canvas deployment. Use the hosted Sandbox for evaluation and proof-of-concept
testing, or connect the SDK to your own Canvas deployment for production,
private files, and air-gapped environments.

## Install

```sh
npm install @rasterex/viewer
```

## Quick Start

Create a viewer, mount its iframe, and wait for Canvas to become ready:

```ts
import { createViewer } from "@rasterex/viewer";

const viewer = createViewer({
  container: "#rx-viewer"
});

await viewer.mount();
await viewer.ready();
```

```html
<div id="rx-viewer" style="width: 100%; height: 640px"></div>
```

Without `viewerUrl`, the SDK uses the hosted Rasterex Sandbox. For production,
provide the URL of your self-hosted Canvas deployment:

```ts
const viewer = createViewer({
  container: "#rx-viewer",
  viewerUrl: "https://viewer.example.com",
  targetOrigin: "https://viewer.example.com"
});
```

JavaScript applications use the same API without a TypeScript build step.
TypeScript applications get bundled declarations, typed options, results, and
events; no separate `@types` package is needed.

## Supported Workflows

- Open remote documents and browser-local files.
- Control tools, annotations, markup, layers, and measurements.
- Compare drawing revisions and synchronize views.
- Use the core SDK from vanilla JavaScript, React, Vue, Angular, Vite,
  Next.js, Webpack, or Rollup applications.

Full [JavaScript Document Viewer SDK Quick Start](https://docs.rasterex.com/docs/getting-started/quick-start) ·
[documentation](https://docs.rasterex.com/) ·
[source](https://github.com/Rasterex-Software/rasterex-viewer) ·
[runnable examples](https://github.com/Rasterex-Software/rasterex-viewer-examples) ·
[issues and support](https://github.com/Rasterex-Software/rasterex-viewer/issues) ·
[npm package](https://www.npmjs.com/package/@rasterex/viewer) ·
[Rasterex CAD, BIM & PDF viewer SDK](https://rasterex.com/)

## Integration Guides

- [React CAD and DWG viewer integration](https://github.com/Rasterex-Software/rasterex-viewer/blob/main/docs/live-npm/frameworks/react.md): component lifecycle, document loading, and cleanup.
- [Self-hosted JavaScript and TypeScript document viewer](https://github.com/Rasterex-Software/rasterex-viewer/blob/main/docs/live-npm/getting-started/self-hosted.md): connect your own Canvas deployment and handle startup errors.
- [Drawing revision comparison](https://github.com/Rasterex-Software/rasterex-viewer/blob/main/docs/live-npm/compare/compare.md): compare two sources and await the typed result.

## Evaluation

The SDK automatically starts and validates a 30-day evaluation before
`viewer.ready()` resolves when using Rasterex's hosted Sandbox. No license key,
company name, or email address is required. Evaluation expiry is determined by
Rasterex.

When `viewerUrl` points to a client-owned or self-hosted Canvas, the SDK skips
Rasterex's hosted evaluation API. Self-hosted and air-gapped deployments do not
need network access to Rasterex's evaluation service; licensing and entitlement
for those deployments remain the responsibility of the Canvas deployment.

If startup fails, `viewer.ready()` rejects with `EVALUATION_EXPIRED`,
`INVALID_TOKEN`, `EVALUATION_ACTIVATION_FAILED`,
`EVALUATION_REGISTRATION_FAILED`, or
`EVALUATION_VALIDATION_FAILED`. The viewer
container also displays an accessible error message.

### Optional Company Details

You may optionally provide both a company name and email address when creating
the viewer:

```ts
const viewer = createViewer({
  container: "#rx-viewer",
  evaluation: {
    company: "Example Company",
    email: "user@example.com"
  }
});
```

Both fields are optional. Supplying only one is treated the same as omitting
them. Adding or changing these values does not restart an existing evaluation.

### Internal Evaluation Bypass

For internal integrations, pass the internal key through
`evaluation.internalBypassKey`:

```ts
const viewer = createViewer({
  container: "#rx-viewer",
  evaluation: { internalBypassKey: "<internal-bypass-key>" }
});
await viewer.mount();
await viewer.ready();
```

An exact key match skips hosted evaluation activation, registration, validation,
and token storage access. Canvas readiness, compatibility checks, timeouts, and
cancellation still apply. Missing, empty, or incorrect keys use normal evaluation.
Existing stored evaluation tokens are left untouched, including expired tokens.
The key is embedded in the public npm package and can be extracted and reused;
this is an internal convenience switch, not an enforceable licensing boundary.
It requires no backend changes and is not sent to Rasterex or Canvas. It does
not make the hosted Sandbox available offline. Self-hosted Canvas already skips
hosted evaluation and does not require this key.

## Choose A Viewer Environment

### Hosted Sandbox

The SDK defaults to `https://sandbox.rasterex.com`, Rasterex's hosted Canvas
environment for evaluation and proof-of-concept testing. The SDK embeds it in
an iframe and sends Canvas broker messages to that origin. The hosted
evaluation flow is selected when the configured viewer URL has the Sandbox
origin, including Sandbox URLs with a path or query string.

Documents opened in Sandbox must be reachable from the hosted viewer
environment. The public PDF and DWG used in the examples are intentionally
suitable for this purpose.

### Self-Hosted Production

Do not treat the hosted Sandbox as a customer production deployment. For
production, private files, or network-restricted content, deploy Rasterex
Canvas in your own environment and provide its URL:

```ts
import { createViewer } from "@rasterex/viewer";

const viewer = createViewer({
  container: "#rx-viewer",
  viewerUrl: "https://viewer.example.com",
  targetOrigin: "https://viewer.example.com",
});

await viewer.mount();
await viewer.ready();
```

If `targetOrigin` is omitted, the SDK derives it from `viewerUrl` with
`new URL(viewerUrl).origin`.

## Deployment

Rasterex Canvas production runs on Windows Server, and a Windows container
deployment path is available. The hosted Sandbox is for evaluation and
proof-of-concept testing only.

The SDK package does not bundle the Canvas application. It loads a separately
deployed hosted or self-hosted Canvas URL in an iframe.

## Installation Details

Use the package from a bundled application such as Vite, Next.js, Angular,
React, Vue, Webpack, or Rollup. Use Node.js `^20.19.0 || >=22.12.0` when
developing, building, or releasing this package.

The viewer container must have a real width and height before mounting:

```html
<div id="rx-viewer" style="width: 100%; height: 640px"></div>
```

### Plain HTML Without A Bundler

Browsers cannot resolve npm package names directly from a plain
`<script type="module">` without a bundler or import map. Install the package
and add an import map before your module script:

```html
<div id="rx-viewer" style="width: 100%; height: 640px"></div>

<script type="importmap">
{
  "imports": {
    "@rasterex/viewer": "./node_modules/@rasterex/viewer/dist/index.js",
    "@rasterex/viewer/demo-presets": "./node_modules/@rasterex/viewer/dist/demo-presets.js"
  }
}
</script>

<script type="module">
  import { createViewer } from "@rasterex/viewer";

  const viewer = createViewer({ container: "#rx-viewer" });

  await viewer.mount();
  await viewer.ready();
</script>
```

## Open A Document

After the viewer is ready, open a PDF or a CAD document URL:

```ts
await viewer.documents.open({
  url: "https://res.cloudinary.com/dvgeew3bj/image/upload/v1779169700/Main_version_1.pdf_1_ifrgjq.pdf",
  displayName: "sample.pdf",
  cacheId: "file_7f3a9c2_sample_pdf",
  mime: "application/pdf"
});

await viewer.documents.open({
  url: "https://raw.githubusercontent.com/nextgis/dwg_samples/master/arc_2000.dwg",
  displayName: "arc_2000.dwg",
  cacheId: "sample_arc_2000_dwg",
  mime: "application/acad"
});
```

The file URL must be reachable by the viewer environment. These public files
are for Sandbox demonstration only; production URLs must be reachable by your
self-hosted Rasterex Canvas deployment.

`displayName` should include the file extension, such as `sample.pdf`.
`cacheId` should be a stable file or content ID from your application or server,
not the display name. It lets the server reuse already processed content for the
same file, which can make repeat opens faster.

### Document Loading Lifecycle

Subscribe to document events before opening a file when your UI needs a loading
indicator or error message. `opening` starts the loading state. `fileReady`
confirms that Canvas has opened and activated the file; `fileLoadFailed` reports
a Canvas-side open failure. The SDK also emits `failed` for setup, readiness,
or timeout errors.

Canvas does not provide a documented numeric document-progress callback through
`viewer.documents`. Show an indeterminate loading indicator from `opening` until
one of the terminal events arrives.

```ts
import { createViewer } from "@rasterex/viewer";

const viewer = createViewer({ container: "#rx-viewer" });

viewer.documents.on("opening", () => {
  showLoadingIndicator();
  clearOpenError();
});

viewer.documents.on("fileReady", (event) => {
  hideLoadingIndicator();
  console.log("File ready:", event.fileName);
});

viewer.documents.on("fileLoadFailed", (event) => {
  console.error("Canvas could not open the file:", event.reason);
});

viewer.documents.on("failed", (event) => {
  hideLoadingIndicator();
  showOpenError(event.error.message);
});

await viewer.mount();
await viewer.ready();

try {
  await viewer.documents.open({
    url: "https://files.example.com/sample.pdf",
    displayName: "sample.pdf"
  });
} catch {
  // The `failed` event above has already updated the UI.
}
```

For a browser-local file selected by the user, call `openFile(...)` after the
same initialization and event setup:

```ts
const fileInput = document.querySelector<HTMLInputElement>("#file-input");
const file = fileInput?.files?.[0];

if (file) {
  try {
    await viewer.documents.openFile(file);
  } catch {
    // The `failed` event above has already updated the UI.
  }
}
```

### Create, Mount, And Open In One Call

Use `createDocumentViewer` when the first action should be opening a document:

```ts
import { createDocumentViewer } from "@rasterex/viewer";

const viewer = await createDocumentViewer({
  container: "#rx-viewer",
  document: {
    url: "https://res.cloudinary.com/dvgeew3bj/image/upload/v1779169700/Main_version_1.pdf_1_ifrgjq.pdf",
    displayName: "sample.pdf"
  }
});
```

## Configuration

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

| Option | Description |
| --- | --- |
| `container` | DOM element or selector where the iframe is mounted. |
| `viewerUrl` | Viewer URL to load. Defaults to `https://sandbox.rasterex.com`. |
| `targetOrigin` | Trusted origin for viewer messages. Defaults to the origin of `viewerUrl`. |
| `connectTimeoutMs` | Advisory duration after which the SDK emits a slow iframe diagnostic; it does not reject `mount()`. |
| `readyTimeoutMs` | Maximum duration for the complete `ready()` lifecycle. Defaults to 60 seconds and rejects with `CANVAS_READY_TIMEOUT`. |
| `commandTimeoutMs` | Timeout for commands that wait for a viewer response. |
| `debug` | Writes SDK diagnostics to `console.debug`. |
| `iframeTitle` | Accessible iframe title. |
| `iframeClassName` | CSS class applied to the iframe. |
| `iframeAttributes` | Extra iframe attributes, for example `{ allow: "fullscreen" }`. |

## Capabilities

These calls expose the main CAD, markup and review workflows:

```ts
const layers = await viewer.layers.getLayers();

const blocks = await viewer.blocks.getBlocks();
const attributes = await viewer.blocks.getAttributes({
  index: blocks.blocks[0]?.index ?? 0
});

viewer.measurements.scale.add({
  scale: {
    label: "1:100",
    value: "100",
    metric: "metric",
    metricUnit: "Millimeter",
    dimPrecision: 2,
    isSelected: true
  }
});

const comparison = await viewer.compare.compare({
  backgroundUrl: "https://files.example.com/revision-a.dwg",
  overlayUrl: "https://files.example.com/revision-b.dwg"
});

viewer.annotations.on("created", (event) => {
  console.log("Created annotation:", event.guid);
});
```

`annotations.getData()` resolves to `{ filter, requestId, items, count }`.
Annotation event IDs are on `event.guid`. `comparisonComplete` handlers
receive the `ComparisonResult` directly; it is not wrapped in `.data`.

## Common APIs

```ts
await viewer.documents.open({ url: "/files/sample.pdf", displayName: "sample.pdf" });
await viewer.tools.set({ group: "measurement", action: "MEASURE_LENGTH", enabled: true });
viewer.tools.clear();
viewer.annotations.select({ guid: "annotation-guid" });

const snapshot = await viewer.layers.getLayers();
const firstLayer = snapshot.layers[0];
if (firstLayer?.index !== undefined) {
  await viewer.layers.setLayerVisibility({ index: firstLayer.index, visible: false });
}

const blocks = await viewer.blocks.getBlocks();
const firstBlock = blocks.blocks[0];
if (firstBlock?.index !== undefined) {
  await viewer.blocks.getDetails({ index: firstBlock.index });
  viewer.blocks.setVisibility({ index: firstBlock.index, visible: false });
}

const comparison = await viewer.compare.compare({
  backgroundUrl: "old.pdf",
  overlayUrl: "new.pdf"
});
viewer.styles.setGlobalAppearance({ strokeColor: "#164863" });
viewer.diagnostics.on("transport.error", (event) => console.error(event.error));
```

### Modern Annotation Appearance

Fresh Canvas viewers use **Legacy** appearance. The SDK does not change that
default. After `await viewer.ready()`, opt into Modern explicitly:

```ts
const result = await viewer.styles.setMeasurementAppearance({
  mode: "modern", // "legacy" restores the original presentation
  requestId: "appearance-1", // optional; generated when omitted
  timeoutMs: 30_000 // optional; defaults to commandTimeoutMs
});
console.log(result.mode, result.requestId);
```

This uses Canvas's existing `setMeasurementAppearance` command and waits for the
matching `measurementAppearanceChanged` reply. It switches the viewer-wide
presentation preset for native annotation controls, measurement badges and SNAP
feedback. It does not replace annotation records or change their GUIDs, geometry
or confirmed scales. Continue using `viewer.tools.set(...)` and the existing
annotation callbacks. Modern stays active across document changes within the
current viewer; a fresh viewer starts in Legacy.

`viewer.getInfo().capabilities` retains Canvas's advertised capability names.
This method requires `measurementAppearance`; an older viewer without that
capability rejects with `CAPABILITY_NOT_SUPPORTED` before sending a command.
Calls before readiness reject with `VIEWER_NOT_READY`. Canvas failures and
invalid results reject with `UNKNOWN_COMMAND`, preserving the native error and
result in the error context. Missing acknowledgements reject with
`COMMAND_TIMEOUT`; a timeout does not establish the resulting Canvas mode.
Destroying the viewer rejects pending appearance requests with `VIEWER_NOT_READY`.
Concurrent calls need distinct request IDs; replies without a matching ID are
ignored. No network services or runtime dependencies are added by this feature.

For a local interactive example, serve the repository over HTTP and open
[`examples/measurement-appearance.html`](examples/measurement-appearance.html),
after `npm run build`. Enter the URL of a Canvas deployment supporting the
`measurementAppearance` capability. The example sets `parentOrigin` to its own
origin and leaves Legacy selected until you explicitly switch it. PDF export
appearance still depends on the matching Canvas/backend deployment and requires
separate acceptance testing.

### Test Annotation Tools Locally

Run the existing Canvas app on `http://127.0.0.1:4200`, then run this from the SDK
project:

```sh
npm run dev:annotations
```

Open [the local test parent](http://127.0.0.1:5175/examples/annotation-tools/). It
uses the locally built SDK, not a published npm package, and connects the
unchanged local Canvas to the real sandbox Rasterex server. Legacy remains the
default. The included synthetic PDF is uploaded to that server when selected;
local files you choose are also sent to the configured server.

The parent includes both appearance modes, native annotation tools, scale/SNAP
controls, creation/selection events, stored record inspection and snapshot
comparisons. Its command check reports acknowledgements separately from native
drawing acceptance. Read the [run instructions](examples/annotation-tools/README.md)
and [actual acceptance results](examples/annotation-tools/ACCEPTANCE.md) before
using those checks as release evidence. Database storage and PDF export need
their own matching backend and acceptance. Nothing is published by this command.

### Inspect Measurements and Select Native Vertices

Manually verified in Modern and Legacy; prepared for version 2.2.7.
After `viewer.ready()` and the document's `fileReady`:

```ts
const identity = { fileIndex: 0, pageIndex: 0, guid: "<annotation-guid>" };
const info = await viewer.measurements.getInfo(identity);
const vertex = await viewer.measurements.getInfo({ ...identity, vertexIndex: 0 });
await viewer.measurements.selectVertex({ ...identity, vertexIndex: 0 });
await viewer.measurements.clearVertexSelection();
```

Inspection requires `measurementInfo`; selection/clear require
`nativeVertexSelection`. All three methods accept optional `requestId` and
`timeoutMs`. Indices are zero-based and must refer to the active file/page.
Inspection does not select, edit or scan. `geometry.available: false` still
allows metadata/vertex inspection; display its reason. Native points explicitly
use `coordinateSpace: 'nativeAnnotation'`, not original PDF or iframe coordinates.
Lengths use geometry.unit and areas use its square. Selection uses existing
native handles without starting a drag or moving a vertex. Clear releases the
parent-set vertex state and retains annotation selection. Read-only/locked
records can be inspected; prohibited selections fail with Canvas's native error.

Unrelated replies are ignored. Invalid inputs/results and native failures use
`UNKNOWN_COMMAND`, with native error/result details retained in error context.
Missing capabilities use `CAPABILITY_NOT_SUPPORTED`; readiness/destruction uses
`VIEWER_NOT_READY`; missing replies use `COMMAND_TIMEOUT`. Timeout does not prove
whether native selection changed: commands never retry or send automatic clears.
The existing Canvas source/origin guards remain in force. No new protocol or
backend is required, and no engine coordinate/rotation limitation is corrected.

Use the local parent's **Measurement / vertex inspection** panel for acceptance.
See [manual checks](examples/annotation-tools/MEASUREMENT-INSPECTION.md).

### Synchronize Views

Each viewer reports its own pan and zoom changes. After both viewers are ready
and their documents have emitted `fileReady`, configure them in the same group
and relay changes through the SDK:

```ts
const groupId = "review-42";
const leftId = left.getInfo().sdkInstanceId;
const rightId = right.getInfo().sdkInstanceId;

await Promise.all([
  left.viewSync.configure({ groupId, instanceId: leftId, mode: "panAndZoom" }),
  right.viewSync.configure({ groupId, instanceId: rightId, mode: "panAndZoom" })
]);

const stopLeft = left.viewSync.on("changed", (change) => right.viewSync.apply(change));
const stopRight = right.viewSync.on("changed", (change) => left.viewSync.apply(change));

// On cleanup: stopLeft(); stopRight(); left.destroy(); right.destroy();
```

`apply()` sends a command and returns immediately. Subscribe to `applied` and
`failed` for Canvas results. For cross-origin Canvas deployments, include the
host origin in the Canvas URL's `parentOrigin` query parameter as required by
your Canvas deployment. Use `mode: "zoom"` when drawings have different page
geometry; raw pan coordinates may not identify the same location.

### Tool Control

```ts
await viewer.tools.set({
  group: "measurement",
  action: "MEASURE_LENGTH",
  enabled: true
});

viewer.tools.clear();
```

### Annotation Events

```ts
const unsubscribe = viewer.annotations.on("created", (event) => {
  console.log(event.guid, event.data);
});

unsubscribe();
```

### Readiness Bounds

`connectTimeoutMs` remains an advisory diagnostic for iframe loading.
`readyTimeoutMs` is a rejecting bound for the complete `ready()` lifecycle,
including hosted Sandbox evaluation. The timeout error includes the configured
viewer URL and timeout duration:

```ts
await viewer.ready();
```

Use an `AbortSignal` when the host application needs to cancel readiness:

```ts
const controller = new AbortController();
const readiness = viewer.ready({ signal: controller.signal });

controller.abort();
await readiness; // rejects with VIEWER_NOT_READY
```

## TypeScript

Types are included with the package:

```ts
import type {
  DocumentOpenOptions,
  RasterexViewerOptions,
  ToolAction,
  ToolGroup
} from "@rasterex/viewer";
```

TypeScript reports invalid option names, unsupported tool actions, and invalid
payload shapes at compile time.

## Optional Demo Presets

Hosted presets are exported from a separate entrypoint:

```ts
import { createViewer } from "@rasterex/viewer";
import { sandboxCanvas } from "@rasterex/viewer/demo-presets";

const viewer = createViewer({
  container: "#rx-viewer",
  viewerUrl: sandboxCanvas.viewerUrl,
  targetOrigin: sandboxCanvas.targetOrigin,
});
```

## Cleanup

Destroy the viewer when the page, route, or component no longer needs it:

```ts
viewer.destroy();
```

## Supply Chain Security

The SDK is designed to stay lightweight:

- No runtime npm dependencies.
- No install-time scripts.
- No telemetry.
- No CDN dependency.
- No bundled Rasterex Canvas Angular application.

Before publishing, maintainers should verify the package with:

```sh
npm audit --omit=dev
npm audit
npm pack --json
```

Install the generated tarball in a clean project and verify the public package
imports before publishing. See `SECURITY.md` for the vulnerability reporting
policy and package security scope.

## License

This npm SDK is proprietary software and is licensed under the Rasterex Viewer
SDK License included in this package. It permits evaluation, development,
testing, demonstrations, and proofs of concept. Commercial and production use
requires a separate written Rasterex agreement covering the relevant deployment
and use.

The SDK embeds Rasterex Canvas/viewer deployments through an iframe. The
Rasterex Canvas application, hosted services, server components, viewer assets,
and customer deployments are not licensed by this SDK package and remain
subject to their own licenses and agreements.
