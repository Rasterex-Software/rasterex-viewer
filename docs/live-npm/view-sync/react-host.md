# Synchronize Two Rasterex Viewers in React

Use `@rasterex/viewer` to keep pan and zoom aligned across two Canvas viewers. Each viewer is a separate SDK instance. Your React host chooses the sync group and relays changes from one instance to the other.

This guide uses the `viewer.viewSync` API introduced in SDK `2.1.5`. That version is currently in this workspace and has not been published by this work. Your Canvas deployment must support the view sync broker messages documented in [Canvas View Synchronization: React Host Integration](../../docs-canvas-to-implement/VIEW_SYNC_REACT_HOST_INTEGRATION.md). The Canvas document does not identify a minimum Canvas version. Confirm support in your deployment before using this in production.

## Install and prepare Canvas

After `2.1.5` is published:

```sh
npm install @rasterex/viewer@2.1.5
```

To try the feature from this workspace before publication, run these in the SDK repository and install the resulting tarball in your React application:

```sh
npm run build
npm pack
```

```sh
npm install /absolute/path/to/rasterex-viewer/rasterex-viewer-2.1.5.tgz
```

You need:

- A Canvas URL that can be embedded by your React application and supports `configureViewSync`, `viewSyncChanged`, and `applyViewSync`.
- A document URL reachable by the Canvas deployment.
- A container with a real height for each viewer.

For a cross-origin host, Canvas expects the host origin in the `parentOrigin` URL parameter. The example below adds that parameter and `embed=true` to the Canvas URL you provide. The SDK derives its trusted message origin from the resulting `viewerUrl`, and its broker checks both the message origin and the sending iframe.

## Complete React example

Set `canvasBaseUrl` to your view sync enabled Canvas deployment. This first example opens the same public PDF in both viewers so their page geometry matches. Replace the document URLs and display names with files reachable by your Canvas deployment.

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

    const left = createViewer({ container: leftContainer.current, viewerUrl: canvasUrl.href });
    const right = createViewer({ container: rightContainer.current, viewerUrl: canvasUrl.href });
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
      try {
        right.viewSync.apply(change, {
          pan: mode !== "zoom" && change.state.pan !== undefined,
          zoom: mode !== "pan" && change.state.zoom !== undefined
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not relay the left view");
      }
    });
    const stopRight = right.viewSync.on("changed", (change) => {
      if (disposed || !relayEnabled || change.groupId !== groupId ||
          change.sourceInstanceId !== rightId || change.sequence <= lastRightSequence) return;
      lastRightSequence = change.sequence;
      try {
        left.viewSync.apply(change, {
          pan: mode !== "zoom" && change.state.pan !== undefined,
          zoom: mode !== "pan" && change.state.zoom !== undefined
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

        setStatus("Opening documents");
        await Promise.all([
          left.documents.open({ url: leftDocumentUrl, displayName: leftDisplayName }),
          right.documents.open({ url: rightDocumentUrl, displayName: rightDisplayName })
        ]);
        if (disposed) return;

        await Promise.all([
          left.viewSync.configure({ groupId, instanceId: leftId, mode }),
          right.viewSync.configure({ groupId, instanceId: rightId, mode })
        ]);
        if (disposed) return;

        relayEnabled = mode !== "off";
        setStatus(relayEnabled ? "Views synchronized" : "Synchronization off");
      } catch (cause) {
        if (disposed) return;
        setError(cause instanceof Error ? cause.message : "Viewer startup failed");
        setStatus("Unable to start synchronization");
        left.destroy();
        right.destroy();
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
      leftDocumentUrl="https://res.cloudinary.com/dvgeew3bj/image/upload/v1779169700/Main_version_1.pdf_1_ifrgjq.pdf"
      leftDisplayName="sample.pdf"
      rightDocumentUrl="https://res.cloudinary.com/dvgeew3bj/image/upload/v1779169700/Main_version_1.pdf_1_ifrgjq.pdf"
      rightDisplayName="sample.pdf"
    />
  );
}
```

Replace `https://canvas.example.com/` with your deployment URL. `documents.open()` resolves after Canvas emits `fileReady`, so the example configures synchronization only after both documents are active. The `within()` helper gives the host a finite startup wait because `connectTimeoutMs` and `readyTimeoutMs` are advisory and do not reject `mount()` or `ready()` by themselves.

The host checks `groupId`, `sourceInstanceId`, and increasing `sequence` before forwarding a change. The SDK also checks incoming messages against the configured Canvas origin, iframe source, group, and instance. Each event is sent only to the sibling viewer. Canvas is expected to avoid emitting a new local change from a remotely applied update; confirm that behavior with your deployment.

## Modes and different documents

| Mode | Use |
| --- | --- |
| `panAndZoom` | Identical documents or drawings with matching geometry. |
| `zoom` | Related drawings with different sizes or origins. |
| `pan` | Keep pan aligned without matching zoom. |
| `off` | Disable local view sync events. |

For two revisions, pass different `leftDocumentUrl` and `rightDocumentUrl` values and start with `mode="zoom"`. Give each document its real file name and extension. Raw pan coordinates are not guaranteed to represent the same physical location in two different drawings.

When a viewer changes documents, stop forwarding changes immediately, reset its last sequence to `-1`, wait for the new `documents.open()` call to resolve, then configure synchronization again. The example remounts both viewers when its document props change, which resets this state automatically.

## Results and troubleshooting

`configure()` waits for `viewSyncConfigured` with the generated request ID. It rejects when Canvas returns `success: false` or when no matching result arrives before `commandTimeoutMs` (30 seconds by default). The Canvas reference shows request ID echoing in an example, but does not explicitly guarantee it; confirm this with your deployment. A timeout may mean the view sync command is unsupported or that the response did not include the request ID.

`apply()` returns immediately after sending `applyViewSync`. Listen to `viewer.viewSync.on("applied", ...)` or `on("failed", ...)` for Canvas outcomes. Those results may omit `requestId`, so do not treat `apply()` as a promise for remote completion. Canvas ignores stale sequences without reporting them as errors.

If configuration never succeeds, check the Canvas build, iframe embedding policy, `parentOrigin`, document readiness, and the SDK `targetOrigin`. The SDK does not claim a minimum Canvas version or infer a capability from the current broker `viewerReady` path.
