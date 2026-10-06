# npm CI/CD setup and release procedure

CI runs on PRs, main, and manual dispatch using Node 20.19.0, 22.12.0, and 24.
It checks version metadata, builds, runs tests/source limits, and tests the
actual packed package in a fresh ESM consumer with NodeNext/Bundler types.

Publishing is disabled until the repository variable `NPM_PUBLISH_ENABLED`
equals `true`. Version-tag pushes still run checks and a publish dry run.

Before enabling publication:

1. Merge workflows and required version notes into main. Require CI checks in
   main branch protection and restrict creation/modification of `v*` tags.
2. Create GitHub environment `npm-production`, add required reviewers and
   prevent self-review where available; allow only release version tags.
3. In npm settings for `@rasterex/viewer`, configure GitHub trusted publishing:
   owner `Rasterex-Software`, repository `rasterex-viewer`, workflow
   `publish.yml`, environment `npm-production`, allow direct npm publishing.
4. Enable account/organization 2FA and review/revoke obsolete write tokens.
   The workflow uses OIDC without an npm token. Trusted publishing alone does
   not prevent maintainers from publishing through other authorized methods.
5. Review the dry-run job on the first release tag before setting the variable
   to `true`. Rerun all jobs for that tag after activation, if appropriate.

Release procedure:

1. Update package.json version, both root versions in package-lock.json,
   SDK_VERSION in src/constants.ts, and docs/version-changes/<version>.md.
   Force-add release notes because this repository ignores docs/.
2. Run `npm run check`, open/merge the release PR into main.
3. Tag the approved main commit `vX.Y.Z` and push that individual tag.
4. Verify the release checks and approve `npm-production` deployment.
5. Verify the published npm version and update release-note status.

The workflow rejects tag/version mismatches and commits outside main. It does
not bump versions automatically. Existing npm versions cannot be overwritten.
Publishing currently supports stable versions only; prereleases require a
separate dist-tag policy. Local verification does not prove GitHub environment
or npm OIDC configuration: those must be verified in GitHub Actions.

Reference: https://docs.npmjs.com/trusted-publishers/ (npm >=11.5.1 and Node
>=22.14.0; release job uses Node 24 and npm 11.5.1). Public GitHub repositories
and public npm packages receive automatic provenance with trusted publishing.
