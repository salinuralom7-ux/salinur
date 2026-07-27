// Both photo paths: R2 via /upload when present, Supabase Storage when not.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs');

let html = fs.readFileSync('/home/user/salinur/docs/index.html','utf8');
html = html.replace(/const SUPABASE_URL\s*=\s*"[^"]+"/, 'const SUPABASE_URL = "http://localhost:8798"');

let r2Enabled = true, r2hits = 0;
const srv = http.createServer((q,r)=>{
  if (q.url === '/upload') {
    if (!r2Enabled) { r.writeHead(404); r.end('no function here'); return; }
    const cs=[]; q.on('data',c=>cs.push(c));
    q.on('end',()=>{ r2hits++;
      r.writeHead(200,{'Content-Type':'application/json'});
      r.end(JSON.stringify({url:'https://img.example/p/abc.jpg'})); });
    return;
  }
  r.writeHead(200,{'Content-Type':'text/html'}); r.end(html);
}).listen(8797);

const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers':'apikey,authorization,content-type,x-upsert' };
const received = [];
const store = http.createServer((q,r)=>{
  if (q.method === 'OPTIONS') { r.writeHead(204, CORS); r.end(); return; }
  if (q.method === 'POST' && q.url.startsWith('/storage/v1/object/selfies/')) {
    const cs=[]; q.on('data',c=>cs.push(c));
    q.on('end',()=>{ const body=Buffer.concat(cs);
      received.push({ bytes:body.length, type:q.headers['content-type'],
        jpegMagic: body[0]===0xFF && body[1]===0xD8, auth: !!q.headers['authorization'] });
      r.writeHead(200,{'Content-Type':'application/json',...CORS}); r.end('{"Key":"ok"}'); });
    return;
  }
  if (q.url.startsWith('/rest/v1/')) { r.writeHead(200,{'Content-Type':'application/json',...CORS}); r.end('[]'); return; }
  r.writeHead(404, CORS); r.end('nf');
}).listen(8798);

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext();
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8797/'); await p.waitForTimeout(1200);

  const mk = async () => p.evaluate(async () => {
    const S=460, cv=document.createElement('canvas'); cv.width=S; cv.height=S;
    const g=cv.getContext('2d');
    const grad=g.createLinearGradient(0,0,S,S); grad.addColorStop(0,'#8899aa'); grad.addColorStop(1,'#332211');
    g.fillStyle=grad; g.fillRect(0,0,S,S);
    for(let i=0;i<400;i++){ g.fillStyle=`hsl(${i%360},50%,50%)`; g.fillRect(Math.random()*S,Math.random()*S,10,10); }
    const dataUrl=cv.toDataURL('image/jpeg',.82);
    const blob=dataUrlToBlob(dataUrl);
    return { dataUrl, dataUrlLen:dataUrl.length, blobSize:blob.size, blobType:blob.type };
  });

  const img = await mk();
  console.log('data URL (base64 text):', (img.dataUrlLen/1024).toFixed(0), 'KB');
  console.log('decoded blob:', (img.blobSize/1024).toFixed(0), 'KB', img.blobType);

  console.log('\n--- R2 endpoint available ---');
  const a = await p.evaluate(d => uploadSelfie(d, '9435012345'), img.dataUrl);
  console.log('used /upload:', r2hits === 1);
  console.log('returned R2 URL:', a);
  console.log('Supabase untouched:', received.length === 0);
  console.log('row cost:', a.length, 'bytes vs', img.dataUrlLen, 'before');

  console.log('\n--- /upload missing (served from anywhere else) ---');
  r2Enabled = false;
  const c = await p.evaluate(d => uploadSelfie(d, '9435012345'), img.dataUrl);
  console.log('fell back to Supabase:', received.length === 1);
  console.log('sent real JPEG bytes, not base64:', received[0] && received[0].jpegMagic
              && Math.abs(received[0].bytes - img.blobSize) < 2);
  console.log('returned Supabase URL:', c.startsWith('http://localhost:8798/storage/v1/object/public/selfies/'));

  console.log('\n--- an already-uploaded URL is not re-uploaded ---');
  const before = r2hits + received.length;
  const d = await p.evaluate(() => uploadSelfie('https://img.example/p/abc.jpg', '9435012345'));
  console.log('passed through unchanged:', d === 'https://img.example/p/abc.jpg',
              '| no new upload:', (r2hits + received.length) === before);
  console.log('\nJS errors:', errs.length?errs:'none');
  await b.close(); srv.close(); store.close();
})();
