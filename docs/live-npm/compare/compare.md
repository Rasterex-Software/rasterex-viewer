# Drawing Revision Comparison in JavaScript and TypeScript

Use `await viewer.compare.compare(...)` to create a visual comparison from two
file sources, such as revisions of a CAD drawing or PDF document. JavaScript
and TypeScript use the same SDK calls; TypeScript also infers the
`ComparisonResult` returned by the promise. The comparison runs in your
Rasterex Canvas deployment, which determines supported formats and processing.

See [React CAD and DWG integration](../frameworks/react.md) and
[self-hosted deployment](../getting-started/self-hosted.md).

> **Deprecated — comparison-markup save:** `viewer.compare.save(...)` and
> `compareSaveComplete` are compatibility-only while Canvas save support is
> unresolved. Do not use them in new integrations.

Compare commands are available after the viewer is mounted and Canvas is ready:

```ts
import { createViewer } from "@rasterex/viewer";

const viewer = createViewer({
  container: "#viewer"
});

await viewer.mount();
await viewer.ready();
```

If `viewerUrl` is not supplied, the SDK loads `https://sandbox.rasterex.com` and uses the same origin for Canvas broker messages. Production and on-premises applications should pass their own `viewerUrl`.

## Listen First

Register compare events before sending the command:

```ts
const cleanups = [
  viewer.compare.on("progressStart", (event) => {
    console.log(event.message);
  }),
  viewer.compare.on("progressEnd", () => {
    console.log("Compare finished");
  }),
  viewer.compare.on("comparisonComplete", (result) => {
    if (result) console.log(result.outputFileUrl);
  }),
  viewer.compare.on("comparisonError", (error) => {
    console.error(error.message);
  })
];
```

`compare(...)` returns `Promise<ComparisonResult>`. The promise resolves after
Canvas emits a payload-bearing `comparisonComplete` followed by `progressEnd`.
It rejects on `comparisonError`, timeout, disconnect, or invalid compare input.
Progress and completion events remain available for UI updates.

`align(...)` and `save(...)` remain event-driven and return `void`. Interactive
align still emits an initial `comparisonComplete` without a payload, so the
shared `comparisonComplete` event remains optional.

Do not use `viewer.documents.on("fileReady", ...)` or
`viewer.documents.on("fileLoadFailed", ...)` to settle this workflow. Those
events are not correlated to the compare command, even when Canvas opens the
source or generated comparison files. Use `comparisonComplete`,
`comparisonError`, and `progressEnd` for compare loading, success, and failure
UI.

## Compare Two URLs

```ts
const result = await viewer.compare.compare({
  backgroundUrl: "https://files.example.com/old-plan.pdf",
  overlayUrl: "https://files.example.com/new-plan.pdf",
  outputName: "old-vs-new.pdf",
  dpi: 200,
  backgroundColor: "#E86767",
  overlayColor: "#0E3BD8",
  equalColor: "rgb(128,128,128)"
});
```

Canvas opens the two sources, creates the comparison, opens the generated comparison file, then emits `comparisonComplete` and `progressEnd`. The returned promise resolves with the `ComparisonResult` after both events.

## Compare File Names

```ts
const result = await viewer.compare.compare({
  backgroundFileName: "old-plan.pdf",
  overlayFileName: "new-plan.pdf",
  outputName: "old-vs-new.pdf"
});
```

Canvas resolves relative file names using its configured file base URL.

## Source Fields

| Field | Use it for |
| --- | --- |
| `backgroundUrl` | Background file URL or path. |
| `overlayUrl` | Overlay file URL or path. |
| `backgroundFileName` | Background file name resolved by Canvas. |
| `overlayFileName` | Overlay file name resolved by Canvas. |

The SDK validates that both sides are present and that the selected background and overlay source strings are different.

## Save Comparison Markup

```ts
viewer.compare.save({
  outputName: "old-vs-new.pdf"
});
```

You can also pass the output name directly:

```ts
viewer.compare.save("old-vs-new.pdf");
```

When no output name is provided, the SDK sends an empty options object:

```ts
viewer.compare.save();
```

Listen for save completion:

```ts
const offSave = viewer.compare.on("compareSaveComplete", (outputName) => {
  console.log(outputName);
});
```

## Types

```ts
type CompareAlignPayload = {
  backgroundUrl?: string;
  overlayUrl?: string;
  backgroundFileName?: string;
  overlayFileName?: string;
  outputName?: string;
  dpi?: number;
  backgroundColor?: string;
  overlayColor?: string;
  equalColor?: string;
  alignArray?: Array<Record<string, unknown>>;
};
```

Compare result:

