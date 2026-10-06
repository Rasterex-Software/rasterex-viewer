# Task 29 — ESM npm CI/CD

Implement the user-approved B2/B6 foundation using the existing ESM exports.
Run version consistency, build, unit tests, source-line checks, packed-file
validation, fresh tarball installation, ESM root/subpath imports, and TypeScript
NodeNext/Bundler consumer checks on PRs and main. Publish only stable matching
version tags whose commit belongs to main. Use npm OIDC and an approval
environment. Default publishing to disabled until administrators complete setup.
No SDK runtime, export-map, CommonJS, or Canvas changes. Browser tests, full
bundler builds, publint, and README snippet extraction remain separate work.

Acceptance: local checks pass; workflows and activation steps are reviewable;
no npm publication is performed during implementation.
