const fs = require('fs');
const src = fs.readFileSync('/home/user/salinur/docs/index.html','utf8');
const cat = eval('(' + src.match(/const CATALOGUE = (\[[\s\S]*?\n\]);/)[1] + ')');
const band = eval('(' + src.match(/const RATE_BAND = (\{[\s\S]*?\n\});/)[1] + ')');
const unit = {}; cat.forEach(([k,l,items]) => items.forEach(([n,u]) => unit[n] = u));
// plausibility ceiling per unit for a single tradesperson in Guwahati
const byUnit = {};
for (const [n,u] of Object.entries(unit)) (byUnit[u] ||= []).push(n);
for (const [u, names] of Object.entries(byUnit)) {
  console.log('\n### ' + u);
  names.map(n => [n, band[n]]).sort((a,b)=>(b[1]?.[1]||0)-(a[1]?.[1]||0))
    .forEach(([n,b]) => console.log('   ' + String(b?b[0]:'-').padStart(7) + ' – ' + String(b?b[1]:'-').padStart(7) + '   ' + n));
}
console.log('\nskills:', Object.keys(unit).length, ' bands:', Object.keys(band).length,
  ' missing band:', Object.keys(unit).filter(n=>!band[n]).join(', ') || 'none',
  ' band without skill:', Object.keys(band).filter(n=>!unit[n]).join(', ') || 'none');
console.log('units used but not in UNITS list:',
  [...new Set(Object.values(unit))].filter(u => !src.match(/const UNITS\s*=\s*(\[[^\]]*\])/)[1].includes('"'+u+'"')).join(', ') || 'none');