```ts
type ComparisonResult = {
  relativePath: string;
  outputFileUrl: string;
  activeFile: unknown;
  otherFile: unknown;
  activeFileUrl?: string;
  otherFileUrl?: string;
  dpi?: number;
  name?: string;
  index?: number;
  mode?: "compare" | "align";
  backgroundUrl?: string;
  overlayUrl?: string;
};
```

## Validation And Errors

The SDK rejects invalid compare input before sending it to Canvas:

- Payload must be an object.
- Background source must be provided with `backgroundUrl` or `backgroundFileName`.
- Overlay source must be provided with `overlayUrl` or `overlayFileName`.
- Background and overlay source strings must be different.
- `dpi`, when provided, must be a positive finite number.
- `backgroundColor`, `overlayColor`, and `equalColor` must be hex or `rgb(...)` strings.
- `outputName`, when provided, must not be empty.

Canvas processing failures arrive through `comparisonError`.

## TypeScript

```ts
const result = await viewer.compare.compare({
  backgroundUrl: "https://files.example.com/old-plan.pdf",
  overlayUrl: "https://files.example.com/new-plan.pdf",
  dpi: 200
});
```

Runtime validation catches values TypeScript cannot infer:

```ts
await viewer.compare.compare({
  backgroundUrl: "https://files.example.com/old-plan.pdf",
  overlayUrl: "https://files.example.com/new-plan.pdf",
  // Rejects at runtime because dpi must be positive.
  dpi: 0
});
```

## Vanilla Example

```html
<div id="viewer" style="height: 640px"></div>
<button type="button" id="compare">Compare</button>
<button type="button" id="save">Save Compare</button>
<p id="status"></p>

<script type="module">
  import { createViewer } from "@rasterex/viewer";

  const viewer = createViewer({ container: "#viewer" });
  const status = document.querySelector("#status");

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  await viewer.mount();
  await viewer.ready();

  const cleanups = [
    viewer.compare.on("progressStart", (event) => setStatus(event.message)),
    viewer.compare.on("progressEnd", () => setStatus("Done")),
    viewer.compare.on("comparisonComplete", (result) => {
      if (result) setStatus(`Comparison created: ${result.relativePath}`);
    }),
    viewer.compare.on("comparisonError", (error) => setStatus(error.message)),
    viewer.compare.on("compareSaveComplete", (outputName) => {
      setStatus(`Saved ${outputName ?? "comparison"}`);
    })
  ];

  document.querySelector("#compare")?.addEventListener("click", () => {
    void viewer.compare.compare({
      backgroundUrl: "https://files.example.com/old-plan.pdf",
      overlayUrl: "https://files.example.com/new-plan.pdf",
      outputName: "old-vs-new.pdf",
      dpi: 200
    }).catch((error) => setStatus(error instanceof Error ? error.message : "Compare failed"));
  });

  document.querySelector("#save")?.addEventListener("click", () => {
    viewer.compare.save({ outputName: "old-vs-new.pdf" });
  });
</script>
```

## React Example

```tsx
import { useEffect, useRef, useState } from "react";
import { createViewer, type RasterexViewer } from "@rasterex/viewer";

export function CompareFilesPanel() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<RasterexViewer | null>(null);
  const [status, setStatus] = useState("Loading viewer");

  useEffect(() => {
    let disposed = false;
    const viewer = createViewer({ container: hostRef.current! });
    viewerRef.current = viewer;

    const cleanups = [
      viewer.compare.on("progressStart", (event) => {
        if (!disposed) setStatus(event.message);
      }),
      viewer.compare.on("progressEnd", () => {
        if (!disposed) setStatus("Done");
      }),
      viewer.compare.on("comparisonComplete", (result) => {
        if (!disposed && result) setStatus(`Comparison created: ${result.relativePath}`);
      }),
      viewer.compare.on("comparisonError", (error) => {
        if (!disposed) setStatus(error.message);
      })
    ];

    async function start() {
      await viewer.mount();
      await viewer.ready();
      if (!disposed) setStatus("Ready");
    }

    void start().catch((error) => {
      if (!disposed) setStatus(error instanceof Error ? error.message : "Viewer failed");
    });

    return () => {
      disposed = true;
      for (const cleanup of cleanups) cleanup();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  async function compareFiles() {
    const result = await viewerRef.current?.compare.compare({
      backgroundUrl: "https://files.example.com/old-plan.pdf",
      overlayUrl: "https://files.example.com/new-plan.pdf",
      outputName: "old-vs-new.pdf",
      dpi: 200
    });
    if (result) setStatus(`Comparison created: ${result.relativePath}`);
  }

  function saveComparison() {
    viewerRef.current?.compare.save({ outputName: "old-vs-new.pdf" });
  }

  return (
    <section>
      <div ref={hostRef} style={{ height: 640 }} />
      <button type="button" onClick={compareFiles}>
        Compare
      </button>
      <button type="button" onClick={saveComparison}>
        Save Compare
      </button>
      <p>{status}</p>
    </section>
  );
}
```

