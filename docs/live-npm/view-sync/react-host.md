# Synchronize Two Rasterex Viewers in React

Use `@rasterex/viewer` to keep pan and zoom aligned across two Canvas viewers. Each viewer is a separate SDK instance. Your React host chooses the sync group and relays changes from one instance to the other.

This guide uses the `viewer.viewSync` API in SDK `2.1.6`. Your Canvas deployment must support the view sync broker messages documented in [Canvas View Synchronization: React Host Integration](../../docs-canvas-to-implement/VIEW_SYNC_REACT_HOST_INTEGRATION.md). The Canvas document does not identify a minimum Canvas version. Confirm support in your deployment before using this in production.

## Install and prepare Canvas

Install the SDK from npm:

```sh
npm install @rasterex/viewer@2.1.6
```

To try the feature from this workspace before publication, run these in the SDK repository and install the resulting tarball in your React application:

```sh
npm run build
npm pack
```

```sh
npm install /absolute/path/to/rasterex-viewer/rasterex-viewer-2.1.6.tgz
```

You need:

- A Canvas URL that can be embedded by your React application and supports `configureViewSync`, `getViewSyncSnapshot`, `applyViewSyncSnapshot`, `viewSyncChanged`, and `applyViewSync`.
- A document URL reachable by the Canvas deployment.
- A container with a real height for each viewer.

For a cross-origin host, Canvas expects the host origin in the `parentOrigin` URL parameter and derives its trusted parent origin from the referrer. The example below adds that parameter, `embed=true`, and `referrerPolicy="origin"`. The SDK derives its trusted message origin from the resulting `viewerUrl`, and its broker checks both the message origin and the sending iframe.

## Complete React example

Set `canvasBaseUrl` to your view sync enabled Canvas deployment. This example opens the same PDF in both viewers so their page geometry matches. Replace the document URLs and display names with files reachable by your Canvas deployment.

```tsx
import { useEffect, useRef, useState } from "react";
import { createViewer, type ViewSyncMode } from "@rasterex/viewer";

type Props = {
  canvasBaseUrl: string;
  leftDocumentUrl: string;
  leftDisplayName: string;
  rightDocumentUrl: string;
  rightDisplayName: string;
  mode?: ViewSyncMode;
};

async function within<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Canvas startup timed out")), milliseconds);
      })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function SynchronizedViewers({
  canvasBaseUrl,
  leftDocumentUrl,
  leftDisplayName,
  rightDocumentUrl,
  rightDisplayName,
  mode = "panAndZoom"
}: Props) {
  const leftContainer = useRef<HTMLDivElement>(null);
  const rightContainer = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Starting viewers");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leftContainer.current || !rightContainer.current) return;

    const canvasUrl = new URL(canvasBaseUrl);
    canvasUrl.searchParams.set("embed", "true");
    canvasUrl.searchParams.set("parentOrigin", window.location.origin);

    const viewerOptions = { viewerUrl: canvasUrl.href, iframeAttributes: { referrerPolicy: "origin" } };
    const left = createViewer({ ...viewerOptions, container: leftContainer.current });
    const right = createViewer({ ...viewerOptions, container: rightContainer.current });
    const groupId = "review-pair";
    const leftId = left.getInfo().sdkInstanceId;
    const rightId = right.getInfo().sdkInstanceId;
    let disposed = false;
    let relayEnabled = false;
    let lastLeftSequence = -1;
    let lastRightSequence = -1;

    const stopLeft = left.viewSync.on("changed", (change) => {
      if (disposed || !relayEnabled || change.groupId !== groupId ||
          change.sourceInstanceId !== leftId || change.sequence <= lastLeftSequence) return;
      lastLeftSequence = change.sequence;
      const pan = mode !== "zoom" && mode !== "off" && change.state.pan !== undefined;
      const zoom = mode !== "pan" && mode !== "off" && change.state.zoom !== undefined;
      if (!pan && !zoom) return;
      try {
        right.viewSync.apply(change, {
          pan, zoom
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not relay the left view");
      }
    });
    const stopRight = right.viewSync.on("changed", (change) => {
      if (disposed || !relayEnabled || change.groupId !== groupId ||
          change.sourceInstanceId !== rightId || change.sequence <= lastRightSequence) return;
      lastRightSequence = change.sequence;
      const pan = mode !== "zoom" && mode !== "off" && change.state.pan !== undefined;
      const zoom = mode !== "pan" && mode !== "off" && change.state.zoom !== undefined;
      if (!pan && !zoom) return;
      try {
        left.viewSync.apply(change, {
          pan, zoom
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not relay the right view");
      }
    });
    const stopLeftFailure = left.viewSync.on("failed", (result) => {
      if (!disposed) setError(`Left viewer could not apply view: ${result.reason}`);
    });
    const stopRightFailure = right.viewSync.on("failed", (result) => {
      if (!disposed) setError(`Right viewer could not apply view: ${result.reason}`);
    });

    async function start(): Promise<void> {
      try {
        await within(Promise.all([left.mount(), right.mount()]), 30_000);
        if (disposed) return;
        await within(Promise.all([left.ready(), right.ready()]), 30_000);
        if (disposed) return;

        await Promise.all([
          left.viewSync.configure({ groupId, instanceId: leftId, mode, enabled: false }),
          right.viewSync.configure({ groupId, instanceId: rightId, mode, enabled: false })
        ]);
        if (disposed) return;

        setStatus("Opening documents");
        await Promise.all([
          left.documents.open({ url: leftDocumentUrl, displayName: leftDisplayName }),
          right.documents.open({ url: rightDocumentUrl, displayName: rightDisplayName })
        ]);
        if (disposed) return;

        if (mode !== "off") {
          setStatus("Aligning views");
          const snapshot = await left.viewSync.getSnapshot({ groupId });
          if (disposed) return;
          await right.viewSync.applySnapshot(snapshot);
          if (disposed) return;
        }

        await Promise.all([
          left.viewSync.configure({ groupId, instanceId: leftId, mode, enabled: mode !== "off" }),
          right.viewSync.configure({ groupId, instanceId: rightId, mode, enabled: mode !== "off" })
        ]);
        if (disposed) return;

        relayEnabled = mode !== "off";
        setStatus(relayEnabled ? "Views synchronized" : "Synchronization off");
      } catch (cause) {
        if (disposed) return;
        relayEnabled = false;
        await Promise.allSettled([
          Promise.resolve().then(() => left.viewSync.configure({
            groupId, instanceId: leftId, mode, enabled: false
          })),
          Promise.resolve().then(() => right.viewSync.configure({
            groupId, instanceId: rightId, mode, enabled: false
          }))
        ]);
        if (disposed) return;
        setError(cause instanceof Error ? cause.message : "Viewer startup failed");
        setStatus("Synchronization stopped");
      }
    }

    void start();
    return () => {
      disposed = true;
      relayEnabled = false;
      stopLeft();
      stopRight();
      stopLeftFailure();
      stopRightFailure();
      left.destroy();
      right.destroy();
    };
  }, [canvasBaseUrl, leftDocumentUrl, leftDisplayName, rightDocumentUrl, rightDisplayName, mode]);

  return (
    <section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div ref={leftContainer} aria-label="Left drawing" style={{ height: 600, minWidth: 0 }} />
        <div ref={rightContainer} aria-label="Right drawing" style={{ height: 600, minWidth: 0 }} />
      </div>
      <p role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export default function App() {
  return (
    <SynchronizedViewers
      canvasBaseUrl="https://canvas.example.com/"
      leftDocumentUrl="https://files.example.com/plan.pdf"
      leftDisplayName="sample.pdf"
      rightDocumentUrl="https://files.example.com/plan.pdf"
      rightDisplayName="sample.pdf"
    />
  );
}
```

