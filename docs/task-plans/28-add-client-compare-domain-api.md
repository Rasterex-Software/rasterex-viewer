# Task 28: Add Client Compare Domain API

## Goal

Expose Canvas client-side comparison through a new framework-independent `viewer.clientCompare` npm domain. Existing server-side `viewer.compare` behavior remains unchanged.

## Source of Truth

`docs/docs-canvas-to-implement/CLIENT_COMPARE_POSTMESSAGE_API.md` defines the Canvas broker messages:

* `clientCompare` / `clientCompareReady` / `clientCompareFailed`
* `clientCompareSetOpacity` / `clientCompareOpacityChanged`
* `clientCompareSetCommonLevel` / `clientCompareCommonLevelChanged`
* `clientCompareAlignStart` / `clientCompareAlignStarted` / `clientCompareAlignComplete` / `clientCompareAlignFailed`
* `clientCompareClose` / `clientCompareClosed`

## Public API

* `viewer.clientCompare.create(options)` returns a promise for the ready result.
* `viewer.clientCompare.setOpacity(value, options?)` returns a promise for the acknowledgement.
* `viewer.clientCompare.setCommonLevel(level, options?)` returns a promise for the acknowledgement.
* `viewer.clientCompare.startAlign(options?)` returns the start acknowledgement; final completion is emitted through `on("alignComplete")`.
* `viewer.clientCompare.close(options?)` returns a promise for the close acknowledgement.
* `viewer.clientCompare.on(...)` exposes ready, property-change, alignment, close, and failure events.

## Boundaries

Do not change `viewer.compare`, React adapters, Canvas source, or Protocol V1. Use the existing broker origin/source checks, command timeout, and SDK command error model.

## Validation

Validate source presence, source string difference, hex/RGB colors, opacity `0..100`, and common level integer `1..10`. Do not attempt to resolve URLs or determine physical file identity in the SDK.
