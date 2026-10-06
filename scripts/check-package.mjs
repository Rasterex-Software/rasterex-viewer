import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const root = process.cwd();
const temp = mkdtempSync(join(tmpdir(), 'rasterex-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (command, args, cwd = root) => execFileSync(command, args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, npm_config_cache: join(temp, 'cache') }
});
try {
  const [packed] = JSON.parse(run(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', temp]));
  const files = new Set(packed.files.map(file => file.path));
  for (const file of ['dist/index.js', 'dist/index.d.ts', 'dist/demo-presets.js', 'dist/demo-presets.d.ts', 'LICENSE', 'README.md', 'SECURITY.md']) {
    assert.ok(files.has(file), `Missing packed file: ${file}`);
  }
  for (const file of files) {
    assert.ok(file.startsWith('dist/') || ['package.json', 'README.md', 'LICENSE', 'SECURITY.md'].includes(file), `Unexpected packed file: ${file}`);
  }
  const consumer = join(temp, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', join(temp, packed.filename)], consumer);
  writeFileSync(join(consumer, 'smoke.mjs'), `import assert from 'node:assert/strict';
import { createViewer, SDK_VERSION } from '@rasterex/viewer';
import { sandboxCanvas } from '@rasterex/viewer/demo-presets';
assert.equal(typeof createViewer, 'function');
assert.equal(SDK_VERSION, ${JSON.stringify(packed.version)});
assert.equal(typeof sandboxCanvas.viewerUrl, 'string');
`);
  run(process.execPath, ['smoke.mjs'], consumer);
  writeFileSync(join(consumer, 'smoke.ts'), `import { createViewer } from '@rasterex/viewer';
import { sandboxCanvas } from '@rasterex/viewer/demo-presets';
const factory: typeof createViewer = createViewer;
const url: string = sandboxCanvas.viewerUrl;
void factory; void url;
`);
  for (const mode of ['NodeNext', 'Bundler']) {
    run(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--strict', '--noEmit', '--target', 'ES2020', '--module', mode === 'NodeNext' ? 'NodeNext' : 'ESNext', '--moduleResolution', mode, 'smoke.ts'], consumer);
  }
  console.log(`Packed ESM imports and TypeScript declarations verified: ${packed.filename}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
