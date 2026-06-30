/**
 * Emits the design-token artifacts from the single TypeScript source:
 *   - dist/tokens.css   (CSS custom properties for the web dashboard)
 *   - dart/fleet_tokens.dart (Dart token map for the Flutter apps)
 *
 * Run after `tsc` (the package build script does both). Importing from the
 * compiled `dist/` keeps one source of truth — these files are generated, not
 * hand-edited.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toCss, toDart } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const cssPath = resolve(pkgRoot, 'dist', 'tokens.css');
const dartPath = resolve(pkgRoot, 'dart', 'fleet_tokens.dart');

mkdirSync(dirname(cssPath), { recursive: true });
mkdirSync(dirname(dartPath), { recursive: true });

writeFileSync(cssPath, toCss(), 'utf8');
writeFileSync(dartPath, toDart() + '\n', 'utf8');

console.log(`design-tokens: wrote ${cssPath}`);
console.log(`design-tokens: wrote ${dartPath}`);
