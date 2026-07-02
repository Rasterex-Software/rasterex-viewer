# Contributing

Internal notes for developing, testing, and publishing the Rasterex Viewer SDK.

## Local Setup

```sh
npm install
npm run build
```

Run the local vanilla demo:

```sh
npm run dev
```

The demo imports local source code and does not require the package to be published.

## Package Build

```sh
npm run build
```

The build removes `dist/` and runs the TypeScript SDK build.

## Publishing

The package is configured for public npm publishing:

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

Before publishing:

```sh
npm run build
```

Publish with public access:

```sh
npm publish --access public
```

If npm requires two-factor authentication:

```sh
npm publish --access public --otp=123456
```

If publishing with an npm token, use a granular access token that has publish permission for the package scope. If the organization requires 2FA for publishing, the token must have bypass 2FA enabled.

PowerShell example:

```powershell
$env:NPM_TOKEN="your_token_here"
npm publish --access public --//registry.npmjs.org/:_authToken=$env:NPM_TOKEN
```

For a first publish under the Rasterex scope, the npm account or token must be allowed to create packages in the organization:

```sh
npm whoami
npm org ls rasterex
npm config get registry
npm config get @rasterex:registry
```

The registry should be:

```txt
https://registry.npmjs.org/
```

## Documentation

The npm-facing package README should stay short and consumer-focused.

Deep user docs live under:

```txt
docs/live-npm/
```

Internal planning docs live under:

```txt
docs/task-plans/
docs/phases/
docs/planning/
```

## Version Change Notes

Every functional, public API, protocol, compatibility, or behavior change must be tracked in:

```txt
docs/version-changes/<version>.md
```

Use:

```txt
docs/version-changes/VERSION_CHANGE_TEMPLATE.md
```

These notes are the source material for release notes, migration docs, and generated user documentation.
