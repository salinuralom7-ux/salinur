/* Run every harness in this directory, one at a time, and say plainly which
   ones are not clean.

   There was no way to do this before, which is how five files came to be
   broken for reasons that had nothing to do with the code they tested: one
   waited thirty seconds for a button deleted in a redesign, one required a
   module that is not installed, two called getComputedStyle on an element
   that no longer exists. Each of them printed a stack trace and stopped, and
   because nobody ran the whole set in one go, nobody saw it.

   Two things this has to get right.

   They share ports, so they run in sequence, not in parallel.

   Not every file counts assertions. Most print PASS/FAIL lines; some
   (test-pages, test-paging, test-pwa, test-bulk, test-upload, sweep) print a
   report for a person to read, and a runner that treats "no PASS lines" as a
   failure cries wolf on all six of them. A report file is judged on its exit
   code alone.

     node tests/run-all.js              every test-*.js
     node tests/run-all.js --checks     the check-*.js and the reports too
     node tests/run-all.js test-ks.js   just these
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TIMEOUT = 150000;

const args = process.argv.slice(2);
const withChecks = args.includes('--checks');
const named = args.filter(a => !a.startsWith('--'));

const files = named.length ? named
  : fs.readdirSync(DIR)
      .filter(f => /^test-.*\.js$/.test(f) || (withChecks && /^check-.*\.js$/.test(f)))
      .sort();

const run = f => new Promise(resolve => {
  const started = Date.now();
  const p = spawn('node', [path.join(DIR, f)], { cwd: DIR });
  let out = '', killed = false;
  const timer = setTimeout(() => { killed = true; p.kill('SIGKILL'); }, TIMEOUT);
  p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => out += d);
  p.on('close', code => {
    clearTimeout(timer);
    resolve({ f, out, code: killed ? 'TIMEOUT' : code,
              secs: Math.round((Date.now() - started) / 1000) });
  });
});

(async () => {
  const rows = [];
  for (const f of files) {
    const r = await run(f);
    r.pass = (r.out.match(/^PASS/gm) || []).length;
    r.fail = (r.out.match(/^FAIL/gm) || []).length;
    r.skip = (r.out.match(/^SKIP/gm) || []).length;
    /* A file with no PASS lines at all is a report, not a silent failure —
       unless it also died, which the exit code says. */
    r.report = r.pass === 0 && r.fail === 0;
    r.clean = r.code === 0 && r.fail === 0;
    rows.push(r);
    const tally = r.report ? '(report)'
      : `${r.pass} pass` + (r.fail ? `, ${r.fail} FAIL` : '') + (r.skip ? `, ${r.skip} skipped` : '');
    console.log(`${r.clean ? 'ok  ' : 'BAD '} ${f.padEnd(24)} ${String(r.secs).padStart(3)}s  ${tally}`);
  }

  const bad = rows.filter(r => !r.clean);
  console.log(`\n${rows.length} files, ${rows.reduce((a, r) => a + r.pass, 0)} assertions, ${bad.length} not clean`);
  for (const r of bad) {
    console.log(`\n──── ${r.f}  (exit ${r.code})`);
    const lines = r.out.split('\n').filter(l => /^FAIL/.test(l));
    console.log(lines.length ? lines.map(l => '  ' + l).join('\n')
                             : '  ' + r.out.trim().split('\n').slice(-6).join('\n  '));
  }
  process.exitCode = bad.length ? 1 : 0;
})();
