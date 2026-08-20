/* The weekly operations report reads the live database on a schedule and
   commits what it finds to a public repository. Two properties keep that
   safe, and neither is obvious from reading the file, so both are asserted
   here rather than left to whoever edits it next.

   It only ever reads. Nothing in the automation holds a database password —
   the workflow sends a query that is already committed, so what it can do is
   whatever this file says and nothing else. A stray `update` in it would be
   a scheduled write to production with no review in front of it.

   It never fetches a person. Not "never prints" — never fetches. A column
   that is selected and then dropped in the rendering is still a column that
   travelled, and the next person to add a line to the report will reach for
   whatever is already in scope. Job codes count as personal here for a
   different reason: cancel_job() takes a code and no token, so a code in a
   public file is a stranger's cancel button. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sql = fs.readFileSync(path.join(ROOT, '.github/ops-report.sql'), 'utf8');
const yml = fs.readFileSync(path.join(ROOT, '.github/workflows/ops-report.yml'), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); cond ? pass++ : fail++; };

/* Comments explain the thing at length and use these words in prose. */
const bare = sql.replace(/--.*$/gm, '');

const WRITES = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|copy|call|do|vacuum|refresh)\b/gi;
const found = bare.match(WRITES);
ok(!found, 'the report query contains no write statement' + (found ? ` (found ${[...new Set(found)].join(', ')})` : ''));

ok((bare.match(/;/g) || []).length === 1,
   'the report query is exactly one statement');

/* Everything that identifies somebody. `name` needs a boundary that does not
   also catch `worker_name`-free prose, so the columns are named outright. */
const PERSONAL = ['phone', 'customer_name', 'customer_phone', 'customer_token',
                  'requester', 'selfie', 'reg_number', 'w.name', 'j.code',
                  't.code', 'worker_name', '.email'];
for (const col of PERSONAL)
  ok(!bare.includes(col), `the report query never selects ${col}`);

/* The guards in the workflow are the second line of defence. If somebody
   deletes a step because it was in the way, this says so. */
ok(/Refuse to run anything that writes/.test(yml), 'the workflow refuses to send a query that writes');
ok(/Refuse to publish anything personal/.test(yml), 'the workflow refuses to commit a report with personal data in it');
ok(/read_only: true/.test(yml), 'the request asks Supabase for a read-only transaction');
ok(/\[6-9\]\[0-9\]\{9\}/.test(yml), 'the workflow greps the rendered report for a phone number');
ok(/\[0-9A-F\]\{10\}/.test(yml), 'the workflow greps the rendered report for a job code');
ok(/add-mask/.test(yml), 'the Supabase token is masked in the log');
ok(/schedule:/.test(yml) && /cron:/.test(yml), 'the report is scheduled, not only manual');
ok(/workflow_dispatch/.test(yml), 'the report can also be run on demand');

/* The workflow only ever writes this one file. `git add .` in a job with
   contents:write and a live checkout would commit whatever else the run
   happened to leave lying around. */
ok(!/git add \.[\s$]/.test(yml) && /git add \.github\/ops-report\.md/.test(yml),
   'the workflow commits the report and nothing else');

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
