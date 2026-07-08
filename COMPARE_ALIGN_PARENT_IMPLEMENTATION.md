# Compare And Align Parent Application Implementation

This document describes everything the parent application needs to implement to drive compare and align through `postMessage`.

The viewer-side code is implemented in:

- `src/app/message-broker/handlers/compare-broker.service.ts`
- `src/app/message-broker/message-broker-router.service.ts`
- `src/app/message-broker/message-broker-messenger.service.ts`
- `src/app/components/compare/create-comparison/create-comparison.component.ts`
- `src/app/components/compare/compare.service.ts`
- `src/app/services/align.service.ts`
- `src/rxcore/index.ts`

Compare and align are both handled by `CompareBrokerService`.

## Supported Events

Parent to viewer:

```txt
compare
align
compareSave
```

Viewer to parent:

```txt
progressStart
progressEnd
comparisonComplete
comparisonError
compareSaveComplete
comparisonMarkupChanged
```

## Message Target

The viewer only accepts messages whose source is `window.parent`. In the parent application, post messages to the viewer iframe window:

```ts
const viewerWindow = viewerIframe.contentWindow;

viewerWindow?.postMessage(
  {
    type: 'compare',
    payload: {
      backgroundUrl: 'old-plan.pdf',
      overlayUrl: 'new-plan.pdf',
    },
  },
  viewerOrigin
);
```

Use the real viewer origin instead of `'*'` when the parent knows it.

## Shared Types

Add these types to the parent application message-broker area.

```ts
export type CompareAlignPayload = {
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

export type ComparisonResult = {
  relativePath: string;
  activeFile: unknown;
  otherFile: unknown;
  activeFileUrl?: string;
  otherFileUrl?: string;
  activeColor?: unknown;
  otherColor?: unknown;
  activeSetAs?: unknown;
  otherSetAs?: unknown;
  alignarray?: Array<Record<string, unknown>>;
  dpi?: number;
  name?: string;
  index?: number;
  mode?: 'compare' | 'align';
  backgroundUrl?: string;
  overlayUrl?: string;
};

export type ComparisonErrorPayload = {
  mode?: 'compare' | 'align';
  message: string;
};

export type ProgressStartPayload = {
  type: 'progressStart';
  message: string;
};

export type CompareSaveCompletePayload = {
  type: 'compareSaveComplete';
  payload?: string;
};

export type ComparisonMarkupChangedPayload = {
  type: 'comparisonMarkupChanged';
  payload: boolean;
};
```

## Parent Broker Helper

Implement a small parent-side helper that sends compare and align events and listens for viewer responses.

```ts
type ViewerCompareMessage =
  | { type: 'progressStart'; message: string }
  | { type: 'progressEnd' }
  | { type: 'comparisonComplete'; payload?: ComparisonResult }
  | { type: 'comparisonError'; payload: ComparisonErrorPayload }
  | { type: 'compareSaveComplete'; payload?: string }
  | { type: 'comparisonMarkupChanged'; payload: boolean };

export class CompareAlignMessageBroker {
  constructor(
    private readonly iframe: HTMLIFrameElement,
    private readonly viewerOrigin: string
  ) {}

  compare(payload: CompareAlignPayload): void {
    this.post('compare', payload);
  }

  align(payload: CompareAlignPayload): void {
    this.post('align', payload);
  }

  save(outputName?: string): void {
    this.post('compareSave', outputName ? { outputName } : {});
  }

  listen(handler: (message: ViewerCompareMessage) => void): () => void {
    const listener = (event: MessageEvent) => {
      if (event.origin !== this.viewerOrigin) {
        return;
      }

      const data = event.data as ViewerCompareMessage | undefined;
      if (!data || typeof data.type !== 'string') {
        return;
      }

      if (
        data.type === 'progressStart' ||
        data.type === 'progressEnd' ||
        data.type === 'comparisonComplete' ||
        data.type === 'comparisonError' ||
        data.type === 'compareSaveComplete' ||
        data.type === 'comparisonMarkupChanged'
      ) {
        handler(data);
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }

  private post(type: string, payload: unknown): void {
    this.iframe.contentWindow?.postMessage({ type, payload }, this.viewerOrigin);
  }
}
```

