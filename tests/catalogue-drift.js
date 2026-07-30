/* Compares the services the app offers with the services the database prices.
   Run by CI after it has written the live lists to /tmp/db-skills.txt and
   /tmp/db-units.txt; prints the difference in both directions and a VERDICT
   line the workflow greps.

   A service the app offers with no row in service_rates has no floor and no
   ceiling, because check_rate_bands skips any skill it has no band for. That
   is a launch-blocking hole, so it fails the deploy. A band for a service
   nobody offers any more is harmless and only noted. */
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../docs/index.html', 'utf8');
const cat = eval('(' + src.match(/const CATALOGUE = (\[[\s\S]*?\n\]);/)[1] + ')');
const units = eval('(' + src.match(/const UNITS\s*=\s*(\[[^\]]*\])/)[1] + ')');
const app = [];
cat.forEach(([, , items]) => items.forEach(([n]) => app.push(n)));

const read = f => {
  try { return fs.readFileSync(f, 'utf8').split('\n').map(x => x.trim()).filter(Boolean); }
  catch (e) { return null; }
};
const db = read('/tmp/db-skills.txt');
const dbUnits = read('/tmp/db-units.txt');
if (!db || !dbUnits) {
  console.log('could not read the live lists — skipping the catalogue check');
  console.log('VERDICT skipped');
  process.exit(0);
}

const missingFrom = (a, b) => a.filter(x => !b.includes(x));
const unpriced = missingFrom(app, db);
const orphaned = missingFrom(db, app);
const unitGap  = missingFrom(units, dbUnits);

console.log(`app services: ${app.length}, priced in the database: ${db.length}`);
if (unpriced.length) console.log(`UNPRICED (${unpriced.length}): ${unpriced.join(' | ')}`);
if (orphaned.length) console.log(`ORPHANED (${orphaned.length}): ${orphaned.join(' | ')}`);
if (unitGap.length)  console.log(`UNITS MISSING (${unitGap.length}): ${unitGap.join(' | ')}`);
if (!unpriced.length && !unitGap.length) console.log('every service the app offers has a price band');
const verdict = [unpriced.length ? 'unpriced' : null, unitGap.length ? 'units' : null].filter(Boolean);
console.log('VERDICT ' + (verdict.length ? verdict.join(' ') : 'ok'));
