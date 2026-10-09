import assert from 'node:assert/strict';
import { openAICost, syncOpenAICosts, billingComparison } from './api/_lib/openai-billing.js';
import { callProvider } from './api/_lib/providers.js';
import handler from './api/claude.real.js';
import adminHandler from './api/admin.real.js';
import cleanupHandler from './api/cleanup.real.js';
import { makeDb } from './fakedb.js';
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log('PASS ' + name); };
const usage = (input, output, cached, written) => ({ input_tokens: input, output_tokens: output,
  input_tokens_details: { cached_tokens: cached, cache_write_tokens: written },
  output_tokens_details: { reasoning_tokens: 100 } });
// Actual exported daily totals. Daily rounding differs from per-call rounding
// by at most half a microdollar per request, so assert at that precision.
for (const [day,i,o,c,w,dollars] of [
  ['October 7',63258,29712,31118,25017,0.3770203],
  ['October 8',392601,258298,155039,211451,3.1793334],
  ['October 9',5541,2198,0,5529,0.0358265]]) {
  // October 8 is an aggregate, not a single long-context request.
  if (i > 272000) {
    // Use direct small real-component calls to keep integer token counts.
    const total = openAICost(usage(c,0,c,0)).costMicros
      + openAICost(usage(w,0,0,w)).costMicros
      + openAICost(usage(i-c-w,o,0,0)).costMicros;
    check(day + ' export matches to microdollars', () => assert.ok(Math.abs(total/1e6-dollars) <= 1e-6));
  } else check(day + ' export matches to microdollars', () =>
    assert.ok(Math.abs(openAICost(usage(i,o,c,w)).costMicros/1e6-dollars) <= 0.50001e-6));
}
check('reasoning is not added to output twice', () => assert.equal(openAICost(usage(100,200,0,0)).costMicros,2200));
check('ordinary input excludes both cache categories', () => assert.equal(openAICost(usage(1000,100,300,500)).costMicros,2680));
check('long context uses both documented multipliers', () => assert.equal(openAICost(usage(300000,100,0,0)).costMicros,1201500));
check('zero usage is a valid zero cost', () => assert.equal(openAICost(usage(0,0,0,0)).costMicros,0));
for (const u of [{input_tokens:100,output_tokens:10},usage(100,10,80,80),usage(100,10,-1,0),
  {...usage(100,10,0,0), input_tokens_details:{cached_tokens:0,cache_write_tokens:0,cache_write_12h_tokens:1}}])
  check('incomplete or invalid details are labelled estimates', () => assert.equal(openAICost(u).costDetails.basis,'list_price_fallback'));
check('unknown processing tier is labelled an estimate', () => assert.equal(openAICost(usage(100,10,0,0),'priority').costDetails.basis,'list_price_fallback'));
check('malformed usage never produces a negative or nonfinite cost',()=>{
  assert.equal(openAICost(usage(-1,NaN,0,0)).costMicros,0);
  assert.equal(openAICost(usage(-1,NaN,0,0)).costDetails.basis,'list_price_fallback');
});
const savedFetch = globalThis.fetch;
process.env.OPENAI_API_KEY = 'test-only';
delete process.env.BEATFALL_TESTING;
let sentBody;
globalThis.fetch = async (url,opt) => { sentBody = JSON.parse(opt.body); return {ok:true,json:async()=>({
  status:'completed',output_text:'{"ok":true}',usage:usage(1000,100,300,500),service_tier:'default'})}; };
const answer = await callProvider('openai',{messages:[{role:'user',content:'notes'}],maxTokens:400});
check('real provider adapter applies cache prices', () => assert.equal(answer.costMicros,2680));
check('provider request still has original messages and privacy setting', () => {
  assert.deepEqual(sentBody.input,[{role:'user',content:'notes'}]); assert.equal(sentBody.store,false);
  assert.equal(sentBody.max_output_tokens,400);
});
const profile = {id:'u1',plan:'beatfall',subscription_status:'active',credits_used:0,credits_extra:0,
  period_start:'2026-10-01T00:00:00Z'};
let db = makeDb(profile);
globalThis.__AUTH__ = {db,user:{id:'u1',email:'test@example.com'},profile:db.state.profile};
const response = () => {const r={code:0,body:null,setHeader(){},status(c){r.code=c;return r;},send(b){r.body=JSON.parse(b);return r;}};return r;};
let res=response();
await handler({method:'POST',headers:{},body:{kind:'conversation',input:'what goes here'}},res);
check('real paid endpoint persists detailed cost', () => {
  assert.equal(res.code,200); assert.equal(db.state.usage[0].cost_micros,2680);
  assert.equal(db.state.usage[0].cost_details.basis,'usage_breakdown');
  assert.equal(db.state.usage[0].cost_details.cache_write_tokens,500);
});
check('customer still pays the same two credits', () => assert.equal(db.state.profile.credits_used,2));
delete process.env.OPENAI_ADMIN_KEY; delete process.env.OPENAI_PROJECT_ID;
let fetched=0;
globalThis.fetch=async()=>{fetched++;throw Error('must not call');};
check('unconfigured sync makes no external call', () => {});
assert.equal((await syncOpenAICosts(db)).state,'not_configured'); assert.equal(fetched,0);
process.env.OPENAI_ADMIN_KEY='reporting-test-only';process.env.OPENAI_PROJECT_ID='proj_test';
const now=Date.parse('2026-10-10T04:00:00Z'), day=Date.parse('2026-10-09T00:00:00Z')/1000;
const bucket=(start=day,amount=.0358265)=>({object:'bucket',start_time:start,end_time:start+86400,
  results:[{object:'organization.costs.result',project_id:'proj_test',amount:{currency:'usd',value:amount}}]});
