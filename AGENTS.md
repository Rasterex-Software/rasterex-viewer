# Rasterex npm SDK Agent Instructions

## Purpose

Guide agents working in this repo.

Build a lightweight, framework-independent npm SDK for embedding Rasterex hosted viewer/demo pages and on-premises Canvas deployments inside client applications through an iframe.

The protocol is the product boundary.

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

For Phase 1/core migration, do not start SDK messaging work until the shared protocol package and human-readable protocol spec exist.

The SDK must not privately invent protocol strings, capability names, envelope shapes, or error codes that Canvas defines separately. Shared protocol definitions must be the source of truth.

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
Message Client
  |
  v
Iframe Transport
  |
  v
Canvas Protocol Implementation
```

Core responsibilities:

* `RasterexViewer` owns iframe lifecycle and viewer state
* `createViewer` is a factory over `RasterexViewer`
* `IframeTransport` owns low-level `postMessage` send/receive and origin/source validation
* `MessageClient` owns request IDs, response matching, command timeouts, and pending request cleanup
* Domain APIs such as documents, tools, annotations, measurements, export, compare, 3D, collaboration, and styles must be thin wrappers over `MessageClient`
* Diagnostics are infrastructure events and must stay separate from Canvas/application events
* Compatibility checks must use the shared protocol package and compatibility matrix

Do not put every future method directly on `RasterexViewer`. Add domain APIs only when their task plan or feature document defines the public API, payload, response, capability, and errors.

Keep implementation changes small and scoped. Do not introduce broad refactors, new frameworks, runtime dependencies, telemetry, CDN references, or Canvas Angular code unless the active task explicitly requires it.

Production entrypoints must stay air-gap safe. Demo URLs and hosted references belong only in demo-specific files or entrypoints.

## Feature Documentation Intake Rule

When the user provides an MD file or notes for a feature such as opening files, tools, annotations, measurements, export, save, 3D, or collaboration, first read it and map it to the protocol-first architecture.

If the feature document is incomplete, ambiguous, internally inconsistent, or missing information needed to design a safe public API/protocol contract, ask concise clarifying questions before implementing.

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

When information is incomplete, write down the gap and ask concise clarifying questions before implementing. Prefer an explicit blocked decision over a guessed protocol contract.

Any proposed protocol, command, capability, error code, or compatibility rule must be traceable to one of:

* `@rasterex/viewer-protocol`
* `docs/planning/protocol-v1.md`
* `docs/phases/`
* `docs/task-plans/`
* A user-provided feature MD file
* A user-confirmed decision in the current thread

If a decision is inferred rather than confirmed, label it as an inference in the relevant planning or version-change document.
