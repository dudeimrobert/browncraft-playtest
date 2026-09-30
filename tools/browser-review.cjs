// Optional visual QA: npm install --no-save playwright@1.51.1, then install its Chromium.
const {chromium}=require('playwright');
const http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(req.url.split('?')[0]);
  const file=path.join(root,pathname==='/'?'index.html':pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const ext=path.extname(file);
  res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.json':'application/json'})[ext]||'application/octet-stream');
  fs.createReadStream(file).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  const threeRoot=path.resolve(path.dirname(require.resolve('three')),'..');
  await page.route('https://cdn.jsdelivr.net/npm/three@0.184.0/**',route=>route.fulfill({path:path.join(threeRoot,route.request().url().split('three@0.184.0/')[1]),contentType:'text/javascript'}));
  const output=path.join(root,'review');fs.mkdirSync(output,{recursive:true});
  await page.goto(url+'/rig-test.html');
  await page.waitForFunction(()=>window.rigStudy,{timeout:120000});
  for(const pose of ['rest','tpose','heavy']){
    await page.selectOption('#animationSelect',pose);
    if(pose==='heavy')await page.locator('#poseRange').fill('0.39');
    await page.locator('#skeletonToggle').setChecked(pose==='tpose');
    await page.waitForTimeout(500);
    await page.screenshot({path:path.join(output,pose+'.png')});
  }
  await page.goto(url+'/');await page.click('#guestBtn');await page.click('#newCharacterBtn');
  await page.fill('#newCharacterName','Alpha 2.4.8 QA');
  await page.locator('#newCharacterForm').evaluate(f=>f.requestSubmit());await page.click('#enterRealmBtn');
  await page.waitForFunction(()=>document.querySelector('world-3d')?.hearthPortal,{timeout:120000});
  await page.evaluate(()=>{const w=document.querySelector('world-3d');w.playerObj.position.copy(w.hearthPortal.position);w.updateInteract();w.emit();});
  console.log('Pootal debug',await page.evaluate(()=>{const w=document.querySelector('world-3d'),b=document.querySelector('#interactBtn');return {mode:w.state.mode,paused:w.paused,position:w.playerObj.position.toArray(),portal:w.hearthPortal.position.toArray(),interact:w.state.interact,button:{hidden:b.hidden,text:b.textContent,className:b.className}};}));
  await page.screenshot({path:path.join(output,'live-pootal-approach.png')});
  await page.locator('#interactBtn').click();
  await page.waitForSelector('dialog[open]');
  if(await page.locator('.realm-card:not([disabled])').count()!==1)throw Error('Incorrect initial realm locks');
  await page.screenshot({path:path.join(output,'pootal-dialog.png')});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'pootal-mobile.png')});
  const overflow=await page.locator('dialog').evaluate(d=>d.scrollWidth>d.clientWidth);
  if(overflow)throw Error('Mobile dialogue overflows');
  await page.locator('[data-realm="fords"]').click();
  await page.waitForFunction(()=>{const w=document.querySelector('world-3d');return w.state.zone==='fords'&&!w.state.loading;},{timeout:120000});
  const checkpoint=await page.evaluate(()=>{const w=document.querySelector('world-3d');const saved=JSON.parse(localStorage.getItem(w.saveKey));return {zone:saved.zone,keys:saved.pootalKeys};});
  if(checkpoint.zone!=='fords')throw Error('Realm checkpoint not saved');
  await page.evaluate(()=>{const w=document.querySelector('world-3d');w.openPootal();});
  await page.waitForSelector('dialog[open]');
  if(await page.locator('.realm-card:not([disabled])').count()!==1||await page.locator('[data-realm="hearth"]:not([disabled])').count()!==1)throw Error('Weeping Fjarts must permit immediate return to A’jol');
  await page.locator('.pootal-close').click();
  const bough=await page.evaluate(async()=>{
    const w=document.querySelector('world-3d'),boss=w.enemies.find(e=>e.boss);
    boss.introduced=true;boss.engaged=true;boss.ai='boughWind';boss.at=.42;boss.hitDone=false;
    w.state.mode='fight';w.state.bossBattle=true;w.playerObj.position.copy(boss.obj.position).add({x:0,y:0,z:3});
    await new Promise(r=>setTimeout(r,120));
    return {move:boss.bossMove,telegraph:boss.telegraph?.visible,ai:boss.ai};
  });
  if(bough.move!=='boughSweep'||!bough.telegraph||bough.ai!=='boughWind')throw Error('Mournwillow Bough Sweep telegraph did not render');
  if(await page.locator('#bossHud:not([hidden])').count()!==1)throw Error('Boss health HUD did not render');
  if(await page.locator('#spellHud').count()!==1)throw Error('Selected Brown spell HUD did not render');
  await page.screenshot({path:path.join(output,'mournwillow-bough-sweep.png')});
  const sweepDamage=await page.evaluate(async()=>{
    const w=document.querySelector('world-3d'),boss=w.enemies.find(e=>e.boss);
    w.playerObj.position.copy(boss.obj.position).add({x:0,y:0,z:3});boss.obj.rotation.y=0;boss.ai='boughStrike';boss.at=.07;boss.hitDone=false;w.state.hp=100;
    await new Promise(r=>setTimeout(r,110));const afterHit=w.state.hp;
    await new Promise(r=>setTimeout(r,140));const afterWindow=w.state.hp;
    w.disengage('QA cleanup');return {afterHit,afterWindow,telegraph:boss.telegraph.visible};
  });
  if(sweepDamage.afterHit>=100||sweepDamage.afterWindow!==sweepDamage.afterHit||sweepDamage.telegraph)throw Error('Bough Sweep single-hit or cleanup check failed');
  await page.evaluate(()=>{const w=document.querySelector('world-3d');w.state.zone='hearth';w.loadProgress();if(w.state.zone!=='fords')throw Error('Saved realm not restored');});
  await page.waitForTimeout(1000);
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({errors,checkpoint,mobileOverflow:overflow,bough,sweepDamage},null,2));
  await browser.close();server.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exit(1);});