## Payload Normalization In Viewer

The viewer accepts either URLs or file names:

- `backgroundUrl` or `backgroundFileName`
- `overlayUrl` or `overlayFileName`

If the value is an absolute `http://` or `https://` URL, the viewer uses it as-is.

If the value starts with `/`, the viewer uses it as-is.

If the value is a relative file name, the viewer prefixes it with `RXCore.Config.baseFileURL` for opening in the viewer.

The compare engine also needs file names. If `backgroundFileName` or `overlayFileName` is missing, the viewer extracts the name from the URL path.

Preferred source format:

- Send file names or paths that the viewer/compare server can resolve from the configured upload folder.
- Send `backgroundFileName` and `overlayFileName` explicitly when using full URLs. The viewer can extract names from URLs, but explicit names avoid ambiguity.
- Full `http://` and `https://` URLs are opened by the viewer as-is. The RXCore compare wrapper still builds the compare-server command from the supplied source values and server upload-folder configuration, so parent applications should only use external URLs when the deployment's compare server is configured to resolve them.

## Colors

The parent can send colors as:

- Hex, for example `'#E86767'`
- RGB string, for example `'rgb(232,103,103)'`

The viewer converts hex values to RGB before calling the compare engine.

Defaults:

- `backgroundColor`: compare service red option, currently `#E86767`
- `overlayColor`: compare service blue option, currently `#0E3BD8`
- `equalColor`: `rgb(128,128,128)`

## `compare`

Creates a normal comparison without point alignment.

Parent sends:

```ts
viewerWindow.postMessage(
  {
    type: 'compare',
    payload: {
      backgroundUrl: 'old-plan.pdf',
      overlayUrl: 'new-plan.pdf',
      outputName: 'old-vs-new.pdf',
      dpi: 200,
      backgroundColor: '#E86767',
      overlayColor: '#0E3BD8',
      equalColor: 'rgb(128,128,128)',
    },
  },
  viewerOrigin
);
```

Required fields:

- `backgroundUrl` or `backgroundFileName`
- `overlayUrl` or `overlayFileName`

Optional fields:

- `outputName`
- `dpi`
- `backgroundColor`
- `overlayColor`
- `equalColor`

Viewer behavior:

- Emits `progressStart`.
- Opens the background file.
- Opens the overlay file.
- Calls `RXCore.compareOverlayServerJSON(...)`.
- Opens the generated comparison file returned by the server.
- Adds the comparison to `CompareService`.
- Emits `comparisonComplete`.
- Emits `progressEnd`.

Viewer success response:

```ts
{
  type: 'comparisonComplete',
  payload: {
    relativePath: 'generated-comparison.pdf',
    activeFileUrl: 'new-plan.pdf',
    otherFileUrl: 'old-plan.pdf',
    dpi: 200,
    name: 'Comparison 1',
    index: 0,
    mode: 'compare',
    backgroundUrl: 'old-plan.pdf',
    overlayUrl: 'new-plan.pdf'
  }
}
```

Viewer error response:

```ts
{
  type: 'comparisonError',
  payload: {
    mode: 'compare',
    message: 'Missing required payload fields: backgroundUrl and overlayUrl.'
  }
}
```

## `align`

`align` supports two flows:

- Precomputed align flow: parent sends `alignArray` with two points.
- Interactive align flow: parent omits `alignArray` or sends fewer than two points, and the user picks alignment points in the viewer.

### Precomputed Align

Use this when the parent already has two align point payloads.

Parent sends:

```ts
viewerWindow.postMessage(
  {
    type: 'align',
    payload: {
      backgroundUrl: 'old-plan.pdf',
      overlayUrl: 'new-plan.pdf',
      outputName: 'aligned-comparison.pdf',
      dpi: 200,
      backgroundColor: '#E86767',
      overlayColor: '#0E3BD8',
      alignArray: [
        {
          // First align point object returned by RXCore compare measure.
        },
        {
          // Second align point object returned by RXCore compare measure.
        },
      ],
    },
  },
  viewerOrigin
);
```

