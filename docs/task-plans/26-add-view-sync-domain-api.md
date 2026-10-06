# Task 26: Add View Sync Domain API

## Goal

Expose the Canvas view synchronization broker contract through the framework-independent `@rasterex/viewer` SDK. The host decides which viewer instances belong to a group and relays view changes between them.

## Source of Truth

`docs/docs-canvas-to-implement/VIEW_SYNC_REACT_HOST_INTEGRATION.md` defines the `configureViewSync`, `viewSyncConfigured`, `viewSyncChanged`, `applyViewSync`, `viewSyncApplied`, and `viewSyncFailed` broker messages. Do not use RXCORE or add a React adapter in this task.

## Public API

* `viewer.viewSync.configure({ groupId, instanceId, mode, timeoutMs? })` sends `configureViewSync` and resolves after the matching `viewSyncConfigured` success response.
* `viewer.viewSync.on("changed", handler)` receives validated `viewSyncChanged` payloads from the configured group and instance.
* `viewer.viewSync.apply(change, { pan?, zoom? })` sends `applyViewSync` to this viewer. It returns `void`; `applied` and `failed` events expose Canvas results.
* `ViewSyncMode` is `"off" | "pan" | "zoom" | "panAndZoom"`.

## Implementation

1. Put types and broker mapping under `src/domains/view-sync/`.
2. Connect and disconnect the API with the viewer lifecycle and export its types from `src/index.ts`.
3. Validate messages and use existing broker origin/source checks. Generate a request ID for configuration and apply the existing command timeout.
4. Document a two-viewer relay using `RasterexViewer` instances, with `fileReady` as the document prerequisite.
5. Verify correlation, source-instance binding, apply payload mapping, and disconnect cleanup. Run the build and source-line check.

## Contract Limits

The Canvas document shows a `requestId` in `viewSyncConfigured` but does not explicitly guarantee echoing it. The promise-based configuration depends on that echo and times out if it is absent. `viewSyncApplied` and `viewSyncFailed` may omit `requestId`, so `apply()` is event-driven. Canvas minimum version and behavior for missing `viewSync` capability are not specified; command timeout or Canvas failure is the observable behavior.

## Completion

Update `docs/version-changes/2.1.5.md` with the public API, broker mapping, compatibility limits, and verification results. Stop after this task for user review.
