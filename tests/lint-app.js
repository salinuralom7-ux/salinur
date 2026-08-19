const fs = require('fs');
const s = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');
/* The app is not the first <script> in the file any more — a small one in
   the head decides the theme before the first paint. Take the biggest block,
   which is the app by four orders of magnitude, rather than the first. */
const blocks = [...s.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map(x => x[1]);
const js = blocks.sort((a, b) => b.length - a.length)[0];
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
/* `onclick="if(event.target===this)closeModal(...)"` is the overlay
   dismiss idiom, used a dozen times. The pattern above reads the `if` as a
   function name and reports it every run, which is exactly how a real
   undefined handler would go unnoticed in the noise. */
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'return', 'typeof', 'catch']);
const undef = [...handlers].filter(h => !defined.has(h) && !KEYWORDS.has(h));
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

/* closeModal() calls history.back(), which fires after the current task. A
   function that closes a sheet and then navigates therefore navigates first
   and is undone a moment later by the queued pop — the screen simply does not
   change, with nothing in the console. It cost the account offer's Sign up
   button, and two more functions had it latent. hideModal is the one to use:
   go() consumes the sheet's history entry itself. */
{
  const bad = [];
  for (const m of js.matchAll(/\n(?:async )?function (\w+)\([^)]*\)\{/g)) {
    let i = m.index + m[0].length, depth = 1;
    while (i < js.length && depth) { const c = js[i++]; if (c === '{') depth++; else if (c === '}') depth--; }
    const body = js.slice(m.index + m[0].length, i);
    const close = [...body.matchAll(/closeModal\(/g)].map(x => x.index);
    const nav   = [...body.matchAll(/\bgo\("|showAccount\(|openChat\(/g)].map(x => x.index);
    /* Only when the close can actually reach the navigation. A guard clause
       that closes the sheet and returns is fine — nothing follows it. */
    const reaches = close.some(c => nav.some(n => n > c && !/\breturn\b/.test(body.slice(c, n))));
    if (reaches) bad.push(m[1]);
  }
  console.log('closeModal before a navigation:', bad.length ? bad.join(', ') : 'none');
  if (bad.length) process.exitCode = 1;
}
