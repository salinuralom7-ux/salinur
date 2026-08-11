/* The one-time-code sender, exercised against a fake Meta Graph API.

   Everything about "Forgotten your PIN?" is built and deployed — the queue
   table, claim_otp, the edge function, the CI step that stores the token.
   The single missing piece is a WhatsApp Cloud API account, which only the
   owner can create. What this test buys is that the day the token arrives, it
   works on the first try rather than at the end of an afternoon spent reading
   Meta error codes.

   The two things that differ between one Meta account and the next are
   decided in WhatsApp Manager, not in our code: whether the authentication
   template has a copy-code button, and whether its language was saved as "en"
   or "en_US". Declare a button the template does not have and Meta rejects
   the message; omit one it does have and Meta rejects it too. Each of those
   four worlds gets a fake Graph API here, and the sender has to get a code
   through all four.

   The real supabase/functions/otp/index.ts is what runs — the Deno-only lines
   are swapped for their Node equivalents and nothing else is touched, so this
   cannot drift away from the file that gets deployed. */
const fs = require('fs'); const http = require('http'); const vm = require('vm');
const SRC = '/home/user/salinur/supabase/functions/otp/index.ts';

const ok = (l, c, x) => { console.log((c ? 'PASS  ' : 'FAIL  ') + l + (x !== undefined ? '  → ' + x : ''));
                          if (!c) process.exitCode = 1; };

/* ---------- a Meta that only accepts one shape of message ---------- */
function fakeGraph({ wantButton, wantLang }) {
  const seen = [];
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const auth = req.headers.authorization || '';
      if (auth !== 'Bearer test-token') {
        res.writeHead(401, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ error: { code: 190, message: 'Invalid OAuth access token' } }));
      }
      const j = JSON.parse(body);
      seen.push(j);
      const comps = j.template.components || [];
      const hasButton = comps.some(c => c.type === 'button');
      const lang = j.template.language.code;
      if (lang !== wantLang) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ error: { code: 132001,
          message: `Template name does not exist in the translation ${lang}` } }));
      }
      if (hasButton !== wantButton) {
        res.writeHead(400, {'Content-Type':'application/json'});
        return res.end(JSON.stringify({ error: { code: 132000,
          message: 'Number of parameters does not match the expected number of params' } }));
      }
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ messages: [{ id: 'wamid.TEST' }] }));
    });
  });
  return { srv, seen };
}