Viewer behavior:

- Emits `progressStart`.
- Opens the background file.
- Opens the overlay file.
- Calls `RXCore.compareOverlayServerJSON(...)` with `alignArray`.
- Opens the generated aligned comparison file.
- Adds the comparison to `CompareService`.
- Emits `comparisonComplete` with `mode: 'align'`.
- Emits `progressEnd`.

The first two `alignArray` objects are forwarded to the compare server as the second and third objects in the JSON command payload. They should be the same shape RXCore emits from compare measure. The broker does not validate their internal fields, and the RXCore wrapper ignores any extra array items after the first two.

### Interactive Align

Use this when the parent wants the viewer to collect align points from the user.

Parent sends:

```ts
viewerWindow.postMessage(
  {
    type: 'align',
    payload: {
      backgroundUrl: 'old-plan.pdf',
      overlayUrl: 'new-plan.pdf',
      dpi: 200,
      backgroundColor: '#E86767',
      overlayColor: '#0E3BD8',
    },
  },
  viewerOrigin
);
```

This path is selected when `alignArray` is missing or has fewer than two items.

Viewer behavior:

- Emits `progressStart` for interactive align setup.
- Sets compare DPI.
- Switches to compare GUI mode.
- Opens the background file and overlay file as two distinct source files.
- Emits `comparisonComplete` without payload to tell the parent that interactive align mode is ready.
- Opens the internal create-comparison modal in silent mode.
- Starts the align flow through `AlignService.requestAlign()`.
- Emits `progressEnd` after setup is complete.
- The user selects the first align point on the background file.
- The viewer switches to the overlay file.
- The user selects the second align point on the overlay file.
- The viewer calls `RXCore.compareOverlayServerJSON(...)` with the collected `alignArray`.
- The viewer opens the generated aligned comparison file.
- The viewer emits `comparisonComplete` again, this time with the comparison payload.

The final interactive align generation uses the viewer's internal loading overlay. It does not emit a second `progressStart`/`progressEnd` pair to the parent. Treat the second `comparisonComplete` with a payload as the final success signal.

Interactive align uses `backgroundUrl`, `overlayUrl`, `dpi`, `backgroundColor`, and `overlayColor`. `outputName` and `equalColor` are not passed into the final interactive-align server call in the current implementation.

Parent handling for interactive align:

```ts
let waitingForInteractiveAlignResult = false;

broker.listen((message) => {
  if (message.type === 'comparisonComplete' && !message.payload) {
    waitingForInteractiveAlignResult = true;
    showAlignInstructions();
    return;
  }

  if (message.type === 'comparisonComplete' && message.payload) {
    waitingForInteractiveAlignResult = false;
    closeAlignInstructions();
    showComparisonResult(message.payload);
  }

  if (message.type === 'comparisonError') {
    waitingForInteractiveAlignResult = false;
    showError(message.payload.message);
  }
});
```

Interactive align can emit two `comparisonComplete` messages:

- First: no payload, align mode is prepared.
- Second: with payload, aligned comparison was created.

The parent should keep its interactive align state active after the first `progressEnd`; that event only closes the setup progress cycle.

## `compareSave`

Saves current comparison markup state through `RXCore.markUpSave()`.

Parent sends:

```ts
viewerWindow.postMessage(
  {
    type: 'compareSave',
    payload: {
      outputName: 'old-vs-new.pdf',
    },
  },
  viewerOrigin
);
```

The viewer also accepts a string payload:

```ts
viewerWindow.postMessage(
  {
    type: 'compareSave',
    payload: 'old-vs-new.pdf',
  },
  viewerOrigin
);
```

Viewer behavior:

- Emits `progressStart`.
- Calls `RXCore.markUpSave()`.
- Emits `compareSaveComplete`.
- Emits `progressEnd`.

