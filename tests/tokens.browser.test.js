/* Fluxo de tokens com armazenamento local; nenhuma conexão externa. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=require('node:http').createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);
  page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  const files=new Map([['projetos/index.json',{projetos:[]}]]);
  await page.route('https://api.github.com/**',async route=>{
   const req=route.request(),part=new URL(req.url()).pathname.split('/contents/')[1];
   if(!part)return route.fulfill({json:{full_name:'test/tokens'}});
   const key=decodeURIComponent(part);
   if(req.method()==='PUT'){files.set(key,JSON.parse(Buffer.from(req.postDataJSON().content,'base64').toString()));return route.fulfill({json:{content:{sha:'new'}}});}
   if(!files.has(key))return route.fulfill({status:404,json:{message:'Not found'}});
   return route.fulfill({json:{sha:'mock',content:Buffer.from(JSON.stringify(files.get(key))).toString('base64')}});
  });
  const connect=async()=>{
   await page.locator('#githubForm [name=repository]').fill('test/tokens');
   await page.locator('#githubForm [name=token]').fill('test-only');
   await page.locator('#connectGithub').click();
   await page.waitForFunction(()=>!document.querySelector('#githubDialog').open);
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`,{waitUntil:'domcontentloaded'});
  await connect();
  await page.locator('#newProjectButton').click();
  await page.locator('#projectForm [name=name]').fill('Teste de tokens');
  await page.locator('#projectForm [name=description]').fill('Componentes de imagem');
  await page.locator('#projectForm .primary-button').click();
  await page.locator('#newTokenButton').click();
  assert.equal(await page.locator('#deckForm [name=tokenShape]').inputValue(),'redondo');
  assert(await page.locator('#deckForm [name=textSize]').isDisabled());
  await page.locator('#deckForm [name=name]').fill('Moedas');
  await page.locator('#deckForm [name=quantity]').fill('2');
  await page.locator('#deckForm [name=tokenWidth]').fill('4');
  await page.locator('#deckForm [name=tokenMargin]').check();
  await page.locator('#deckForm [name=tokenMarginColor]').fill('#c28c36');
  for(const width of [360,768,1280]){
   await page.setViewportSize({width,height:900});
   assert(await page.locator('#deckDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2));
  }
  await page.locator('#saveDeck').click();
  await page.waitForFunction(()=>!document.querySelector('#deckDialog').open);
  assert.deepEqual(await page.evaluate(()=>cardDimensions(activeDecks[0])),{width:40,height:40});
  assert.equal(await page.evaluate(()=>activeDecks[0].cartas[0].titulo),undefined);
  await page.locator('.token-deck-card').click();
  await page.locator('#openDeckPage').click();
  await page.locator('[data-card-index="0"]').click();
  assert.equal(await page.locator('#tokenForm input:not([type=file])').count(),0);
  assert.equal(await page.locator('#tokenPreview .token-visual').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(194, 140, 54)');
  assert.equal(await page.locator('#tokenPreview .token-image').evaluate(e=>e.style.inset),'5%');
  // PNG real evita dependência de imagens remotas no PDF.
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='#416e8c';ctx.fillRect(0,0,100,100);return c.toDataURL().split(',')[1];});
  await page.locator('#tokenForm [name=image]').setInputFiles({name:'moeda.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(()=>document.querySelector('#tokenPreview .token-image').style.backgroundImage.includes('data:image'));
  for(const width of [360,768,1280]){
   await page.setViewportSize({width,height:900});
   assert(await page.locator('#tokenDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2));
   assert.equal(await page.locator('#tokenPreview .token-image').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(234, 223, 205)');
  }
  await page.locator('#tokenForm .primary-button').click();
  await page.waitForFunction(()=>!document.querySelector('#tokenDialog').open);
  assert.equal(await page.evaluate(()=>activeDecks[0].cartasProntas),1);
  await page.locator('[data-move-card="0"][data-direction="1"]').click();
  assert(await page.evaluate(()=>Boolean(activeDecks[0].cartas[1].imagem)));
  await page.locator('#backToProject').click();
  assert((await page.locator('.token-deck-card').textContent()).includes('1 de 2 tokens com imagem'));
  for(const shape of ['quadrado','retangular','hexagonal','redondo']){
   await page.locator('.token-deck-card').click();
   await page.locator('#deckForm [name=tokenShape]').selectOption(shape);
   if(shape==='retangular')await page.locator('#deckForm [name=tokenHeight]').fill('6');
   if(shape!=='quadrado')await page.locator('#deckForm [name=tokenMargin]').uncheck();
   await page.locator('#saveDeck').click();
   await page.waitForFunction(()=>!document.querySelector('#deckDialog').open);
   const downloadPromise=page.waitForEvent('download',{timeout:15000});
   await page.locator('#downloadProjectPdf').click();
   const download=await downloadPromise.catch(async error=>{console.error(await page.locator('#toast').textContent());throw error;});
   assert.equal(fs.readFileSync(await download.path()).subarray(0,5).toString(),'%PDF-');
  }
  await page.waitForFunction(()=>pendingGithubFiles.size===0);
  await page.reload({waitUntil:'domcontentloaded'});
  await connect();
  await page.locator('[data-project-path]').filter({hasText:'Teste de tokens'}).click();
  await page.locator('.token-deck-card').click();
  assert.equal(await page.locator('#deckForm [name=tokenWidth]').inputValue(),'4');
  assert.equal(await page.locator('#deckForm [name=tokenMargin]').isChecked(),false);
  await page.locator('#openDeckPage').click();
  await page.locator('[data-card-index="1"]').click();
  assert(await page.locator('#tokenPreview .token-image').evaluate(e=>e.style.backgroundImage.includes('data:image')));
  await page.locator('#tokenDialog [data-close-dialog]').first().click();
  await page.locator('#backToProject').click();
  await page.locator('#newDeckButton').click();
  assert(await page.locator('#deckForm [name=textSize]').isEnabled());
  assert(await page.locator('#tokenSettings').isHidden());
  assert.deepEqual(errors,[]);
  console.log('Tokens: criação, imagem, margem, formatos, dimensões, ordem, persistência, PDF e 360/768/1280 px validados.');
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