const report=(data,more=false,next=null)=>({ok:true,json:async()=>({data,has_more:more,next_page:next})});
let urls=[];
globalThis.fetch=async(url,opt)=>{urls.push(new URL(url)); assert.equal(opt.headers.authorization,'Bearer reporting-test-only');return report([bucket()]);};
db=makeDb(profile,{usage:[{id:1,provider:'openai',model:'gpt-6.1-sol',created_at:'2026-10-09T01:00:00.000Z',cost_micros:35827,cost_details:{basis:'usage_breakdown'},status:'ok'}]});
const originalUsage=JSON.stringify(db.state.usage);
let result=await syncOpenAICosts(db,now);
check('sync stores official fractional-microdollar precision',()=>{assert.equal(result.ok,true);assert.equal(db.state.provider_daily_costs[0].amount_usd,.0358265);});
check('sync is scoped to one project and complete UTC days',()=>{
  assert.equal(urls[0].searchParams.get('project_ids'),'proj_test');
  assert.equal(urls[0].searchParams.get('end_time'),String(Date.parse('2026-10-10T00:00:00Z')/1000));
  assert.equal(urls[0].searchParams.get('group_by'),'project_id');
});
globalThis.fetch=async()=>report([bucket(day,.04)]);
await syncOpenAICosts(db,now);
check('rerun updates report instead of duplicating',()=>{assert.equal(db.state.provider_daily_costs.length,1);assert.equal(db.state.provider_daily_costs[0].amount_usd,.04);});
check('sync never rewrites customer usage or credits',()=>{assert.equal(JSON.stringify(db.state.usage),originalUsage);assert.equal(db.state.profile.credits_used,0);});
let comparison=await billingComparison(db,'2026-10-08T03:00:00.000Z',now);
check('comparison matches the same complete UTC day',()=>{assert.equal(comparison.state,'ready');assert.equal(comparison.days[0].calculated_usd,.035827);assert.equal(comparison.days[0].reported_usd,.04);});
check('comparison keeps rounding difference visible',()=>assert.ok(Math.abs(comparison.days[0].difference_usd-.004173)<1e-12));
// New status columns must never add personal content to billing results.
check('comparison sends no notes or identity',()=>{assert.ok(!JSON.stringify(comparison).includes('test@example.com'));assert.ok(!JSON.stringify(comparison).includes('user_id'));});
const stored=JSON.stringify(db.state.provider_daily_costs);
globalThis.fetch=async()=>({ok:false,status:401,text:async()=> 'secret provider body'});
result=await syncOpenAICosts(db,now);
check('failed pull preserves earlier daily amounts',()=>assert.equal(JSON.stringify(db.state.provider_daily_costs),stored));
check('failed pull reports safe reason without upstream body',()=>{assert.equal(result.reason,'http_401');assert.ok(!JSON.stringify(db.state.operator_meta).includes('secret'));});
check('failed latest update remains visible alongside older reports',()=>{});
assert.equal((await billingComparison(db,'2026-10-08T00:00:00.000Z',now)).state,'failed');
for (const bad of [ {...bucket(),results:[{object:'organization.costs.result',project_id:'other',amount:{currency:'usd',value:1}}]},
  {...bucket(),end_time:day+3600}, {...bucket(),results:[{object:'organization.costs.result',project_id:'proj_test',amount:{currency:'eur',value:1}}]}]) {
  globalThis.fetch=async()=>report([bad]);result=await syncOpenAICosts(db,now);
  check('invalid scope/currency/day refuses overwrite',()=>{assert.equal(result.ok,false);assert.equal(JSON.stringify(db.state.provider_daily_costs),stored);});
}
globalThis.fetch=async()=>report([],true,'same');
result=await syncOpenAICosts(db,now);
check('repeating pagination cursor cannot loop',()=>assert.equal(result.reason,'invalid_cursor'));
let calls=0;
globalThis.fetch=async()=>++calls===1?report([bucket(day-86400)],true,'next'):report([bucket()]);
result=await syncOpenAICosts(db,now);
check('multiple billing pages are saved together',()=>{assert.equal(result.ok,true);assert.equal(result.days,2);});
// More than the database default page; include internal costs and exclude Claude.
db=makeDb(profile,{provider_daily_costs:[{project_id:'proj_test',day:'2026-10-09',amount_usd:1.2,fetched_at:new Date(now).toISOString()}],
  usage:Array.from({length:1001},(_,id)=>({id,provider:'openai',created_at:'2026-10-09T01:00:00.000Z',cost_micros:1000,status:'ok',cost_details:{basis:'usage_breakdown'}}))});
