# React CAD and DWG Viewer — JavaScript and TypeScript

Use the core `@rasterex/viewer` package directly in React. The current SDK does not require or ship a separate React adapter.

React integration is mostly lifecycle management:

1. Own the viewer container with `useRef`.
2. Create the viewer in `useEffect`.
3. Register SDK event subscriptions in the same effect.
4. Call `mount()`, `ready()`, then open files or enable tools.
5. Unsubscribe and call `destroy()` in the effect cleanup.

If `viewerUrl` is not supplied, the SDK loads `https://sandbox.rasterex.com` and uses the same origin for Canvas broker messages. Production and on-premises applications should pass their own `viewerUrl`.

## Open a DWG Drawing

After `mount()` and `ready()`, use the same document API for a DWG drawing:

```ts
await viewer.documents.open({
  url: "https://files.example.com/floor-plan.dwg",
  displayName: "floor-plan.dwg",
  mime: "application/acad"
});
```

Replace the example URL with a file reachable by your Canvas deployment.
Format support and processing belong to Canvas; the npm package embeds Canvas
in an iframe. For customer production use, supply your own `viewerUrl`.
The component below illustrates lifecycle and error handling using a PDF;
replace its document options with the DWG options above.

For a JavaScript JSX component, omit TypeScript annotations, type imports, and
the generic arguments on React hooks. The SDK calls stay the same.

See [self-hosted deployment](../getting-started/self-hosted.md) and
[drawing revision comparison](../compare/compare.md).

## Basic Component

```tsx
import { useEffect, useRef, useState } from "react";
import {
  createViewer,
  RasterexViewerError,
  type RasterexViewer
} from "@rasterex/viewer";

export function RasterexReactViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<RasterexViewer | null>(null);
  const [status, setStatus] = useState("Loading viewer");
  const [error, setError] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    const viewer = createViewer({
      container: containerRef.current,
      iframeAttributes: {
        allow: "fullscreen"
      }
    });

    viewerRef.current = viewer;

    const cleanups = [
      viewer.documents.on("opening", () => {
        if (!disposed) setStatus("Opening file");
      }),
      viewer.documents.on("opened", () => {
        if (!disposed) setStatus("File opened");
      }),
      viewer.documents.on("failed", (event) => {
        if (!disposed) {
          setStatus("File failed");
          setError(`${event.error.code}: ${event.error.message}`);
        }
      }),
      viewer.annotations.on("selected", (event) => {
        if (!disposed) setSelectedAnnotation(event.guid ?? null);
      }),
      viewer.annotations.on("created", () => {
        if (!disposed) setStatus("Annotation created");
      })
    ];

    async function start() {
      try {
        setStatus("Mounting viewer");
        await viewer.mount();
        await viewer.ready();

        await viewer.documents.open({
          url: "https://files.example.com/sample.pdf",
          displayName: "Sample PDF.pdf"
        });

        if (!disposed) setStatus("Ready");
      } catch (caughtError) {
        if (disposed) return;
        setStatus("Error");

        if (caughtError instanceof RasterexViewerError) {
          setError(`${caughtError.code}: ${caughtError.message}`);
        } else {
          setError(caughtError instanceof Error ? caughtError.message : "Viewer failed");
        }
      }
    }

    void start();

    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  async function openFile() {
    try {
      await viewerRef.current?.documents.open({
        url: "https://files.example.com/floor-plan.pdf",
        displayName: "Floor Plan.pdf"
      });
      setStatus("Floor plan opened");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Open failed");
    }
  }

  async function enableNoteTool() {
    const result = await viewerRef.current?.tools.set({
      action: "NOTE",
      enabled: true
    });

    if (result && !result.success) {
      setError(result.error ?? "Note tool failed");
    }
  }

  async function saveAnnotations() {
    try {
      const result = await viewerRef.current?.annotations.save({
        timeoutMs: 10000
      });
      setStatus(result ? `Saved ${result.requestId}` : "Save skipped");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Save failed");
    }
  }

  return (
    <section>
      <div ref={containerRef} style={{ height: 640 }} />
      <button type="button" onClick={() => void openFile()}>
        Open File
      </button>
      <button type="button" onClick={() => void enableNoteTool()}>
        Note
      </button>
      <button type="button" onClick={() => void saveAnnotations()}>
        Save
      </button>
      <p>{status}</p>
      <p>Selected annotation: {selectedAnnotation ?? "none"}</p>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
```

## Local Hook Pattern

This is a local app hook, not a package adapter. Use it when several React components need the same lifecycle pattern.

```tsx
import { useEffect, useRef, useState } from "react";
import { createViewer, type RasterexViewer } from "@rasterex/viewer";

export function useRasterexViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<RasterexViewer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    const viewer = createViewer({
      container: containerRef.current
    });
    viewerRef.current = viewer;

    async function start() {
      try {
        await viewer.mount();
        await viewer.ready();
        if (!disposed) setReady(true);
      } catch (caughtError) {
        if (!disposed) {
          setError(caughtError instanceof Error ? caughtError.message : "Viewer failed");
        }
      }
    }

    void start();

    return () => {
      disposed = true;
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  return {
    containerRef,
    viewer: viewerRef.current,
    viewerRef,
    ready,
    error
  };
}
```

## Using The Hook

```tsx
export function FileViewer() {
  const { containerRef, viewerRef, ready, error } = useRasterexViewer();
  const [status, setStatus] = useState("Idle");

  async function openFile() {
    if (!ready) return;

    await viewerRef.current?.documents.open({
      url: "https://files.example.com/sample.pdf",
      displayName: "Sample PDF.pdf"
    });
    setStatus("Opened");
  }

  return (
    <section>
      <div ref={containerRef} style={{ height: 640 }} />
      <button type="button" disabled={!ready} onClick={() => void openFile()}>
        Open File
      </button>
      <p>{error ?? status}</p>
    </section>
  );
}
```

## File Inputs

Use `openFile(...)` when the user chooses a browser `File`:

```tsx
async function openBrowserFile(file: File, fileId: string) {
  await viewerRef.current?.documents.openFile(file, {
    cacheId: fileId
  });
}

<input
  type="file"
  onChange={(event) => {
    const file = event.currentTarget.files?.[0];
    if (file) void openBrowserFile(file, "file_7f3a9c2_upload");
  }}
/>
```

`cacheId` should be a stable file/content ID from your application or server. It lets Canvas reuse processed server content when the same file was already uploaded and processed under the same cache key.

## Cleanup Rules

- Keep the viewer instance in `useRef`, not React state.
- Keep every unsubscribe returned by `.on(...)`.
- Call unsubscriptions before `viewer.destroy()`.
- Use a local `disposed` flag to avoid state updates after unmount.
- Do not call command methods before `viewer.ready()` resolves.
- In React development with Strict Mode, effects can run twice; cleanup must always destroy the previous viewer.

## TypeScript

The package exports the core viewer class and domain option/result types:

```tsx
import {
  createViewer,
  type RasterexViewer,
  type DocumentOpenOptions,
  type ToolAction
} from "@rasterex/viewer";

const action: ToolAction = "MEASURE_LENGTH";

const document: DocumentOpenOptions = {
  url: "https://files.example.com/sample.pdf",
  displayName: "Sample PDF.pdf"
};
```

TypeScript rejects unsupported SDK method options and event names:

```tsx
viewerRef.current?.annotations.on(
  // @ts-expect-error Use selected, selectedWithDetail, created, createdWithDetail, deleted, or deletedWithDetail.
  "selectionChanged",
  () => {}
);
```