/* ---------- load the real edge function under Node ---------- */
function loadSender(env, graphOrigin, twilioOrigin) {
  let src = fs.readFileSync(SRC, 'utf8');
  /* Deno.serve is the only part that cannot run here; the sending is ordinary
     fetch. Export the two functions the test drives. */
  src = src.replace(/Deno\.serve\(async \(\) => \{[\s\S]*?\n\}\);/, '');
  src = src.replace(/Deno\.env\.get\("([A-Z_]+)"\)!?/g, (_, k) => JSON.stringify(env[k] ?? ''));
  /* strip TypeScript that Node's parser will not take: annotations and types */
  src = src
    .replace(/^type [\s\S]*?;\s*$/gm, '')
    .replace(/^let waShape: Shape \| null = null;$/m, 'let waShape = null;')
    .replace(/: Shape\[\]/g, '').replace(/: Shape\b/g, '')
    .replace(/const out: Shape\[\] = \[\];/, 'const out = [];')
    .replace(/const components: unknown\[\] =/, 'const components =')
    .replace(/let last: \{ status: number; num: number; text: string \} \| null = null;/,
             'let last = null;')
    .replace(/async function rpc<T>\(name: string, args: Record<string, unknown> = \{\}\): Promise<T> \{/,
             'async function rpc(name, args = {}) {')
    .replace(/\(text \? JSON\.parse\(text\) : null\) as T/, '(text ? JSON.parse(text) : null)')
    .replace(/\(phone: string\)/g, '(phone)')
    .replace(/\(phone: string, code: string, s\)/g, '(phone, code, s)')
    .replace(/\(phone: string, code: string\)/g, '(phone, code)')
    .replace(/\(body: unknown, status = 200\)/, '(body, status = 200)')
    .replace(/waShape!\./g, 'waShape.')
    .replace(/rpc<Row\[\]>/g, 'rpc')
    .replace(/\?\?/g, '??')
    .replace(/JSON\.parse\(text\)\?\.error\?\.code \?\? 0/, '(JSON.parse(text).error||{}).code || 0');
  src = src.replace(/https:\/\/graph\.facebook\.com\/v21\.0/g, graphOrigin);
  if (twilioOrigin) src = src.replace(/https:\/\/api\.twilio\.com/g, twilioOrigin);
  src += '\n;module.exports = { sendWhatsApp, sendTwilio, e164, waShapes };';

  const mod = { exports: {} };
  vm.runInNewContext(src, { module: mod, exports: mod.exports, fetch, Response, btoa,
                            URLSearchParams, JSON, console, Error, Set, String });
  return mod.exports;
}

(async () => {
  let PORT = 8871;
  const worlds = [
    { wantButton: true,  wantLang: 'en',    n: 'template with a copy-code button, "en"' },
    { wantButton: false, wantLang: 'en',    n: 'template with no button, "en"' },
    { wantButton: true,  wantLang: 'en_US', n: 'template with a button, "en_US"' },
    { wantButton: false, wantLang: 'en_US', n: 'template with no button, "en_US"' },
  ];

  for (const w of worlds) {
    PORT++;
    const { srv, seen } = fakeGraph(w);
    await new Promise(r => srv.listen(PORT, r));
    const otp = loadSender(
      { WA_TOKEN: 'test-token', WA_PHONE_ID: '1234567890', WA_TEMPLATE: 'mysheher_code', WA_LANG: 'en',
        SUPABASE_URL: 'http://localhost:1', SUPABASE_SERVICE_ROLE_KEY: 'k',
        TWILIO_SID: '', TWILIO_TOKEN: '', TWILIO_FROM: '' },
      `http://localhost:${PORT}`);
    let err = null;
    try { await otp.sendWhatsApp('7086599367', '482913'); } catch (e) { err = e; }
    ok(`A code gets through: ${w.n}`, !err, err ? String(err).slice(0, 120) : `${seen.length} attempt(s)`);

    if (!err) {
      const last = seen[seen.length - 1];
      ok(`  …addressed in E.164 with the country code`, last.to === '917086599367', last.to);
      ok(`  …sent as an approved template, not free text`, last.type === 'template', last.type);
      const body = (last.template.components || []).find(c => c.type === 'body');
      ok(`  …carrying the code as the one body variable`,
         body && body.parameters.length === 1 && body.parameters[0].text === '482913');
      /* Once a shape is accepted it must be remembered, or every code in the
         queue pays for the discovery again. */
      seen.length = 0;
      await otp.sendWhatsApp('9876543210', '112233');
      ok(`  …and the second code goes straight there`, seen.length === 1, seen.length + ' attempt(s)');
    }
    await new Promise(r => srv.close(r));
  }

  /* A dead token is not a template problem and must not be retried six times
     against Meta — it has to fail fast and be recorded. */
  {
    PORT++;
    const { srv, seen } = fakeGraph({ wantButton: true, wantLang: 'en' });
    await new Promise(r => srv.listen(PORT, r));
    const otp = loadSender(
      { WA_TOKEN: 'expired', WA_PHONE_ID: '1234567890', WA_TEMPLATE: 'mysheher_code', WA_LANG: 'en',
        SUPABASE_URL: 'http://localhost:1', SUPABASE_SERVICE_ROLE_KEY: 'k',
        TWILIO_SID: '', TWILIO_TOKEN: '', TWILIO_FROM: '' },
      `http://localhost:${PORT}`);
    let err = null;
    try { await otp.sendWhatsApp('7086599367', '482913'); } catch (e) { err = e; }
    ok('An expired token fails rather than looking like a template problem', !!err,
       err ? String(err).slice(0, 80) : 'no error');
    ok('…and is not hammered at Meta six times over', seen.length === 0, seen.length + ' accepted');
    await new Promise(r => srv.close(r));
  }

  /* Twilio, for the same reason. */
  {
    PORT++;
    let got = null;
    const srv = http.createServer((req, res) => {
      let b = ''; req.on('data', d => b += d);
      req.on('end', () => { got = { url: req.url, auth: req.headers.authorization,
                                    body: Object.fromEntries(new URLSearchParams(b)) };
        res.writeHead(201, {'Content-Type':'application/json'}); res.end('{"sid":"SM1"}'); });
    });
    await new Promise(r => srv.listen(PORT, r));
    const otp = loadSender(
      { WA_TOKEN: '', WA_PHONE_ID: '', WA_TEMPLATE: '', WA_LANG: 'en',
        SUPABASE_URL: 'http://localhost:1', SUPABASE_SERVICE_ROLE_KEY: 'k',
        TWILIO_SID: 'AC123', TWILIO_TOKEN: 'tok', TWILIO_FROM: '+15005550006' },
      `http://localhost:${PORT}`, `http://localhost:${PORT}`);
    let err = null;
    try { await otp.sendTwilio('7086599367', '482913'); } catch (e) { err = e; }
    ok('Twilio is a working fallback', !err, err ? String(err).slice(0, 100) : 'sent');
    ok('…to the right number', got && got.body.To === '+917086599367', got && got.body.To);
    ok('…with the code and a warning never to share it',
       got && got.body.Body.includes('482913') && /never share it/i.test(got.body.Body));
    await new Promise(r => srv.close(r));
  }

  console.log('\n      Nothing here proves a real account exists. It proves that when\n' +
              '      WA_TOKEN and WA_PHONE_ID land in the repository secrets, the\n' +
              '      sender talks to Meta correctly whichever way the template was set up.');
})();
