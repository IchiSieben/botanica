// Every DOI cited anywhere in src/ must resolve: doi.org handle API, responseCode 1.
// Usage: npm run check:dois   (network required; exit 1 on any DOI that does not resolve)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk('src'), '../CHANGELOG.md', '../CHANGELOG.es.md', '../README.md'].filter((f) => { try { return statSync(f).isFile(); } catch { return false; } });
const dois = new Set();
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?:doi:\s*['"]|doi\.org\/)(10\.\d{4,9}\/[^\s'"`)<>\]]+)/g)) dois.add(m[1].replace(/[.,;]$/, ''));
}
let bad = 0;
for (const d of [...dois].sort()) {
  const r = await fetch(`https://doi.org/api/handles/${d}`).then((x) => x.json()).catch(() => ({}));
  const ok = r.responseCode === 1;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${d}`);
}
console.log(bad ? `\n${bad} DOI(s) do not resolve` : `\n${dois.size} DOIs resolve`);
process.exit(bad ? 1 : 0);
