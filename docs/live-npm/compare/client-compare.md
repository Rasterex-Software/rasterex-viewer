# Client-Side Compare

Use `viewer.clientCompare` for Canvas client-side comparison. It keeps both source documents in the viewer and does not create a server-side comparison file.

This API is separate from `viewer.compare`, which remains the server-side comparison API.

```ts
await viewer.mount();
await viewer.ready();

const comparison = await viewer.clientCompare.create({
  backgroundUrl: "https://files.example.com/old-plan.pdf",
  overlayUrl: "https://files.example.com/new-plan.pdf",
  backgroundColor: "#E86767",
  overlayColor: "#0E3BD8"
});

await viewer.clientCompare.setOpacity(50);
await viewer.clientCompare.setCommonLevel(5);
```

`create()` requires a background and overlay source. Each may be a URL or a Canvas-resolved file name. The SDK validates the local shape of the request; Canvas resolves the files and returns their indexes.

## Alignment

Interactive alignment has a start acknowledgement and a later completion event:

```ts
const stop = viewer.clientCompare.on("alignComplete", (result) => {
  console.log("Client comparison aligned", result.comparisonFileIndex);
});

await viewer.clientCompare.startAlign();
// The user selects the two points in Canvas.

stop();
```

Cancel or clear alignment state with:

```ts
await viewer.clientCompare.close();
```

The SDK correlates responses by request ID, applies the configured command timeout, rejects overlapping comparison creation or alignment commands, and rejects pending commands when the viewer is destroyed.

## Events

Available events are `ready`, `opacityChanged`, `commonLevelChanged`, `alignStarted`, `alignComplete`, `closed`, and `failed`.

The Canvas contract and complete message examples are documented in [Client-Side Compare via postMessage](../../docs-canvas-to-implement/CLIENT_COMPARE_POSTMESSAGE_API.md).
