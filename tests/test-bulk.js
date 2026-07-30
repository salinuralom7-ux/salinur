const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');
const html = fs.readFileSync('/home/user/salinur/docs/index.html','utf8');
const srv = http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end(html);}).listen(8803);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  // no admin PIN ships in the source any more; preview mode mints one per browser
  await ctx.addInitScript(() => localStorage.setItem('nearse_preview_admin', '4242'));
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8803/'); await p.waitForTimeout(600);

  // 30 profiles awaiting review, each with a known WhatsApp code
  const codes = await p.evaluate(() => {
    const all = [], codes = [];
    for (let i = 1; i <= 30; i++) {
      const code = String(100000 + i * 7);
      codes.push(code);
      all.push({ id:'q'+i, created_at:new Date().toISOString(), name:'Pending '+i,
        phone:'94350'+String(20000+i), pin:'0000', city:'Guwahati', area:'Six Mile',
        selfie:null, skills:[{skill:'Plumber',price:350,unit:'per visit'}],
        available:true, status:'pending', verified:false, phone_verified:false,
        wa_claim:code, rating_sum:0, rating_count:0 });
    }
    localStorage.setItem('nearse_workers_v1', JSON.stringify(all));
    return codes;
  });

  p.on('dialog', d => d.accept(d.type()==='prompt' ? '4242' : ''));
  await p.goto('http://localhost:8803/#admin'); await p.waitForTimeout(1500);
  console.log('Admin open:', await p.locator('#scr-admin.on').count() === 1);
  // admin opens on the Dashboard now; the queue and the bulk box live under Review
  await p.locator('.tab', { hasText: 'Review' }).click();
  await p.waitForTimeout(900);
  console.log('Bulk box present:', await p.locator('#bulkCodes').count() === 1);
  console.log('Queue size before:', (await p.locator('#bulkHint').textContent()).trim());

  // a realistic paste: whole WhatsApp messages, 12 of them, plus one bogus code
  const paste = codes.slice(0, 12).map((c,i) =>
    `[7:0${i} pm, 25/07/2026] +91 94350${20001+i}: Repto verification\nName: Pending ${i+1}\nNumber: 94350${20001+i}\nCode: ${c}`
  ).join('\n') + '\nCode: 999999';
  await p.fill('#bulkCodes', paste);
  await p.locator('button', { hasText: 'Approve matching codes' }).click();
  await p.waitForTimeout(2500);

  const st = await p.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('nearse_workers_v1'));
    return { approved: all.filter(w=>w.status==='approved').length,
             pending: all.filter(w=>w.status==='pending').length,
             verifiedFlags: all.filter(w=>w.status==='approved' && w.phone_verified).length };
  });
  console.log('Approved in one action (expect 12):', st.approved);
  console.log('Still pending (expect 18):', st.pending);
  console.log('All approved marked number-verified:', st.verifiedFlags === st.approved);
  console.log('Queue after:', (await p.locator('#bulkHint').textContent()).trim());

  // a paste with no codes must be refused
  await p.fill('#bulkCodes', 'hello there, no codes in this message');
  await p.locator('button', { hasText: 'Approve matching codes' }).click();
  await p.waitForTimeout(700);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('nearse_workers_v1')).filter(w=>w.status==='approved').length);
  console.log('Text with no codes changes nothing:', after === 12);
  console.log('JS errors:', errs.length?errs:'none');
  await b.close(); srv.close();
})();