`compareSaveComplete` means the save command was issued by the viewer. The current broker does not wait for a separate RXCore save-success callback and does not emit a compare-save error event.

Viewer response:

```ts
{
  type: 'compareSaveComplete',
  payload: 'old-vs-new.pdf'
}
```

## Markup Change Event

When comparison markup changes inside the viewer, `CompareComponent` emits:

```ts
{
  type: 'comparisonMarkupChanged',
  payload: true
}
```

`payload` is `true` when the active comparison has markup changes and `false` when no comparison markup is currently detected. Parent applications can use this to enable save/export prompts, but should still use `compareSaveComplete` as the response to a parent-initiated `compareSave` command.

## Progress Events

Compare and align emit progress messages so the parent can show a loading state.

Compare start:

```ts
{
  type: 'progressStart',
  message: 'It takes a few seconds to generate the comparison.'
}
```

Align start:

```ts
{
  type: 'progressStart',
  message: 'It takes a few seconds to prepare align mode.'
}
```

Save start:

```ts
{
  type: 'progressStart',
  message: 'It takes a few seconds to save the comparison.'
}
```

End:

```ts
{
  type: 'progressEnd'
}
```

For normal `compare`, precomputed `align`, and `compareSave`, `progressEnd` closes the full command progress cycle. For interactive `align`, it closes only the setup cycle; final success is the later `comparisonComplete` with a payload.

## Parent Validation

Validate before sending `compare` or `align`:

- Background source exists.
- Overlay source exists.
- Background and overlay resolve to different documents.
- `dpi` is a positive finite number when provided.
- Colors are valid hex or RGB strings.
- `alignArray`, when provided for precomputed align, has exactly two point objects.
- `outputName`, when provided, is a valid file name for the compare server.
- Do not start another `compare`, `align`, or `compareSave` command until the current command's expected terminal event has arrived.

## Parent UI Requirements

For `compare`, the parent should show:

- Loading state from `progressStart` to `progressEnd`.
- Success state from `comparisonComplete`.
- Error state from `comparisonError`.

For precomputed `align`, the parent should show the same states as compare.

For interactive `align`, the parent should additionally show:

- Align-ready instructions after the first `comparisonComplete` without payload.
- A prompt for selecting the first point on the background file.
- A prompt for selecting the second point on the overlay file.
- A waiting state after the setup `progressEnd`, because the user still has to pick points.
- Result state after the second `comparisonComplete` with payload.

## Error Cases From Viewer

Known broker errors include:

```txt
Missing required payload fields: backgroundUrl and overlayUrl.
Unable to resolve file names from input URLs for compare engine.
Unable to resolve both source files for align.
Unable to resolve the two source files for align.
Unable to resolve opened files for align.
Align requires two distinct open files, but both sources resolved to the same document.
Align requires two distinct source files, but both inputs resolved to the same open document.
Align requires two distinct open files, but background and overlay resolved to the same document.
Comparison processing failed.
```

The parent should display `payload.message` from `comparisonError`.

## Verification Checklist

Use this checklist when implementing the parent application:

1. Send `compare` with two valid file names and confirm `comparisonComplete`.
2. Send `compare` with full URLs and confirm file names are resolved.
3. Send `compare` with custom colors and DPI.
4. Send `compare` with missing source values and confirm `comparisonError`.
5. Send `align` with a two-item `alignArray` and confirm one `comparisonComplete` with payload.
6. Send `align` without `alignArray` and confirm the first `comparisonComplete` has no payload.
7. Complete the two point selections in the viewer and confirm the second `comparisonComplete` has payload.
8. Confirm `comparisonError` appears when both align sources resolve to the same document.
9. Send `compareSave` and confirm `compareSaveComplete`.
10. Confirm normal compare, precomputed align, and compare save loading indicators start on `progressStart` and stop on `progressEnd`.
11. Confirm interactive align keeps waiting for the second `comparisonComplete` after the setup `progressEnd`.

