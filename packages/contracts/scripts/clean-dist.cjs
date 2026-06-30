/**
 * Remove the previous build output so stale flat-layout files from earlier
 * single-target builds do not linger beside the dual (cjs/esm) output.
 */
const { rmSync } = require('node:fs');
const { join } = require('node:path');

rmSync(join(__dirname, '..', 'dist'), { recursive: true, force: true });
