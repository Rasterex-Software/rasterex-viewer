# Measurement inspection and native vertex acceptance

Local implementation, November 18, 2026. Version remains 2.2.6; no publication,
Git commit, merge, tag or Canvas/scripts change is part of this feature.

Run the existing servers as described in README.md, open the local parent,
connect, and open the test PDF or your intended document. The sample PDF's
printed green line/blue rectangle are document graphics, not annotation records.
Draw native measurements before expecting entries in Refresh measurements.

1. In Legacy, apply the synthetic test scale and draw Distance, Area, Path and
   Rectangular area. Select / stop ends creation. Refresh measurements in the
   Measurement / vertex inspection panel and choose a record.
2. Leave the vertex blank and inspect metadata. Enter vertex number 1 and inspect
   its point, previous/next edges and angle where available. UI numbers start at
   one; the SDK sends zero-based indices. Points must say nativeAnnotation.
3. Select vertex and visually verify the native selected handle. No point should
   move. Clear vertex selection; annotation selection should remain.
4. Switch to Modern and repeat; capture/compare the existing baseline to check
   GUIDs, saved coordinates, scale and stored styles. Inspection alone must not
   select a record, start SNAP, modify it or create an undo operation.
5. Inspect a measurement without a usable calibration: geometry.available false
   and its reason must display without discarding metadata. Locked/read-only
   records should remain inspectable while selection returns a native error.
6. Try an out-of-range vertex, unsupported record, other-page record or active
   native gesture. Errors should be explicit, with no invented success result.
7. Change file, page, chosen record or vertex while inspection is pending, or
   close the disclosure: stale replies must not replace current information.
   Closing invalidates display results; it does not automatically send a native
   clear command. Use Clear vertex selection explicitly before leaving the panel
   if you want to release its native selection.

Automated SDK tests verify input/response validation, both capability guards,
correlation/overlap, native failure preservation, timeouts/send failures,
destruction and parent origin/source checks. Parent type-checking covers the
built SDK integration. The agent observed a real PDF open and an acknowledged
clear-selection command against the local Canvas and real sandbox backend.
Full record inspection/handle appearance acceptance remains for the user; these
observations do not claim all native gesture cases passed. No geometry scanning
or direct iframe RXCore access is used.

Validation result: all 78 SDK/package checks and the standalone strict parent
TypeScript check passed. Version remains 2.2.6; changes are local and unpublished.

## User acceptance and version bump — November 18, 2026

The user confirmed measurement inspection and vertex selection work in Modern
and Legacy, then authorized a bump to 2.2.7. This supersedes the earlier pending
manual-acceptance status. Package metadata, both lockfile root versions and
SDK_VERSION now report 2.2.7. No npm publication or Canvas changes occurred.
