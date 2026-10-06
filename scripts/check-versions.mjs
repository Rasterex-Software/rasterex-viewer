import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const sdk = readFileSync('src/constants.ts', 'utf8').match(/SDK_VERSION\s*=\s*"([^"]+)"/)?.[1];
assert.equal(lock.version, pkg.version, 'Lockfile version mismatch');
assert.equal(lock.packages[''].version, pkg.version, 'Lockfile root version mismatch');
assert.equal(sdk, pkg.version, 'SDK_VERSION mismatch');
assert.ok(existsSync(`docs/version-changes/${pkg.version}.md`), 'Missing release notes');
if (process.argv[2]) {
  assert.match(process.argv[2], /^v\d+\.\d+\.\d+$/, 'Only stable release tags are supported');
  assert.equal(process.argv[2], `v${pkg.version}`, 'Release tag/version mismatch');
}
console.log(`Version metadata verified: ${pkg.version}`);
