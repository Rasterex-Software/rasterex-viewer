# Rasterex Viewer Protocol

Shared protocol contract for Rasterex Viewer SDK and Canvas integrations.

The protocol is the product boundary.

This package owns shared constants and types that must be used by both the SDK and Canvas implementation. Do not redefine envelope shapes, capability names, error codes, or handshake types independently in consuming packages.

## Scope

Initial package contents:

* Protocol constants
* Message envelope types
* Handshake types
* Capability constants
* Error code constants
* Compatibility state types

## Out Of Scope

This package does not implement iframe transport, postMessage handling, SDK lifecycle, Canvas command handlers, or domain APIs.
