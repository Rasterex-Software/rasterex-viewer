# Stage 2 acceptance — November 17, 2026

Status: **local annotation testing accepted by the user on November 17, 2026**
("it works I checked"), followed by authorization to bump to 2.2.6. No npm
publication was requested or performed. The evidence below distinguishes the
agent's earlier automated checks from the user's manual confirmation.

## Environment

- Local parent: http://127.0.0.1:5175/examples/annotation-tools/
- Local Canvas frontend: http://127.0.0.1:4200/; test proxy: http://canvas.localhost:4201/.
- Actual backend selected by the user: https://sandbox.rasterex.com/.
- The recorded agent browser run used locally built SDK 2.2.5 from `../../dist/index.js`. The later version bump rebuilds this entrypoint as 2.2.6. No published npm SDK is required.
- Synthetic seven-page coordinate fixture; uploaded through `documents.openFile` with a unique test filename.
- Connection configuration is overlaid in memory by this SDK example. Canvas files and all scripts-folder files remain untouched by this work.

## Verified results

| Check | Observed result | Acceptance scope |
| --- | --- | --- |
| SDK validation | `npm run check` passed: 68 tests, build, version/metadata, source-line and packed ESM/types consumer checks | Automated SDK/package checks |
| Parent TypeScript | Standalone strict type-check passed against the built SDK | Example integration types |
| Real readiness and identity | Viewer became ready, advertised 29 capabilities, accepted test user setup | Real iframe/broker/backend session |
| Default appearance | Legacy initially selected; no automatic Modern activation | Initial session |
| Real PDF open | Correlated `fileReady`, fileId 6209, fileIndex 0, requestId `req-mwkl69s8-1`; seven-page PDF visibly rendered | Final built-SDK run |
| Both mode command sweep | 22/22 activation/deactivation pairs acknowledged: eleven tools in each mode | Commands only; not pointer creation |
| SNAP | Enable and disable acknowledged in each mode | Setting only; no verified native snap match |
| Synthetic scale | Current-page `SDK test 1:100`, millimetres, selected and read back | Explicit test scale, not physical calibration |
| Canvas preservation | Working-tree status and tracked diff matched the pre-run baseline | No Canvas changes made |

The eleven command-tested tools are Rectangle, Ellipse, Polygon, Arrow, Text,
Note, Length, Area, Path, Rectangular area and Count. Each pair includes a tool
activation and a deactivation. The sweep restores the prior appearance mode.

Before the final built-SDK run, an earlier session imported the local source
entrypoint. In that session, one **Legacy Note** was placed, edited and posted;
a native creation event and record list reported GUID
`7C857570-3832-4EA2-A40C-DB45BEBFA6F0`. Switching to Modern retained its GUID,
geometry and scale fields. This limited observation is not built-package native
creation acceptance, style preservation acceptance, or measurement acceptance.
The final built-SDK session had zero native creation/selection/deletion events.

## User manual acceptance

After using the local parent, the user confirmed the annotation test works and
requested the version bump to 2.2.6. No individual gesture matrix or backend
storage/export results were supplied. The historical agent observations below
remain unchanged; the version bump does not manufacture new automated results.

## Earlier agent limitations and extended checks

Automated native shape and Modern Note gesture attempts did not produce creation
events. The cause is unresolved; command acknowledgements cannot establish that
native drawing works. The following was the manual checklist supplied with the parent before user acceptance:

- Create/select shapes, arrows, text, Notes and measurements in each mode.
- Exercise native move, resize and rotation; check Modern Note read/edit behavior.
- Verify real snapping and Modern handles/badges during native gestures.
- Capture representative measurement records and compare GUIDs, geometry, scale
  snapshots and stored style fields across both mode switches.
- Check document changes and persistence/reload with the intended application API.

The selected native server returned **404 for GET /api/annotations**. It does not
supply the separate application annotation-storage API at that URL. Configure
`RASTEREX_API_URL` with the intended application backend before storage acceptance.
No causal link between this 404 and unsuccessful pointer gestures was established.
Backend PDF exports were not accepted in this stage. Existing Canvas coordinate
and viewer-rotation limitations remain outside this SDK-only work.

## Continue locally

Both development servers were left running. Open the parent, choose **Connect
viewer**, then **Open test PDF**. The drawing instructions explain this Canvas
build's native click-click placement and multi-click completion behavior. Use
**Check commands in both modes** for the separate acknowledgement sweep. Refresh
records, capture a baseline, switch appearance, and compare after actual drawing.
See [README.md](README.md) for restart commands and backend configuration.

## Post-bump package verification

`npm run check` passed for 2.2.6: all 68 tests, build, version and metadata
checks, source-line limits, packed ESM imports and TypeScript declarations.
No additional browser gesture run was performed for the version-only change.
