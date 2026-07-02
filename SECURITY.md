# Security Policy

## Supported Package

Security reports for this repository should focus on the npm SDK package.

In scope:

- The published SDK package contents.
- SDK iframe creation, origin validation, and `postMessage` handling.
- SDK command validation and public API behavior.
- Package metadata, dependency declarations, and release artifacts.
- Build and publish configuration used to release the SDK.

Out of scope for this SDK package:

- Rasterex Canvas application source code.
- Hosted Rasterex viewer services.
- Server components, storage, processing backends, and customer deployments.
- Viewer assets or deployment configuration not shipped in this npm package.

## Reporting A Vulnerability

Report suspected vulnerabilities privately to the package maintainers.

Include:

- Affected package name and version.
- Reproduction steps or proof of concept.
- Expected and actual behavior.
- Browser, framework, and Canvas deployment details when relevant.

Do not open a public issue for an unpatched vulnerability.

## Supply Chain Posture

The SDK is intended to stay lightweight and air-gap friendly:

- No runtime npm dependencies.
- No install-time scripts.
- No telemetry.
- No CDN dependency.
- No bundled Rasterex Canvas Angular application.
- Production applications should pass an explicit `viewerUrl` for their hosted or on-premises Canvas deployment.

Before publishing, maintainers should run:

```sh
npm audit --omit=dev
npm audit
npm pack --dry-run
```

Publishing should use npm provenance when the package is released from a supported CI environment.
