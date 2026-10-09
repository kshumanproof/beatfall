const { PGlite } = require('@electric-sql/pglite');
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const handler = require('../api/launch-signup.js');
let checks = 0, db, browser, server;
const check = (name, truth) => { assert.ok(truth, name); checks++; console.log('PASS ' + name); };
const sql = fs.readFileSync(path.join(__dirname, '../supabase/launch-list.sql'), 'utf8');
const realFetch = global.fetch;
const originalEnv = { ...process.env };
let upstream = 'normal', savedPayload, calls = 0;
const baseBody = { email:'Writer@Example.com', consent:true, consent_version:'launch-2026-10-09', source:'story-launchbox', medium:'email', campaign:'launch', website:'' };
async function call(body = baseBody, options = {}) {
  const req = {method:'POST', headers:{origin:'https://beatfall.app','content-type':'application/json','x-vercel-forwarded-for':'203.0.113.8'}, body, ...options};
  const res = { headers:{}, code:0, setHeader(k,v){this.headers[k]=v;}, status(n){this.code=n;return this;}, json(b){this.body=b;return this;} };
  await handler(req,res); return res;
}
const count = async () => (await db.query('select count(*)::int as n from launch_leads')).rows[0].n;
const clearLimits = () => db.exec('delete from launch_signup_limits');
async function refused(role, statement) {
  await db.exec('set role '+role);
  try {await db.exec(statement);return false;} catch {return true;} finally {await db.exec('reset role');}
}
(async()=>{
 try {
  db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec('create table existing_app_sentinel (id integer primary key, value text); insert into existing_app_sentinel values (1,\'unchanged\');');
  await db.exec(sql); await db.exec(sql);
  check('migration executes twice without affecting existing app data',(await db.query('select value from existing_app_sentinel')).rows[0].value==='unchanged');
  for(const role of ['anon','authenticated']) {
    check(role+' cannot read the launch list',await refused(role,'select * from launch_leads'));
    check(role+' cannot add addresses directly',await refused(role,"insert into launch_leads(email,consent_version) values ('forbidden@example.com','test')"));
    check(role+' cannot read abuse records',await refused(role,'select * from launch_signup_limits'));
    check(role+' cannot call the private signup function',await refused(role,"select register_launch_lead('x@example.com','launch-2026-10-09','','','','"+'a'.repeat(64)+"')"));
  }
  process.env.SUPABASE_URL='https://test-only.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key-not-real';process.env.VERCEL='1';
  global.fetch = async(url,options)=>{
    calls++; savedPayload=JSON.parse(options.body);
    check('database request reaches only the intended private function',String(url)==='https://test-only.supabase.co/rest/v1/rpc/register_launch_lead');
    if(upstream==='throw')throw Error('simulated network failure');
    if(upstream==='failed')return {ok:false};
    if(upstream==='malformed')return {ok:true,json:async()=>({})};
    const p=savedPayload;
    await db.exec('set role service_role');
    let result;
    try {result=(await db.query('select register_launch_lead($1,$2,$3,$4,$5,$6) as result',[p.p_email,p.p_consent_version,p.p_source,p.p_medium,p.p_campaign,p.p_ip_hash])).rows[0].result;} finally {await db.exec('reset role');}
    return {ok:true,json:async()=>result};
  };
  let res=await call();
  check('successful API reply follows an actual committed insert',res.code===200&&res.body.ok&&await count()===1);
  const lead=(await db.query('select * from launch_leads')).rows[0];
  check('email is normalized and permission is dated',lead.email==='writer@example.com'&&lead.consent_at&&lead.consent_version===baseBody.consent_version);
  check('marketing labels are preserved',lead.source==='story-launchbox'&&lead.medium==='email'&&lead.campaign==='launch');
  check('raw IP is not stored or forwarded',/^[a-f0-9]{64}$/.test(savedPayload.p_ip_hash)&&!JSON.stringify(savedPayload).includes('203.0.113.8'));
  check('success does not reveal whether address already existed',JSON.stringify(res.body)==='{"ok":true}'&&res.headers['Cache-Control']==='no-store');
  res=await call({...baseBody,source:'different'});
  check('repeated address creates no duplicate',res.code===200&&await count()===1);
  check('repeated address preserves original attribution',(await db.query('select source from launch_leads')).rows[0].source==='story-launchbox');
  check('repeat signup does not rewrite permission date',String((await db.query('select consent_at from launch_leads')).rows[0].consent_at)===String(lead.consent_at));
  await db.exec("update launch_leads set unsubscribed_at=now(),consent_at=now()-interval '1 day'");
  res=await call();
  check('explicit rejoin renews permission without a duplicate',res.code===200&&await count()===1&&(await db.query('select unsubscribed_at from launch_leads')).rows[0].unsubscribed_at===null);
  for(const email of ['', 'bad', 'x@@example.com','a..b@example.com','x@example','x\n@example.com','a'.repeat(65)+'@example.com']) {
    const before=calls;res=await call({...baseBody,email});check('invalid email is rejected before database access: '+JSON.stringify(email),res.code===400&&calls===before);
  }
  for(const consent of [false,'true',null]){res=await call({...baseBody,consent});check('permission must be an explicit boolean: '+String(consent),res.code===400);}
  check('outdated permission wording is refused',(await call({...baseBody,consent_version:'old'})).code===400);
  check('GET cannot write',(await call(baseBody,{method:'GET'})).code===405);
  check('foreign origin cannot write',(await call(baseBody,{headers:{origin:'https://other.example','content-type':'application/json'}})).code===403);
  check('missing origin cannot write',(await call(baseBody,{headers:{'content-type':'application/json'}})).code===403);
  check('HTML form posts cannot write',(await call(baseBody,{headers:{origin:'https://beatfall.app','content-type':'text/plain'}})).code===415);
  check('oversized body is refused',(await call({...baseBody,extra:'x'.repeat(5000)})).code===413);
  check('broken JSON is refused',(await call('{broken')).code===400);
  check('JSON arrays are refused',(await call([])).code===400);
  const beforeBot=calls;res=await call({...baseBody,website:'bot.example'});
  check('honeypot discards bots without a database write',res.code===200&&calls===beforeBot);
  check('untrusted forwarded IP cannot bypass Vercel header requirement',(await call(baseBody,{headers:{origin:'https://beatfall.app','content-type':'application/json','x-forwarded-for':'203.0.113.9'}})).code===503);
  for(const fail of ['failed','throw','malformed']){upstream=fail;res=await call();check(fail+' save never claims success',res.code===503&&!res.body.ok);}upstream='normal';
  await clearLimits();
  res=await call({...baseBody,email:'bounded@example.com',source:'x'.repeat(120)+'\n',medium:'\u0000email'});
  check('server bounds and cleans campaign labels',res.code===200&&savedPayload.p_source.length===80&&savedPayload.p_medium==='email');
  await clearLimits();
  const replies=[];for(let i=0;i<11;i++)replies.push(await call({...baseBody,email:'limit'+i+'@example.com'}));
  check('database permits first ten submissions in a bucket',replies.slice(0,10).every(r=>r.code===200));
  check('eleventh is refused with a retry instruction',replies[10].code===429&&replies[10].headers['Retry-After']==='600');
  check('limited email is not inserted',(await db.query("select count(*)::int n from launch_leads where email='limit10@example.com'")).rows[0].n===0);
  await clearLimits();
  await db.query("insert into launch_signup_limits values ($1,date_trunc('hour',now())-interval '1 hour',100)",[savedPayload.p_ip_hash]);
  check('daily allowance also applies across buckets',(await call({...baseBody,email:'daily@example.com'})).code===429);
  await db.query("insert into launch_signup_limits values ($1,now()-interval '3 days',1)",['b'.repeat(64)]);
  await call();
  check('expired abuse records are removed',(await db.query("select count(*)::int n from launch_signup_limits where ip_hash=$1",['b'.repeat(64)])).rows[0].n===0);
  await clearLimits();
  const concurrent=await Promise.all(Array.from({length:15},()=>db.query('select register_launch_lead($1,$2,$3,$4,$5,$6) as result',['parallel@example.com','launch-2026-10-09','source','','','c'.repeat(64)])));
  check('concurrent submissions cannot exceed the rate allowance',concurrent.filter(r=>r.rows[0].result.status==='saved').length===10&&concurrent.filter(r=>r.rows[0].result.status==='limited').length===5);
  check('concurrent duplicate addresses still produce one lead',(await db.query("select count(*)::int n from launch_leads where email='parallel@example.com'")).rows[0].n===1);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  check('missing database credentials fail safely',(await call()).code===503);
  process.env.SUPABASE_SERVICE_ROLE_KEY='test-key-not-real';
  await clearLimits();delete process.env.VERCEL;
  server=http.createServer((req,res)=>{
    if(req.url.split('?')[0]==='/api/launch-signup'){
      res.status=n=>{res.statusCode=n;return res;};res.json=b=>res.end(JSON.stringify(b));return handler(req,res);
    }
    const name=req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1);
    const root=path.resolve(__dirname,'../public'),file=path.resolve(root,name);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  process.env.LAUNCH_SITE_URL='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined});const page=await browser.newPage();
  await page.goto(process.env.LAUNCH_SITE_URL+'/?utm_source=story-launchbox&utm_medium=email');
  await page.getByLabel('Email address',{exact:true}).fill('browser@example.com');await page.getByRole('button',{name:'Notify me at launch'}).click();
  await page.locator('#signup-status[data-state="success"]').waitFor();
  check('real form, real handler and SQL save work together',(await db.query("select source from launch_leads where email='browser@example.com'")).rows[0].source==='story-launchbox');
  upstream='failed';await page.getByLabel('Email address',{exact:true}).fill('failed-browser@example.com');await page.getByRole('button',{name:'Notify me at launch'}).click();
  await page.locator('#signup-status[data-state="error"]').waitFor();
  check('real failed database save preserves browser input',await page.getByLabel('Email address',{exact:true}).inputValue()==='failed-browser@example.com');
  check('failed browser signup leaves no false database record',(await db.query("select count(*)::int n from launch_leads where email='failed-browser@example.com'")).rows[0].n===0);
  check('existing app data still untouched at end',(await db.query('select value from existing_app_sentinel')).rows[0].value==='unchanged');
  console.log('\n'+checks+' signup and database checks passed. No live database contacted.');
 } catch(error){console.error(error);process.exitCode=1;}
 finally {global.fetch=realFetch;process.env=originalEnv;if(browser)await browser.close();if(server)server.close();if(db)await db.close();}
})();
