# Rasterex npm SDK Agent Instructions

## Purpose

Guide agents working in this repo.

Build a lightweight, framework-independent npm SDK for embedding Rasterex hosted viewer/demo pages and on-premises Canvas deployments inside client applications through an iframe.

The Canvas broker message contract is the active product boundary.

## Source Of Truth

Use these docs instead of putting phase details in this file:

* `docs/phases/README.md`
* `docs/phases/phase-0-iframe-demo-loader.md`
* `docs/phases/phase-1-core-enterprise-sdk.md`
* `docs/planning/phase-1-enterprise-sdk.md`
* `docs/planning/protocol-v1.md`
* `docs/planning/version-change-log-process.md`
* `docs/task-plans/README.md`
* `docs/version-changes/VERSION_CHANGE_TEMPLATE.md`

## Core Architecture Rules

The npm package must not include the full Rasterex Canvas Angular application.

Hosted demos, on-premises Canvas applications, and the npm SDK remain separate:

```txt
Client Application
    |
    v
Rasterex npm SDK
    |
    v
iframe
    |
    v
Hosted Rasterex demo / Canvas URL
```

Do not implement protocol messaging, postMessage commands, document APIs, tools, annotations, export, save, measurement, 3D, or framework adapters unless the active task plan explicitly calls for it.

## Work Execution Rules

Work one task plan at a time using the ordered files in `docs/task-plans/`.

After completing a task plan, stop and verify the result with the user before starting the next task. Do not automatically continue from one task plan to the next.

For current SDK work, use the Canvas broker `{ type, payload }` message contract as the active integration path.

The SDK must not privately invent Canvas broker command names, callback names, payload shapes, or error semantics. Canvas-provided docs or confirmed decisions must be the source of truth.

## Code And Structure Rules

Keep the SDK framework-independent at the core. Framework-specific code belongs only in explicit adapter entrypoints such as `/react` or `/vue`, and only when a task plan calls for it.

Respect the planned architecture:

```txt
Client App
  |
  v
Framework Adapter or Core SDK API
  |
  v
Viewer Controller
  |
  v
Canvas Message Broker
  |
  v
Canvas `{ type, payload }` Implementation
```

Core responsibilities:

* `RasterexViewer` owns iframe lifecycle and viewer state
* `createViewer` is a factory over `RasterexViewer`
* `CanvasMessageBroker` owns active Canvas broker `postMessage` send/receive behavior and origin/source validation
* `IframeTransport` and `MessageClient` are lower-level compatibility/future-handshake primitives, not the active domain API path
* Domain APIs such as documents, tools, annotations, measurements, export, compare, 3D, collaboration, and styles must be thin wrappers over Canvas broker commands/events
* Diagnostics are infrastructure events and must stay separate from Canvas/application events
* Compatibility checks must use SDK-local constants and the compatibility matrix

Do not put every future method directly on `RasterexViewer`. Add domain APIs only when their task plan or feature document defines the public API, payload, response, capability, and errors.

Keep implementation changes small and scoped. Do not introduce broad refactors, new frameworks, runtime dependencies, telemetry, CDN references, or Canvas Angular code unless the active task explicitly requires it.

## Source File Size Rule

Production TypeScript files under `src/` must not exceed 500 lines. At 400 lines,
treat the file as a refactoring signal; before it exceeds 500 lines, split it by
cohesive responsibility. Use domain-local folders such as `src/domains/documents/`
for a domain's types, broker payload mapping, and lifecycle helpers. Do not create
a global types folder for domain-specific types.

Four pre-existing files are held to their checked-in legacy baseline by
`scripts/check-source-line-limit.mjs`; they must not grow and should be reduced
below 500 lines when their domain is next materially changed. All new and
refactored source files must meet the 500-line limit now.

Run `npm run check:source-lines` before handing off source changes. The limit
excludes generated output and only permits the named, non-increasing legacy
baselines above.

Production entrypoints must stay air-gap safe. Demo URLs and hosted references belong only in demo-specific files or entrypoints.

## Feature Documentation Intake Rule

When the user provides an MD file or notes for a feature such as opening files, tools, annotations, measurements, export, save, 3D, or collaboration, first read it and map it to the Canvas broker architecture.

If the feature document is incomplete, ambiguous, internally inconsistent, or missing information needed to design a safe public API or Canvas broker contract, ask concise clarifying questions before implementing.

Clarify at least:

* Expected public SDK API
* Canvas-side command/event behavior
* Message payload and response shape
* Required capabilities
* Error cases and error codes
* On-premises and air-gap constraints
* Version or compatibility impact
* Documentation notes for the version change file

## Version Change Tracking Requirement

Every functional, public API, protocol, compatibility, or behavior change must be tracked in a version change markdown file:

```txt
docs/version-changes/<version>.md
```

Use:

```txt
docs/version-changes/VERSION_CHANGE_TEMPLATE.md
```

Purpose: a documentation agent should be able to read the version change markdown file and generate user-facing docs, migration notes, and release notes without reverse-engineering git history.

Do not rely only on `README.md` or git commits for release knowledge.

### Mandatory Version-Bump Checklist

When a user requests a package version update, all of these steps are required
before handoff:

1. Update `version` in `package.json`.
2. Update the root package version and `packages[""].version` in
   `package-lock.json` when the lockfile exists.
3. Update `SDK_VERSION` in `src/constants.ts` so handshakes, diagnostics, and
   compatibility checks report the package version.
4. Create `docs/version-changes/<version>.md` from
   `docs/version-changes/VERSION_CHANGE_TEMPLATE.md`, with enough detail for
   release notes and migration documentation.
5. Verify `package.json`, the lockfile when present, and `SDK_VERSION` all
   contain the same version, then run the relevant build and source-line
   checks.

Do not treat a version bump as complete if any applicable checklist item is
missing.

## Anti-Hallucination Rules

Do not invent Canvas behavior.

If Canvas-side behavior is unknown, mark it as unknown and ask the user for the relevant MD file, source code, API notes, or confirmation.

Do not assume:

* Hosted demo URLs support postMessage commands
* Canvas already emits `viewer.ready`
* Canvas supports a command, event, capability, or error code
* A capability name exists
* A command payload or response shape exists
* A document/open-file flow supports headers, tokens, blobs, file IDs, or URLs unless documented
* On-premises deployments use root path, HTTPS, default ports, or same-origin hosting
* Browser iframe errors can reliably distinguish 404, 500, DNS failure, and network failure

When information is incomplete, write down the gap and ask concise clarifying questions before implementing. Prefer an explicit blocked decision over a guessed Canvas broker contract.

Any proposed command, callback, payload, capability, error code, or compatibility rule must be traceable to one of:

* `src/protocol/`
* `docs/planning/protocol-v1.md`
* `docs/phases/`
* `docs/task-plans/`
* A user-provided feature MD file
* A user-confirmed decision in the current thread

If a decision is inferred rather than confirmed, label it as an inference in the relevant planning or version-change document.