db.state.usage.push({id:2000,provider:'claude',cost_micros:999999,created_at:'2026-10-09T01:00:00.000Z'});
comparison=await billingComparison(db,'2026-10-08T03:00:00.000Z',now);
check('comparison pages beyond 1000 calls and excludes Claude',()=>{assert.equal(comparison.days[0].calls,1001);assert.equal(comparison.days[0].calculated_usd,1.001);});
db.state.usage.push({id:2001,provider:null,model:'gpt-6.1-sol',cost_micros:1000,status:'unknown',created_at:'2026-10-09T23:59:59.999Z'});
db.state.usage.push({id:2002,provider:'openai',cost_micros:999999,created_at:'2026-10-10T00:00:00.000Z'});
db.state.provider_daily_costs.push({project_id:'other',day:'2026-10-09',amount_usd:999});
comparison=await billingComparison(db,'2026-10-08T03:00:00.000Z',now);
check('legacy OpenAI rows are counted and labelled while today is excluded',()=>{
  assert.equal(comparison.days[0].calls,1002);assert.equal(comparison.days[0].legacy_calls,1);
  assert.equal(comparison.days[0].unknown_calls,1);assert.equal(comparison.days[0].calculated_usd,1.002);
});
check('another project never enters the comparison',()=>{assert.equal(comparison.days.length,1);assert.equal(comparison.days[0].reported_usd,1.2);});
db.state.provider_daily_costs[0].day='2026-10-08';
comparison=await billingComparison(db,'2026-10-07T03:00:00.000Z',now);
check('a recently fetched report missing yesterday is still marked overdue',()=>assert.equal(comparison.state,'stale'));
db.state.provider_daily_costs[0].day='2026-10-09';
const failDb={from(name){if(name!=='usage')return db.from(name);const chain=new Proxy({}, {get(t,k){if(k==='then')return resolve=>resolve({data:null,error:{message:'offline'}});return()=>chain;}});return chain;}};
check('failed usage query returns unavailable instead of false zero',()=>{});
assert.equal((await billingComparison(failDb,'2026-10-08T03:00:00.000Z',now)).state,'unavailable');
globalThis.__AUTH__={db,user:{id:'u1'},profile:{...profile,is_admin:true}};
res=response();await adminHandler({method:'GET',query:{view:'money',days:30},headers:{}},res);
check('admin Money endpoint includes comparison without a new route',()=>{assert.equal(res.code,200);assert.ok(res.body.billing);});
// A dry run, an unauthenticated request, and a live cron are three different
// things. Drive the real nightly endpoint to check where reporting can run.
process.env.CRON_SECRET='cron-test-only';
globalThis.__DB__=makeDb(profile,{profiles:[]});
let cronFetch=0;
globalThis.fetch=async()=>{cronFetch++;return report([bucket()]);};
res=response();await cleanupHandler({method:'GET',headers:{},query:{}},res);
check('untrusted cleanup request cannot fetch billing',()=>{assert.equal(res.code,401);assert.equal(cronFetch,0);});
res=response();await cleanupHandler({method:'GET',headers:{'x-cron-secret':'cron-test-only'},query:{key:'cron-test-only',dry:'1'}},res);
check('dry run cannot fetch or store billing',()=>{assert.equal(res.code,200);assert.equal(cronFetch,0);assert.equal(res.body.billing.state,'dry_run');});
// Bucket date must follow the real current day used by cleanup.
globalThis.fetch=async()=>{cronFetch++;return report([bucket(Math.floor(Date.now()/86400000)*86400-86400)]);};
res=response();await cleanupHandler({method:'GET',headers:{'x-cron-secret':'cron-test-only'},query:{key:'cron-test-only'}},res);
check('authenticated nightly job fetches reports',()=>{assert.equal(res.code,200);assert.equal(cronFetch,1);assert.equal(res.body.billing.ok,true);});
globalThis.fetch=async()=>{throw new Error('network offline');};
res=response();await cleanupHandler({method:'GET',headers:{'x-cron-secret':'cron-test-only'},query:{key:'cron-test-only'}},res);
check('reporting failure does not stop existing cleanup',()=>{assert.equal(res.code,200);assert.equal(res.body.ok,true);assert.equal(res.body.billing.state,'failed');});
globalThis.fetch=savedFetch;
delete process.env.OPENAI_ADMIN_KEY;delete process.env.OPENAI_PROJECT_ID;
console.log(checks+' billing checks passed');
