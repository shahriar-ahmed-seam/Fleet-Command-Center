/**
 * Write per-directory `package.json` "type" markers into the dual build output.
 *
 * The package root is CommonJS by default, so files under dist/cjs are already
 * interpreted as CommonJS. The dist/esm tree is marked `"type": "module"` so
 * Node treats its `.js` files as ES modules. This lets a single package expose
 * both a `require` (CJS) and an `import` (ESM) entry point.
 */
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const dist = join(__dirname, '..', 'dist');

const targets = [
  { dir: join(dist, 'cjs'), type: 'commonjs' },
  { dir: join(dist, 'esm'), type: 'module' },
];

for (const { dir, type } of targets) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`);
}
