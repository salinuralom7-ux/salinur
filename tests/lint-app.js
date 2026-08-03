const fs = require('fs');
const s = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
const m = s.match(/<script>\n([\s\S]*?)\n<\/script>/);
const js = m[1];
try { new Function(js); console.log('JS parses: OK'); }
catch (e) { console.log('JS PARSE ERROR:', e.message); process.exitCode = 1; }

const ids = new Set([...s.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(x => x[1]));
const used = new Set([...js.matchAll(/\$\("([A-Za-z0-9_-]+)"\)/g)].map(x => x[1]));
const missing = [...used].filter(u => !ids.has(u));
console.log('$() targets with no element:', missing.length ? missing.join(', ') : 'none');

const defined = new Set([...js.matchAll(/(?:^|\n)(?:async )?function ([A-Za-z0-9_]+)/g)].map(x => x[1])
  .concat([...js.matchAll(/(?:const|let|var) ([A-Za-z0-9_]+) = (?:async )?(?:function|\()/g)].map(x => x[1])));
const handlers = new Set([...s.matchAll(/\bon[a-z]+="\s*([A-Za-z0-9_]+)\(/g)].map(x => x[1])
  .concat([...js.matchAll(/onclick=\\?["']([A-Za-z0-9_]+)\(/g)].map(x => x[1])));
const undef = [...handlers].filter(h => !defined.has(h));
console.log('inline handlers not defined:', undef.length ? undef.join(', ') : 'none');

// CSS sanity: every rule closes
const css = s.match(/<style>\n([\s\S]*?)\n<\/style>/)[1];
let depth = 0, bad = 0;
for (const c of css) { if (c === '{') depth++; else if (c === '}') { depth--; if (depth < 0) bad++; } }
console.log('CSS braces balanced:', depth === 0 && bad === 0 ? 'yes' : `NO (depth ${depth}, ${bad} stray)`);

/* Two top-level functions with the same name is not an error anywhere — the
   second silently replaces the first, and the button wired to the first stops
   working with nothing in the console. It happened once: a customer
   saveProfile() 2,700 lines below the worker's took over Publish my profile.
   In one 10,000-line file this is the failure mode to watch for. */
const seen = new Set(), dupes = new Set();
for (const [, n] of js.matchAll(/(?:^|\n)(?:async )?function ([A-Za-z0-9_]+)/g))
  (seen.has(n) ? dupes : seen).add(n);
console.log('functions declared twice:', dupes.size ? [...dupes].join(', ') : 'none');
if (dupes.size) process.exitCode = 1;

/* Same shape of problem in the markup: $() and getElementById take the first
   match, so a duplicated id means half the page is writing to an element
   nobody can see. */
const idList = [...s.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(x => x[1]);
const dupIds = idList.filter((v, i) => idList.indexOf(v) !== i);
console.log('duplicate element ids:', dupIds.length ? [...new Set(dupIds)].join(', ') : 'none');
if (dupIds.length) process.exitCode = 1;
