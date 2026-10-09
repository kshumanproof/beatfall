const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../public');
let mode='success',requests=[],holdResolve;
const results=[];
const check=(name,ok)=>{results.push({name,ok});console.log((ok?'PASS ':'FAIL ')+name);};
const server=http.createServer(async(req,res)=>{
  if(req.url==='/__reference/index.html'||req.url==='/__reference/theme.css'){
    const name=req.url.endsWith('.css')?'theme.css':'index.html';
    res.writeHead(200,{'Content-Type':name.endsWith('.css')?'text/css':'text/html'});
    return res.end(fs.readFileSync(path.join(__dirname,'reference',name)));
  }
  if(req.url.split('?')[0]==='/api/launch-signup') {
    let raw='';for await(const chunk of req)raw+=chunk;
    requests.push({body:JSON.parse(raw),headers:req.headers,method:req.method});
    if(mode==='hold')await new Promise(resolve=>{holdResolve=resolve;});
    const status=mode==='limited'?429:mode==='failure'?503:mode==='unconnected'?404:200;
    res.writeHead(status,{'Content-Type':'application/json'});
    return res.end(mode==='malformed'?'broken':JSON.stringify({ok:status===200}));
  }
  let name;
  try{name=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400);return res.end();}
  if(name==='/')name='/index.html';
  const target=path.resolve(ROOT,'.'+name);
  if(!target.startsWith(ROOT+path.sep)||!fs.existsSync(target)){res.writeHead(404);return res.end();}
  const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon'};
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});fs.createReadStream(target).pipe(res);
});
(async()=>{
  let browser;
  try {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const url='http://127.0.0.1:'+server.address().port;
    const executablePath=process.env.BROWSER_EXECUTABLE||undefined;
    browser=await chromium.launch({executablePath});
    fs.mkdirSync(path.join(__dirname,'screenshots'),{recursive:true});
    for(const [width,height,touch] of [[1366,900,false],[1920,1080,false],[1024,768,false],[700,900,true],[651,900,false],[650,900,true],[390,844,true],[320,740,true],[844,390,true]]) {
      const p=await browser.newPage({viewport:{width,height},hasTouch:touch});const errors=[];
      p.on('pageerror',e=>errors.push(e.message));
      await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
      await p.goto(url);
      await p.evaluate(()=>document.fonts.ready);
      const reference=await browser.newPage({viewport:{width,height}});
      await reference.goto(url+'/__reference/index.html');
      await reference.evaluate(()=>document.fonts.ready);
      const typography=(selectors)=>selectors.map(selector=>{const s=getComputedStyle(document.querySelector(selector));return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing,s.fontOpticalSizing];});
      const actual=await p.evaluate(typography,['h1','.description','.founder blockquote']);
      const expected=await reference.evaluate(typography,['h1','.hero-copy>p:not(.eyebrow)','.founder blockquote']);
      check(width+'px typography matches the deployed homepage exactly',JSON.stringify(actual)===JSON.stringify(expected));
      await reference.close();
      check(width+'px uses loaded brand fonts, bold headline and serif description',await p.evaluate(()=>document.fonts.check('700 64px Newsreader')&&document.fonts.check('400 22px Newsreader')&&document.fonts.check('600 14px "Instrument Sans"')&&getComputedStyle(document.querySelector('h1')).fontWeight==='700'&&getComputedStyle(document.querySelector('.description')).fontFamily.includes('Newsreader')));
      await p.locator('#email').waitFor();
      const layout=await p.evaluate(()=>({
        overflow:document.documentElement.scrollWidth>innerWidth,
        images:[...document.querySelectorAll('.screenshots img')].map(i=>({loaded:i.complete&&i.naturalWidth>0,alt:i.alt})),
        figures:[...document.querySelectorAll('figure')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width};}),
        scripts:[...document.scripts].map(s=>s.src),gate:!!document.querySelector('#bf-gate'),
        links:[...document.querySelectorAll('a')].map(a=>a.getAttribute('href'))
      }));
      check(width+'px has no page overflow',!layout.overflow);
      check(width+'px loads both real screenshots with descriptions',layout.images.length===2&&layout.images.every(i=>i.loaded&&i.alt.length>20));
      check(width+'px screenshots use intended layout',width>650?layout.figures[0].y===layout.figures[1].y:layout.figures[0].y<layout.figures[1].y);
      check(width+'px has no app gate, app script or beta links',!layout.gate&&layout.scripts.every(s=>s.endsWith('/launch.js'))&&!layout.links.some(s=>/login|billing|beta|app\.html/.test(s)));
      check(width+'px page has no script errors',errors.length===0);
      check(width+'px founder quote follows screenshots and precedes footer',await p.evaluate(()=>{const quote=document.querySelector('.founder'),shots=document.querySelector('.screenshots'),footer=document.querySelector('footer');return quote.textContent.includes('I didn’t want software to write my screenplay.')&&quote.getBoundingClientRect().top>=shots.getBoundingClientRect().bottom&&quote.getBoundingClientRect().bottom<=footer.getBoundingClientRect().top;}));
      if([1366,390].includes(width))await p.screenshot({path:path.join(__dirname,'screenshots',width+'.png'),fullPage:true});
      await p.close();
    }
    const p=await browser.newPage();
    await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
    await p.context().addCookies([{name:'beatfall-session',value:'test-only',url}]);
    await p.goto(url+'/?utm_source=story-launchbox&utm_medium=email&utm_campaign=launch-list');
    await p.locator('#email').fill('Writer@Example.com');
    await p.getByRole('button',{name:'Notify me at launch'}).click();
    await p.getByRole('status').filter({hasText:'You’re on the list'}).waitFor();
    check('success appears only after an accepted save',requests.length===1&&requests[0].method==='POST');
    check('source labels and consent reach the expected capture endpoint',requests[0].body.email==='writer@example.com'&&requests[0].body.source==='story-launchbox'&&requests[0].body.medium==='email'&&requests[0].body.campaign==='launch-list'&&requests[0].body.consent===true&&requests[0].body.consent_version==='launch-2026-10-09');
    check('signup does not transmit existing app cookies',!requests[0].headers.cookie);
    check('successful signup clears email and re-enables the button',await p.locator('#email').inputValue()===''&&await p.getByRole('button',{name:'Notify me at launch'}).isEnabled());
    for(const next of ['failure','unconnected','malformed','limited']) {
      mode=next;await p.locator('#email').fill('retry@example.com');
      await p.getByRole('button',{name:'Notify me at launch'}).click();
      await p.locator('#signup-status[data-state="error"]').waitFor();
      check(next+' cannot claim a successful save',!(await p.getByRole('status').innerText()).includes('You’re on the list'));
      check(next+' preserves the email for retry',await p.locator('#email').inputValue()==='retry@example.com');
    }
    mode='hold';await p.locator('#email').fill('once@example.com');const count=requests.length;
    await p.getByRole('button',{name:'Notify me at launch'}).click();
    await p.getByRole('button',{name:'Saving…'}).waitFor();
    check('pending save prevents repeated submissions',await p.getByRole('button',{name:'Saving…'}).isDisabled());
    await p.evaluate(()=>document.querySelector('form').requestSubmit());
    check('repeated form submission cannot add a second pending request',requests.length===count+1);
    mode='success';holdResolve();
    await p.locator('#signup-status[data-state="success"]').waitFor();
    const beforeInvalid=requests.length;
    await p.locator('#email').fill('not-an-email');await p.getByRole('button',{name:'Notify me at launch'}).click();
    check('invalid email is rejected before any request',requests.length===beforeInvalid);
    await p.goto(url);await p.locator('#email').fill('offline@example.com');
    await p.route('**/api/launch-signup',r=>r.abort());
    await p.getByRole('button',{name:'Notify me at launch'}).click();await p.locator('#signup-status[data-state="error"]').waitFor();
    check('network failure keeps email and restores usable form',await p.locator('#email').inputValue()==='offline@example.com'&&await p.getByRole('button',{name:'Notify me at launch'}).isEnabled());
    await p.unroute('**/api/launch-signup');
    await p.goto(url);await p.locator('#email').focus();await p.keyboard.press('Tab');
    check('keyboard tab reaches submit instead of honeypot',await p.getByRole('button',{name:'Notify me at launch'}).evaluate(e=>e===document.activeElement));
    check('email field has a visible associated label',await p.getByLabel('Email address',{exact:true}).count()===1);
    check('privacy link stays in this isolated site',await p.getByRole('link',{name:'Privacy',exact:true}).first().getAttribute('href')==='/privacy.html');
    await p.getByRole('link',{name:'Privacy',exact:true}).first().click();
    check('privacy notice loads and distinguishes list from accounts',(await p.locator('main').innerText()).includes('does not create a Beatfall account'));
    await p.close();
    const nojs=await browser.newPage({javaScriptEnabled:false});
    await nojs.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
    await nojs.goto(url);
    check('without JavaScript the visitor gets an honest email fallback',await nojs.locator('.no-script').isVisible()&&!await nojs.locator('#launch-form').isVisible());
    await nojs.close();
    const source=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
    check('no Chatling embed, app manifest, desktop login or AI marketing text',!(/chatling|chtl|app\.js|site\.webmanifest|login\.html|\bAI\b/.test(source)));
    check('canonical and social preview target only the real public domain',source.includes('https://beatfall.app/')&&source.includes('https://beatfall.app/brand/og.png')&&!source.includes('vercel.app'));
    const failed=results.filter(r=>!r.ok);console.log('\n'+(results.length-failed.length)+' of '+results.length+' landing checks passed');
    if(failed.length)process.exitCode=1;
  }catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();server.close();}
})();
