# Task 27: Add View Sync Snapshot Alignment

## Goal

Expose the Canvas snapshot alignment messages through the core SDK so hosts can align already-open documents before relaying live pan and zoom.

## Source of Truth

`docs/docs-canvas-to-implement/VIEW_SYNC_REACT_HOST_INTEGRATION.md` defines `getViewSyncSnapshot`, `viewSyncSnapshot`, `applyViewSyncSnapshot`, and `viewSyncSnapshotApplied` and the disabled-configuration lifecycle.

## Work

1. Add `enabled?: boolean` to `configure()` without changing the default derived from `mode`.
2. Add typed, request-correlated `getSnapshot()` and `applySnapshot()` commands with validation, timeout, failure, and disconnect handling.
3. Preserve and validate the pan `coordinateMode` in live changes.
4. Update the React SDK guide to configure disabled sync, open both documents, align, then enable live sync.
5. Update `docs/version-changes/2.1.5.md`; run build, focused tests, and source-line check.

## Contract Limits

Snapshots align page offset and zoom scale only. Canvas does not change page or rotation. Canvas may reject incompatible page or viewer geometry. The host owns relay routing and document-change resets.