## Next.js Example

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createViewer, type RasterexViewer } from "@rasterex/viewer";

export default function CompareFilesPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<RasterexViewer | null>(null);
  const [status, setStatus] = useState("Loading viewer");

  useEffect(() => {
    const viewer = createViewer({ container: hostRef.current! });
    viewerRef.current = viewer;

    const cleanups = [
      viewer.compare.on("progressStart", (event) => setStatus(event.message)),
      viewer.compare.on("comparisonComplete", (result) => {
        if (result) setStatus(`Created ${result.relativePath}`);
      }),
      viewer.compare.on("comparisonError", (error) => setStatus(error.message))
    ];

    void viewer
      .mount()
      .then(() => viewer.ready())
      .then(() => setStatus("Ready"))
      .catch((error) => setStatus(error instanceof Error ? error.message : "Viewer failed"));

    return () => {
      for (const cleanup of cleanups) cleanup();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  async function compareFiles() {
    const result = await viewerRef.current?.compare.compare({
      backgroundUrl: "https://files.example.com/old-plan.pdf",
      overlayUrl: "https://files.example.com/new-plan.pdf",
      outputName: "old-vs-new.pdf",
      dpi: 200
    });
    if (result) setStatus(`Created ${result.relativePath}`);
  }

  return (
    <main>
      <div ref={hostRef} style={{ height: 640 }} />
      <button type="button" onClick={compareFiles}>
        Compare
      </button>
      <p>{status}</p>
    </main>
  );
}
```

## Angular Example

```ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from "@angular/core";
import { createViewer, type RasterexViewer } from "@rasterex/viewer";

@Component({
  selector: "app-compare-files",
  template: `
    <div #viewerHost class="viewer-host"></div>
    <button type="button" (click)="compareFiles()">Compare</button>
    <button type="button" (click)="saveComparison()">Save Compare</button>
    <p>{{ status }}</p>
  `,
  styles: [`.viewer-host { height: 640px; }`]
})
export class CompareFilesComponent implements AfterViewInit, OnDestroy {
  @ViewChild("viewerHost", { static: true })
  private viewerHost!: ElementRef<HTMLDivElement>;

  protected status = "Loading viewer";
  private viewer: RasterexViewer | null = null;
  private cleanups: Array<() => void> = [];

  async ngAfterViewInit() {
    const viewer = createViewer({ container: this.viewerHost.nativeElement });
    this.viewer = viewer;

    this.cleanups.push(
      viewer.compare.on("progressStart", (event) => {
        this.status = event.message;
      }),
      viewer.compare.on("progressEnd", () => {
        this.status = "Done";
      }),
      viewer.compare.on("comparisonComplete", (result) => {
        if (result) this.status = `Comparison created: ${result.relativePath}`;
      }),
      viewer.compare.on("comparisonError", (error) => {
        this.status = error.message;
      })
    );

    await viewer.mount();
    await viewer.ready();
    this.status = "Ready";
  }

  async compareFiles() {
    const result = await this.viewer?.compare.compare({
      backgroundUrl: "https://files.example.com/old-plan.pdf",
      overlayUrl: "https://files.example.com/new-plan.pdf",
      outputName: "old-vs-new.pdf",
      dpi: 200
    });
    if (result) this.status = `Comparison created: ${result.relativePath}`;
  }

  saveComparison() {
    this.viewer?.compare.save({ outputName: "old-vs-new.pdf" });
  }

  ngOnDestroy() {
    for (const cleanup of this.cleanups) cleanup();
    this.viewer?.destroy();
  }
}
```

## Canvas Broker Mapping

| SDK API | Canvas broker message |
| --- | --- |
| `viewer.compare.compare(...)` | Sends `compare` and returns a promise for `ComparisonResult`. |
| `viewer.compare.save(...)` | Sends `compareSave`. |
| `viewer.compare.on("progressStart", ...)` | Listens for `progressStart`. |
| `viewer.compare.on("progressEnd", ...)` | Listens for `progressEnd`. |
| `viewer.compare.on("comparisonComplete", ...)` | Listens for `comparisonComplete`. |
| `viewer.compare.on("comparisonError", ...)` | Listens for `comparisonError`. |
| `viewer.compare.on("compareSaveComplete", ...)` | Listens for `compareSaveComplete`. |

This is Canvas broker support, not a Protocol V1 compare envelope.
