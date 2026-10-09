import handler from './api/admin.real.js';
import { makeDb } from './fakedb.js';
import { filterLaunch, launchCsv, viewLaunch } from '../../public/admin-ui.js';
const results=[];
function check(name,ok){results.push(ok);console.log((ok?'PASS ':'FAIL ')+name);}
const admin={id:'owner',is_admin:true};
const ago=n=>new Date(Date.now()-n*86400000).toISOString();
const lead=(i,old=false,removed=false)=>({id:i,email:`person${i}@example.com`,created_at:ago(old?90:1),consent_at:ago(1),consent_version:'launch-v1',source:'launchbox',medium:'email',campaign:'contest',unsubscribed_at:removed?ago(0):null,secret:'must not leave database'});
async function call(db,profile=admin,days=30){
 globalThis.__AUTH__={db,user:{id:'owner'},profile};globalThis.__DB__=db;
 const r={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},send(b){this.body=JSON.parse(b);return this;}};
 await handler({method:'GET',query:{view:'launch',days},headers:{}},r);return r;
}
const db=makeDb(admin,{launch_leads:[lead(1),lead(2,true),lead(3,false,true)]});
let r=await call(db);
check('exact all-time, available and period totals',r.code===200&&r.body.total===3&&r.body.available===2&&r.body.recent===2);
check('old addresses remain in all-time list',r.body.leads.length===3&&!r.body.truncated);
check('only requested columns leave database',r.body.leads.every(x=>!('secret'in x)&&!('id'in x)));
check('personal list response cannot be cached',r.headers['Cache-Control']==='no-store');
check('report does not write records',db.state.writes===0);
r=await call(db,{id:'writer',is_admin:false});check('non-admin cannot read list',r.code===403);
r=await call(makeDb(admin,{launch_leads:[]}));check('empty list reports genuine zero',r.code===200&&r.body.total===0&&r.body.leads.length===0);
r=await call(makeDb(admin,{launch_leads:Array.from({length:1001},(_,i)=>lead(i))}));check('database pages beyond 1000 records',r.body.leads.length===1001&&!r.body.truncated);
r=await call(makeDb(admin,{launch_leads:Array.from({length:20001},(_,i)=>lead(i))}));check('cap is explicit and totals remain exact',r.body.leads.length===20000&&r.body.truncated&&r.body.total===20001);
const broken=makeDb(admin);const from=broken.from;broken.from=name=>name==='launch_leads'?{select(){return this;},order(){return this;},range(){return Promise.resolve({error:{message:'unavailable'}});},is(){return this;},gte(){return this;},then(resolve){resolve({error:{message:'unavailable'}});}}:from(name);
r=await call(broken);check('failed queries do not invent zero',r.code===500&&r.body.error==='view_failed');
const rows=[lead(1),lead(2,false,true),{...lead(3),source:'=SUM(1,2)',campaign:'quote " and comma,',email:' +cmd@example.com'}];
check('default filter excludes removed',filterLaunch(rows).length===2);
check('search matches campaign without case sensitivity',filterLaunch(rows,'CONTEST','all').length===2);
check('removed-only filter is available',filterLaunch(rows,'','removed').length===1);
const csv=launchCsv(rows);
check('CSV excludes removed even when supplied',!csv.includes('person2@'));
check('CSV neutralizes formula-like values',csv.includes("'=SUM")&&csv.includes("' +cmd"));
check('CSV preserves quoted fields',csv.includes('quote "" and comma,'));
const html=viewLaunch({leads:[{...lead(1),source:'<img src=x onerror=alert(1)>'}],total:1,available:1,recent:1,window_days:30},[lead(1)],1);
check('source text is escaped',html.includes('&lt;img')&&!html.includes('<img'));
check('partial list disables export',viewLaunch({leads:rows,truncated:true,total:20001,available:20000,recent:1},rows,3).includes('id="launch-export" disabled'));
console.log(`${results.filter(Boolean).length} of ${results.length} passed`);process.exit(results.every(Boolean)?0:1);
