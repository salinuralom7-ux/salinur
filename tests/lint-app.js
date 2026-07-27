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
