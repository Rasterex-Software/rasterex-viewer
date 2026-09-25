# Rasterex Viewer SDK

Rasterex Viewer SDK puts technical drawings inside your own web application.
Open DWG, DXF, DGN, IFC, PDF and 100+ other formats, then let users mark up,
measure and compare revisions. The engine runs on your own infrastructure; this
package is the typed client that embeds it.

Customer production deployments are self-hosted. Rasterex provides a hosted
Canvas Sandbox for evaluation and proof-of-concept testing.

## Evaluation

The SDK automatically starts and validates a 30-day evaluation before
`viewer.ready()` resolves. No license key, company name, or email address is
required. Evaluation expiry is determined by Rasterex.

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

Full [JavaScript Document Viewer SDK Quick Start](https://docs.rasterex.com/docs/getting-started/quick-start) ·
[source](https://github.com/Rasterex-Software/rasterex-viewer) ·
[runnable examples](https://github.com/Rasterex-Software/rasterex-viewer-examples) ·
[issues and support](https://github.com/Rasterex-Software/rasterex-viewer/issues)

## Choose A Viewer Environment

### Hosted Sandbox

The SDK defaults to `https://sandbox.rasterex.com`, Rasterex's hosted Canvas
environment for evaluation and proof-of-concept testing. The SDK embeds it in
an iframe and sends Canvas broker messages to that origin.

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

## Install And Requirements

```sh
npm install @rasterex/viewer
```

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

## Quick Start

Create a viewer, mount its iframe, then wait for Canvas to become ready:

```ts
import { createViewer } from "@rasterex/viewer";

const viewer = createViewer({
  container: "#rx-viewer"
});

await viewer.mount();
await viewer.ready();
```

Without `viewerUrl`, this uses the hosted Sandbox. `targetOrigin` is derived
from the viewer URL when it is not provided.

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
| `readyTimeoutMs` | Advisory duration after which the SDK emits a slow readiness diagnostic; it does not reject `ready()`. |
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

viewer.compare.compare({
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

viewer.compare.compare({ backgroundUrl: "old.pdf", overlayUrl: "new.pdf" });
viewer.styles.setGlobalAppearance({ strokeColor: "#164863" });
viewer.diagnostics.on("transport.error", (event) => console.error(event.error));
```

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

`connectTimeoutMs` and `readyTimeoutMs` are advisory diagnostics. They do not
reject `mount()` or `ready()`, so `ready()` can remain pending when the Canvas
deployment is unreachable. Add an application-level bound when your UI needs a
finite wait:

```ts
const readiness = viewer.ready();
const deadline = new Promise<never>((_, reject) => {
  window.setTimeout(() => reject(new Error("Canvas readiness timed out")), 30_000);
});

await Promise.race([readiness, deadline]);
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
