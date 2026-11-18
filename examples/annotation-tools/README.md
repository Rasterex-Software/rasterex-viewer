# Local annotation tool acceptance

This parent imports the locally built `../../dist/index.js` through the SDK's existing Vite dev
dependency. The run command builds the SDK first. It does not install or use a published npm SDK. Canvas remains a
separate app and is never bundled into the package.

Run the existing Canvas project on loopback port 4200 without editing it:

```sh
CI=true NG_CLI_ANALYTICS=false npm start -- --host 127.0.0.1 --port 4200
```

From the `rasterex-viewer` SDK root:

```sh
npm run dev:annotations
```

Open `http://127.0.0.1:5175/examples/annotation-tools/`. Connect the viewer, then
open the included synthetic test PDF. It uploads a uniquely named test copy to
the configured Rasterex server through the actual SDK `documents.openFile`
workflow. Local files chosen manually are also uploaded to that server. Use
only files you intend to send there. No mock readiness or load responses exist.

The development server listens only on loopback. Canvas at port 4201 proxies
the unchanged local Angular app at `http://canvas.localhost:4201/`. The standard localhost subdomain avoids the
Canvas facade's localhost-specific C: upload override when using the sandbox's
actual E: paths. The proxy reads upload path declarations from the selected
server's own configuration without executing its JavaScript. The cache base is
a relative proxy path because the native PDF URL encoder escapes authority port
colons; no engine code is modified. Its `rxconfig.js` response receives in-memory
connection values targeting the real `https://sandbox.rasterex.com/` server
through fixed proxy paths. No Canvas file, native engine, license, command,
response or document is substituted. Configurations can be supplied using
`CANVAS_DEV_URL`, `RASTEREX_SERVER_URL`, `RASTEREX_API_URL`, `CANVAS_PROXY_PORT`
and `PARENT_PORT`. If changing ports, enter the resulting Canvas proxy URL in the
parent. `parentOrigin` is supplied explicitly for source/origin validation.

The default separate application API target is the selected Rasterex server;
use `RASTEREX_API_URL` if your application backend has its own URL. Stage 2 does
not test database collaboration or backend PDF exports.

## Acceptance steps

1. Connect and confirm the initial mode is Legacy. Check real viewer readiness.
2. Open the test PDF and wait for the correlated `fileReady`, not a spinner.
3. Activate Rectangle, Ellipse, Polygon, Arrow, Text and Note from the parent.
   Use native click-click placement where supported by this Canvas build, and
   check actual creation/selection events after each gesture.
4. For measurements, explicitly apply the synthetic 1:100 test scale. Test
   Length, Area, Path, Rectangular area, Count and native SNAP. The test scale
   is not a physical calibration of an actual plan.
5. Refresh records and capture a baseline. Switch to Modern, then compare:
   GUIDs, geometry and native scale fields must remain unchanged.
6. Repeat drawing and inspect Modern handles, badges and Note read/edit UI.
   Exercise native move/resize/rotation and verify stored properties.
7. Enable the supplied rose/yellow test style. New Modern tools should use
   supported style fields; Legacy measurement tools restore startup defaults.
   Existing annotations must retain their stored styling across mode switches.
8. Switch back to Legacy, repeat creation/selection, then switch to Modern again.

The command-check button activates/deactivates the eleven core tools and toggles
SNAP in both modes, then restores the previous appearance. It reports only actual
acknowledgements, not native drawing success.

Tool acknowledgements and event counts are shown separately. A successful
activation reply is not proof that a native pointer gesture, style, or PDF export
works. The snapshot comparison is based only on SDK-returned native records; it
does not scan PDF geometry or read globals inside the iframe. Libraries, eraser,
locking, text highlighting and other existing tools remain available in the
full tool selector for extra document-specific acceptance.

The included PDF is copied unchanged from Canvas's synthetic
`tests/fixtures/pdf-measurement-coordinates.pdf` fixture; no real customer drawing
is included. This sample does not address the documented viewer-rotation issue.

## Measurement inspection and vertex selection

The parent now has a Measurement / vertex inspection disclosure. Refresh native
measurements, inspect metadata or a chosen vertex, then explicitly select/clear
its native handle. See [acceptance steps](MEASUREMENT-INSPECTION.md).
