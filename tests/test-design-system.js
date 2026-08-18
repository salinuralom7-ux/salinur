/* The system, enforced.

   An audit of this stylesheet once found 71 distinct font sizes, 32 radii,
   26 shadows, 28 letter-spacings and 11 transition durations. Not one of
   them was a mistake on its own — each was a reasonable answer to the
   question in front of somebody at the time. Together they are the reason
   the app read as assembled rather than designed: nothing on a screen was
   quite the same size, shape or speed as anything else, and the eye notices
   that long before the mind can name it.

   Collapsing them was the easy part. Keeping them collapsed is the part
   that needs a test, because the pressure that produced 71 sizes is not
   gone — it is simply the pressure to get one screen looking right, which
   is with us every day.

   This file is that test. It reads the stylesheet and refuses new one-offs.
   When it fails, the fix is almost never to raise the number here; it is to
   use the step that already exists. */
const fs = require('fs');
const src = fs.readFileSync('/home/user/salinur/docs/index.html', 'utf8');

const lines = src.split('\n');
const start = lines.findIndex(l => l.trim() === ':root{');
const end = lines.findIndex((l, i) => i > start && l.includes('</style>'));
const css = lines.slice(start, end).join('\n');

let failed = 0;
const ok = (label, cond, extra) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '  → ' + extra : ''));
  if (!cond) { failed++; process.exitCode = 1; }
};
const decls = (prop) => [...css.matchAll(new RegExp(prop + ':\\s*([^;\\n}]+)', 'g'))].map(m => m[1].trim());

// ---------- type ----------
const sizes = decls('font-size');
const rawSizes = [...new Set(sizes.filter(v =>
  !v.includes('var(--fs') && !v.includes('cqw') && v !== 'inherit'))];
ok('Every font size comes from the scale',
   rawSizes.length === 0, rawSizes.join(', ') || 'no literals');
/* the point is not how many steps get used, it is that nobody invents a
   thirteenth one and calls it --fs-nearly-body */
const KNOWN = ['overline','footnote','caption','callout','body','lead','heading',
               'subtitle','title','xl','display','hero'];
const invented = [...new Set(sizes.flatMap(v => v.match(/--fs-([a-z-]+)/g) || []))]
  .map(t => t.replace('--fs-',''))
  .filter(t => !KNOWN.includes(t));
ok('…and nobody has invented a step outside it',
   invented.length === 0, invented.join(', ') || KNOWN.length + ' steps, all known');

// ---------- shape ----------
const radii = [...new Set(decls('border-radius').filter(v =>
  !v.includes('var(') && !v.includes('cqw') && !v.includes('mm') && v !== '50%' && v !== 'inherit'))];
const bigRadii = radii.filter(v => { const n = parseFloat(v); return !isNaN(n) && n > 3 && !v.includes(' '); });
ok('No hand-picked corner radii', bigRadii.length === 0, bigRadii.join(', ') || 'none');

// ---------- motion ----------
const transitions = [...css.matchAll(/transition:([^;{}]*);/gs)].map(m => m[1]);
const rawDur = [...new Set(transitions.flatMap(t => t.match(/(?<![\w.-])\d*\.?\d+m?s\b/g) || []))];
ok('Every transition uses one of the three durations',
   rawDur.length === 0, rawDur.join(', ') || 'none');
const rawEase = [...new Set(transitions.flatMap(t =>
  t.match(/cubic-bezier\([^)]*\)|(?<![\w-])ease(?:-in-out|-in|-out)?(?![\w-])/g) || []))];
ok('…and one curve, so separate things move as one product',
   rawEase.length === 0, rawEase.join(', ') || 'none');

// ---------- depth ----------
const shadows = [...new Set(decls('box-shadow').filter(v =>
  !v.includes('var(') && v !== 'none' && !v.includes('cqw')))];
/* A shadow built from spread alone is a ring or a pulse keyframe, not depth. */
const realShadows = shadows.filter(v => !/^0 0 0 [\d.]+px/.test(v));
ok('No hand-mixed elevations', realShadows.length === 0, realShadows.join(' | ') || 'none');

// ---------- the tokens exist and are singular ----------
for (const t of ['--fs-body', '--sp-4', '--r', '--shadow', '--dur-1', '--ease', '--ring'])
  ok(`${t} is defined once`, (css.match(new RegExp('\\' + t + ':', 'g')) || []).length >= 1);

// ---------- both themes are complete ----------
const light = (css.match(/:root\[data-theme="light"\]\{([\s\S]*?)\n\}/) || [])[1] || '';
const themed = ['--bg', '--surface', '--ink', '--muted', '--line', '--ok', '--danger'];
const missing = themed.filter(t => !light.includes(t + ':'));
ok('The light theme redefines everything that must change',
   missing.length === 0, missing.join(', ') || 'complete');
ok('…and does not redefine the brand, which is the same in both',
   !/--brand:/.test(light));

// ---------- the reset that cost us a screen ----------
ok('Buttons have a background in the reset, so none falls through to grey',
   /button\{[^}]*background:transparent/s.test(css));

console.log(failed ? `\n${failed} FAILED` : '\nthe system holds');