Replace both example origins with URLs your deployment can access. `documents.open()` resolves after Canvas emits `fileReady`. The example configures both viewers with live sync disabled, opens both documents, aligns the right viewer to the left snapshot, and enables live sync only after Canvas confirms alignment. For `off`, it opens the documents and skips alignment. The `within()` helper gives the host a finite startup wait because `connectTimeoutMs` and `readyTimeoutMs` are advisory and do not reject `mount()` or `ready()` by themselves.

The host checks `groupId`, `sourceInstanceId`, and increasing `sequence` before forwarding a change. The SDK also checks incoming messages against the configured Canvas origin, iframe source, group, and instance. Each event is sent only to the sibling viewer. Canvas is expected to avoid emitting a new local change from a remotely applied update; confirm that behavior with your deployment.

## Modes and different documents

| Mode | Use |
| --- | --- |
| `panAndZoom` | Identical documents or drawings with matching geometry. |
| `zoom` | Relay only zoom operations after successful snapshot alignment. |
| `pan` | Keep pan aligned without matching zoom. |
| `off` | Disable local view sync events. |

For two revisions, pass different `leftDocumentUrl` and `rightDocumentUrl` values only when their pages and viewer coordinates are compatible enough for snapshot alignment. `mode="zoom"` limits subsequent relays to zoom, but the initial snapshot still checks page, zoom, and position. If the documents cannot align by raw page offset, this example stops before enabling live sync. Raw pan coordinates do not represent the same physical location in unrelated drawings.

When a viewer changes documents, stop forwarding changes immediately, disable synchronization, reset its last sequence to `-1`, wait for the new `documents.open()` call to resolve, then align and enable synchronization again. The example remounts both viewers when its document props change, which resets this state automatically.

## Results and troubleshooting

`configure()`, `getSnapshot()`, and `applySnapshot()` wait for matching request IDs and reject on Canvas failure, invalid results, or timeout. Snapshot alignment requires matching pages and compatible geometry and viewer coordinates. If alignment fails, the example leaves live sync disabled and displays the error. The Canvas reference shows request ID echoing in its responses; confirm that behavior with your deployment.

`apply()` returns immediately after sending `applyViewSync`. Listen to `viewer.viewSync.on("applied", ...)` or `on("failed", ...)` for Canvas outcomes. Those results may omit `requestId`, so do not treat `apply()` as a promise for remote completion. Canvas ignores stale sequences without reporting them as errors.

If configuration never succeeds, check the Canvas build, iframe embedding policy, `parentOrigin`, document readiness, and the SDK `targetOrigin`. The SDK does not claim a minimum Canvas version or infer a capability from the current broker `viewerReady` path.
