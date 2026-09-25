// Builds a second copy of the site with PUBLIC_TEST_HOOKS=1, into dist-test/, so
// window.__phylo (scripts/tree.ts) exists for scripts/gate-tree.mjs without ever
// shipping in the production build (`npm run build` -> dist/, hook absent).
// Cross-platform (no inline VAR=val shell syntax): the env var is set in this
// process's env, not in package.json.
//
//   node scripts/build-test.mjs
import { spawnSync } from 'node:child_process';

const r = spawnSync(process.execPath, ['node_modules/astro/astro.js', 'build', '--outDir', 'dist-test'], {
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_TEST_HOOKS: '1' },
});
process.exit(r.status ?? 1);
