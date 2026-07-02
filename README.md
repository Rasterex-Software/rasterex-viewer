# Rasterex Viewer SDK

Embed Rasterex Viewer in your web application with a small iframe-based SDK.

The SDK mounts the viewer, opens files, controls tools, listens for viewer events, and provides TypeScript types for the public API.

Full documentation: https://documentation.rasterex.com/

## Install

```sh
npm install @rasterex/viewer
```

## Requirements

Use the package from a bundled application such as Vite, Next.js, Angular, React, Vue, Webpack, or Rollup.

Browsers cannot resolve npm package names directly from a plain `<script type="module">` file without a bundler or import map.

The viewer container must have a real width and height before mounting.

```html
<div id="rx-viewer" style="width: 100%; height: 640px"></div>
```

## No Framework

For a plain HTML page without a framework or bundler, install the package and add an import map before your module script.

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

  const viewer = createViewer({
    container: "#rx-viewer"
  });

  await viewer.mount();
  await viewer.ready();
</script>
```

## Quick Start

```ts
import { createViewer } from "@rasterex/viewer";

const viewer = createViewer({
  container: "#rx-viewer"
});

await viewer.mount();
await viewer.ready();
```

By default, the SDK loads:

```txt
https://beta.viewer.viewsoft.com
```

`targetOrigin` is derived from the viewer URL when it is not provided.

## Open A File URL

```ts
await viewer.documents.open({
  url: "https://pdfobject.com/pdf/sample.pdf",
  displayName: "sample.pdf",
  cacheId: "file_7f3a9c2_sample_pdf",
  mime: "application/pdf"
});
```

The file URL must be reachable by the viewer environment.

`displayName` should include the file extension, for example `sample.pdf`.

`cacheId` should be a stable file/content ID from your application or server, not the display file name. It lets the server reuse already processed content for the same file, which can make repeat opens faster.

## Open A Browser File

```ts
const input = document.querySelector<HTMLInputElement>("#file-input");
const file = input?.files?.[0];
const fileId = "file_7f3a9c2_sample_pdf";

if (file) {
  await viewer.documents.openFile(file, {
    cacheId: fileId
  });
}
```

## Mount And Open In One Call

```ts
import { createDocumentViewer } from "@rasterex/viewer";

const viewer = await createDocumentViewer({
  container: "#rx-viewer",
  document: {
    url: "https://pdfobject.com/pdf/sample.pdf",
    displayName: "sample.pdf"
  }
});
```

## Custom Viewer URL

Use `viewerUrl` for your hosted or on-premises viewer.

```ts
import { createViewer } from "@rasterex/viewer";

const viewer = createViewer({
  container: "#rx-viewer",
  viewerUrl: "https://viewer.example.com",
  targetOrigin: "https://viewer.example.com"
});

await viewer.mount();
await viewer.ready();
```

If `targetOrigin` is omitted, the SDK uses `new URL(viewerUrl).origin`.

## Tools

```ts
await viewer.tools.set({
  group: "measurement",
  action: "MEASURE_LENGTH",
  enabled: true
});

viewer.tools.clear();
```

## Annotation Events

```ts
const unsubscribe = viewer.annotations.on("created", (event) => {
  console.log(event.guid, event.data);
});

unsubscribe();
```

## Options

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
| `viewerUrl` | Viewer URL to load. Defaults to `https://beta.viewer.viewsoft.com`. |
| `targetOrigin` | Trusted origin for viewer messages. Defaults to the origin of `viewerUrl`. |
| `connectTimeoutMs` | Timeout for iframe loading. |
| `readyTimeoutMs` | Timeout while waiting for viewer readiness. |
| `commandTimeoutMs` | Timeout for commands that wait for a viewer response. |
| `debug` | Writes SDK diagnostics to `console.debug`. |
| `iframeTitle` | Accessible iframe title. |
| `iframeClassName` | CSS class applied to the iframe. |
| `iframeAttributes` | Extra iframe attributes, for example `{ allow: "fullscreen" }`. |

## Presets

Presets are optional and are exported from a separate entrypoint.

```ts
import { createViewer } from "@rasterex/viewer";
import { sandboxCanvas, takeoffDemo } from "@rasterex/viewer/demo-presets";

const viewer = createViewer({
  container: "#rx-viewer",
  viewerUrl: sandboxCanvas.viewerUrl,
  targetOrigin: sandboxCanvas.targetOrigin
});
```

Takeoff is not loaded by default. Use `takeoffDemo` only when your app explicitly chooses that preset.

## TypeScript

Types are included.

```ts
import type {
  DocumentOpenOptions,
  RasterexViewerOptions,
  ToolAction,
  ToolGroup
} from "@rasterex/viewer";
```

TypeScript will report invalid option names, unsupported tool actions, and wrong payload shapes at compile time.

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
  await viewer.blocks.getBlockDetails({ index: firstBlock.index });
  viewer.blocks.setBlockVisibility({ index: firstBlock.index, visible: false });
}
viewer.compare.compare({ backgroundUrl: "old.pdf", overlayUrl: "new.pdf" });
viewer.styles.setGlobalAppearance({ strokeColor: "#164863" });
viewer.diagnostics.on("transport.error", (event) => console.error(event.error));
```

## Cleanup

Destroy the viewer when the page, route, or component no longer needs it.

```ts
viewer.destroy();
```

## License

This npm SDK is licensed under the MIT License.

The SDK embeds Rasterex Canvas/viewer deployments through an iframe. The Rasterex Canvas application, hosted services, server components, viewer assets, and customer deployments are not licensed by this SDK package and remain subject to their own licenses and agreements.

## Supply Chain Security

The SDK is designed to stay lightweight and air-gap friendly:

- No runtime npm dependencies.
- No install-time scripts.
- No telemetry.
- No CDN dependency.
- No bundled Rasterex Canvas Angular application.

Before publishing, maintainers should verify the package with:

```sh
npm audit --omit=dev
npm audit
npm pack --dry-run
```

See `SECURITY.md` for the vulnerability reporting policy and package security scope.
