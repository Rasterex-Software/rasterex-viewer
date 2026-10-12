# Self-Hosted CAD and PDF Viewer in JavaScript and TypeScript

Embed your own Rasterex Canvas deployment using `@rasterex/viewer`. The SDK
provides iframe lifecycle and typed document APIs; Canvas and its backend are
deployed separately. JavaScript and TypeScript use the same calls. TypeScript
declarations ship with the npm package.

## Prerequisites

- A working Canvas deployment licensed for your production use and configured
  to accept your application as an iframe parent.
- Network access from the browser to Canvas, and access to the document source
  from the viewer environment. Replace the example URLs below with your own.
- A container with a real width and height.
- Canvas support for the document formats and broker APIs you use.

The URL can include your deployment's path and port. Use the actual deployment
URL; the SDK does not assume a root-path installation. The SDK derives the
trusted message origin from that URL when `targetOrigin` is omitted. Configure
Canvas's parent-origin policy according to your deployment documentation.

## Install and Open a Drawing

```sh
npm install @rasterex/viewer
```

```html
<div id="rx-viewer" style="width: 100%; height: 640px"></div>
```

In a bundled application's JavaScript or TypeScript module:

```ts
import { createViewer, RasterexViewerError } from "@rasterex/viewer";

const viewer = createViewer({
  container: "#rx-viewer",
  viewerUrl: "https://viewer.example.com/canvas/",
  readyTimeoutMs: 60_000
});

try {
  await viewer.mount();
  await viewer.ready();
  await viewer.documents.open({
    url: "https://files.example.com/floor-plan.dwg",
    displayName: "floor-plan.dwg",
    mime: "application/acad"
  });
} catch (error) {
  viewer.destroy();
  if (error instanceof RasterexViewerError) {
    console.error(error.code, error.message);
  } else {
    console.error(error);
  }
}

// Call viewer.destroy() when the route or component is removed.
```

For PDF, provide a PDF URL, a `.pdf` display name, and `application/pdf` as the
MIME type. Supported formats depend on your Canvas deployment.

## Startup and Document Errors

`ready()` rejects if Canvas does not become ready before `readyTimeoutMs`.
The `CANVAS_READY_TIMEOUT` error includes the timeout and configured viewer
URL; it cannot reliably identify HTTP status, DNS failure, or an iframe policy
failure. Check browser diagnostics and your Canvas deployment when startup
fails. Document loading has its own errors and timeout after viewer readiness.

Subscribe to `viewer.documents` events before opening documents when your UI
needs loading feedback. `fileReady` confirms that Canvas opened and activated
the document. See [document opening](../files/opening.md) for event handling
and browser-local file selection.

## Air-Gapped Deployments

For client-owned Canvas URLs, the SDK skips Rasterex's hosted evaluation API.
Your deployment must still provide its own Canvas assets, backend, licensing,
and document sources. The npm SDK does not make external sample files or a
hosted Canvas available offline. Install and serve the application and package
assets through your organization's approved process.

Omitting `viewerUrl` selects the hosted Sandbox and its evaluation flow, so
always provide your Canvas URL for self-hosted production integrations.

## Next Steps

- [React CAD and DWG viewer](../frameworks/react.md)
- [Drawing revision comparison](../compare/compare.md)
- [Message origins and iframe security](../concepts/security-and-origin.md)
- [Official documentation](https://docs.rasterex.com/)
- [npm package](https://www.npmjs.com/package/@rasterex/viewer)
