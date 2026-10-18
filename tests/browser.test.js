/* Teste de integração com API GitHub simulada; nenhum PAT real ou push. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
(async()=>{
 const server=require('node:http').createServer((req,res)=>{const file=path.resolve(__dirname,'..',new URL(req.url,'http://localhost').pathname.replace(/^\/card-builder\/?/,'')||'index.html');if(!file.startsWith(path.resolve(__dirname,'..')+path.sep)){res.writeHead(403);res.end();return;}try{const data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=path.resolve(process.argv[2]||'../save-the-prince-bgrpg');
 const files=new Map([['projetos/index.json',{projetos:['local-1790897190889']}],['projetos/local-1790897190889/diario/paginas.json',JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/diary-pages.json')))]]);
 const p='projetos/local-1790897190889/';const project=JSON.parse(fs.readFileSync(path.join(root,p,'projeto.json')));files.set(p+'projeto.json',project);
 for(const f of project.baralhos)files.set(p+'baralhos/'+f,JSON.parse(fs.readFileSync(path.join(root,p,'baralhos',f))));
 await page.route('https://api.github.com/**',async route=>{
  const req=route.request(),u=new URL(req.url()),part=u.pathname.split('/contents/')[1];
  if(!part)return route.fulfill({json:{full_name:'uneluneravie/save-the-prince-bgrpg'}});
  const key=decodeURIComponent(part);
  if(req.method()==='PUT'){files.set(key,JSON.parse(Buffer.from(req.postDataJSON().content,'base64').toString()));return route.fulfill({json:{content:{sha:'new'}}});}
  if(!files.has(key))return route.fulfill({status:404,json:{message:'Not found'}});
  return route.fulfill({json:{sha:'mock',content:Buffer.from(JSON.stringify(files.get(key))).toString('base64')}});
 });
 // Recursos sem versão representam entradas antigas que podem existir no cache.
 const staleAssets=[];
 await page.route(/\/(app|diary-preview|card-model|card-editor|structured-ui)\.js$/, route=>{staleAssets.push(route.request().url());return route.fulfill({contentType:'application/javascript',body:'throw new Error("JavaScript antigo carregado")'});});
 await page.goto(origin+'/card-builder/');
 await page.locator('#githubForm [name=repository]').fill('uneluneravie/save-the-prince-bgrpg');
 await page.locator('#githubForm [name=token]').fill('test-only');
 await page.locator('#connectGithub').click();
 await page.locator('[data-project-path]').click();
 await page.waitForSelector('.deck-card');assert.equal(await page.locator('.deck-card').count(),4);
 assert.equal(await page.locator('#cardCount').textContent(),'28');
 // An absent back description must not produce a placeholder or leading divider.
 const backDescriptions=await page.evaluate(()=>{
  const node=document.createElement('div');node.className='tcg-description';document.body.append(node);
  const results=[undefined,'','   ','Descrição presente.'].map(description=>{
   const verso={resolucoes:[{id:'R1',titulo:'Resolução',efeitos:[]},{id:'R2',titulo:'Outra resolução',efeitos:[]}]};
   if(description!==undefined)verso.descricao=description;
   node.innerHTML=CardEditor.content({verso},'verso');
   return {placeholder:node.textContent.includes('Sem descrição'),first:node.firstElementChild.tagName,
    border:getComputedStyle(node.querySelector('section')).borderTopWidth,
    nextBorder:getComputedStyle(node.querySelectorAll('section')[1]).borderTopWidth};
  });node.remove();return results;
 });
 for(const result of backDescriptions.slice(0,3))assert.deepEqual(result,{placeholder:false,first:'SECTION',border:'0px',nextBorder:'1px'});
 assert.deepEqual(backDescriptions[3],{placeholder:false,first:'P',border:'1px',nextBorder:'1px'});

 assert.equal(await page.locator('.hero-title button').count(),0);
 await page.waitForFunction(()=>activeDecks.every(d=>cardOverflowResults.get(d)?.length===deckCards(d).length));
 // Measurement runs before opening any card; both faces and edits are checked.
 await page.evaluate(async()=>{
  window.originalOverflowDecks=activeDecks;
  activeDecks=[{nome:'Overflow',quantidade:3,tamanho:'Padrão (63 × 88 mm)',cartas:[
   {titulo:'Curta',descricao:'Texto curto.'},
   {titulo:'Frente longa',descricao:'Texto longo. '.repeat(500)},
   {titulo:'Verso longo',descricao:'Texto curto.',verso:{descricao:'Texto longo. '.repeat(500)}}
  ]}];
  await scheduleCardOverflowScan();openDeckPage(0);
 });
 await page.waitForFunction(()=>cardOverflowResults.get(activeDecks[0])?.length===3);
 assert.equal(await page.locator('[data-card-index="0"] .card-overflow-badge').count(),0);
 assert((await page.locator('[data-card-index="1"] .card-overflow-badge').getAttribute('aria-label')).includes('frente'));
 assert((await page.locator('[data-card-index="2"] .card-overflow-badge').getAttribute('aria-label')).includes('verso'));
 await page.evaluate(async()=>{activeDecks[0].cartas[1].descricao='Texto curto.';await scheduleCardOverflowScan();});
 assert.equal(await page.locator('[data-card-index="1"] .card-overflow-badge').count(),0);
 await page.evaluate(()=>{activeDecks=window.originalOverflowDecks;delete window.originalOverflowDecks;});
 await page.locator('#backToProject').click();

 // Exportação real: arquivo PDF, medidas físicas e botão nos três breakpoints.
 for(const width of [360,768,1280]) {
  await page.setViewportSize({width,height:900});
  assert(await page.locator('#downloadProjectPdf').isVisible());
  const box=await page.locator('#downloadProjectPdf').boundingBox();assert(box.height>=44);assert(box.x>=0&&box.x+box.width<=width);
 }
 await page.evaluate(()=>{window.pdfSavedDecks=activeDecks;activeDecks=[{nome:'Impressão',tamanho:'Padrão (63 × 88 mm)',quantidade:9,cartas:Array.from({length:9},(_,i)=>({id:'pdf-'+i,titulo:'Carta '+i,descricao:'Teste de impressão.'}))}];});
 const downloadPromise=page.waitForEvent('download');
 await page.locator('#downloadProjectPdf').click();
 const download=await downloadPromise;
 const pdf=fs.readFileSync(await download.path());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 const pdfText=pdf.toString('latin1');assert(pdfText.includes('/Count 1'));const media=pdfText.match(/\/MediaBox \[([^\]]+)\]/)[1].trim().split(/\s+/).map(Number);assert(Math.abs(Math.min(media[2],media[3])-210*72/25.4)<0.01);assert(Math.abs(Math.max(media[2],media[3])-297*72/25.4)<0.01);
 await page.evaluate(()=>{activeDecks=window.pdfSavedDecks;delete window.pdfSavedDecks;});

 // Páginas reais do projeto: ambas devem abrir no preview, inclusive o mapa completo.
 for (const index of [0,1]) {
  await page.locator(`[data-diary-index="${index}"]`).click();
  assert(await page.locator('#noteEditor').isHidden());
  assert.notEqual(await page.locator('#noteDialogTitle').textContent(),'Editar página');
  assert(await page.locator('#notePreview h1, #notePreview h2').count()>0);
  if(index===1) {
   await page.waitForSelector('#notePreview .diary-diagram svg',{timeout:30000});
   assert.equal(await page.locator('#notePreview .diary-diagram .error-state').count(),0);
  }
  await page.locator('#closeNote').click();
 }
 // Diário: criar, abrir em leitura, editar explicitamente e manter Markdown salvo.
 const markdown = '# Planejamento\n\n**Destaque** e [link](https://example.com)\n\n- Primeiro\n- Segundo\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```mermaid\nflowchart LR\n A[Ideia] --> B[Teste]\n```\n\n<script>window.diaryXss=true</script><img src=x onerror="window.diaryXss=true">';
 await page.locator('#newNoteButton').click();
 await page.locator('#noteForm [name=title]').fill('Plano em Markdown');
 await page.locator('#noteForm [name=content]').fill(markdown);
 await page.locator('#saveNote').click();
 await page.locator('[data-diary-index="2"]').click();
 assert(await page.locator('#noteEditor').isHidden());
 assert(await page.locator('#noteForm [name=content]').isDisabled());
 assert.equal(await page.locator('#notePreview h1').textContent(),'Planejamento');
 assert.equal(await page.locator('#notePreview strong').textContent(),'Destaque');
 assert.equal(await page.locator('#notePreview li').count(),2);
 assert.equal(await page.locator('#notePreview table').count(),1);
 await page.waitForSelector('#notePreview .diary-diagram svg');
 assert.equal(await page.evaluate(()=>window.diaryXss),undefined);
 for(const width of [1280,768,360]) {
  await page.setViewportSize({width,height:900});
  assert(await page.locator('#editNote').isVisible());
  assert(await page.locator('#noteDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2));
 }
 await page.setViewportSize({width:1280,height:900});
 await page.locator('#editNote').click();
 assert.equal(await page.locator('#noteForm [name=content]').inputValue(),markdown);
 await page.locator('#noteForm [name=content]').fill('```mermaid\ninvalid diagram\n```\n\nTexto preservado.');
 await page.locator('#previewNote').click();
 await page.waitForSelector('#notePreview .error-state');
 assert((await page.locator('#notePreview').textContent()).includes('Texto preservado.'));
 await page.locator('#editNote').click();
 await page.locator('#noteForm [name=content]').fill(markdown+'\n\nAtualizado.');
 await page.locator('#saveNote').click();
 await page.waitForFunction(()=>!document.querySelector('#noteDialog').open);
 await new Promise((resolve,reject)=>{const deadline=Date.now()+5000;const check=()=>files.get(p+'diario/paginas.json')?.[2]?.conteudo===markdown+'\n\nAtualizado.'?resolve():Date.now()>deadline?reject(new Error('Diário não sincronizado')):setTimeout(check,20);check();});
 assert.equal(files.get(p+'diario/paginas.json')[2].conteudo,markdown+'\n\nAtualizado.');
 await page.locator('[data-diary-index="2"]').click();
 assert(await page.locator('#noteEditor').isHidden());
 await page.locator('#editNote').click();
 await page.locator('#noteForm [name=content]').fill('Alteração cancelada');
 await page.locator('#closeNote').click();
 await page.locator('[data-diary-index="2"]').click();
 assert((await page.locator('#notePreview').textContent()).includes('Atualizado.'));
 await page.locator('#closeNote').click();
 // Un candidato: somente o verso contém o segredo.
 await page.locator('.deck-card').filter({hasText:files.get(p+'baralhos/ambrosio-candidatos.json').nome}).click();
 await page.locator('#openDeckPage').click();
 await page.locator('[data-card-index="1"]').click();
 assert(!(await page.locator('#tcgCardPreview').textContent()).includes('É o príncipe verdadeiro'));
 await page.locator('#previewBack').click();assert((await page.locator('#tcgCardPreview').textContent()).includes('É o príncipe verdadeiro'));
 await page.locator('#previewFront').click();
 await page.locator('#cardForm [name=title]').fill('Ambrósio — título revisado');
 await page.locator('#cardForm button.primary-button').click();
 await page.waitForFunction(()=>!document.querySelector('#cardPreviewDialog').open);
 await page.waitForTimeout(200);
 const saved=files.get(p+'baralhos/ambrosio-candidatos.json').cartas[1];
 assert.equal(saved.titulo,'Ambrósio — título revisado');assert(saved.verso.descricao.includes('príncipe verdadeiro'));assert.equal(saved.condicoes.length,2);
 // Referência inválida impede salvar.
 await page.locator('[data-card-index="1"]').click();
 await page.locator('#structuredCardEditor label').filter({hasText:/^Identificador$/}).locator('input').fill('C99');
 await page.locator('#cardForm button.primary-button').click();
 assert((await page.locator('#cardValidation').textContent()).includes('inexistente'));
 await page.locator('#cardForm [data-close-dialog]').click();
 // Definições sobrevivem à criação de um baralho.
 await page.locator('#backToProject').click();
 await page.locator('#editDefinitions').click();
 assert(await page.locator('#definitionsEditor').getByText('Recursos e contadores',{exact:true}).count()>0);
 await page.locator('#definitionsForm button.primary-button').click();
 await page.waitForTimeout(100);
 await page.locator('#addDeckCard').click();
 await page.locator('#deckForm [name=name]').fill('Teste de compatibilidade');
 await page.locator('#deckForm [name=quantity]').fill('1');
 await page.locator('#deckForm [name=deckType]').fill('Item');
 await page.locator('#deckForm [name=textFont]').selectOption('Arial');
 await page.locator('#deckForm [name=textSize]').fill('10');
 await page.locator('#saveDeck').click();await page.waitForTimeout(200);
 assert.equal(files.get(p+'projeto.json').baralhos.length,5);assert.equal(files.get(p+'projeto.json').definicoes.condicoes.length,3);
 // Typography uses points and survives saving, reopening and both faces.
 await page.locator('.deck-card').filter({hasText:'Teste de compatibilidade'}).click();
 assert.equal(await page.locator('#deckForm [name=textFont]').inputValue(),'Arial');
 assert.equal(await page.locator('#deckForm [name=textSize]').inputValue(),'10');
 await page.locator('#openDeckPage').click();await page.locator('[data-card-index="0"]').click();
 for(const face of ['#previewFront','#previewBack']) {
  await page.locator(face).click();
  const typography=await page.locator('#tcgCardPreview .tcg-description').evaluate(e=>({font:getComputedStyle(e).fontFamily,size:parseFloat(getComputedStyle(e).fontSize)}));
  assert(typography.font.includes('Arial'));assert(Math.abs(typography.size-10*96/72)<.01);
  const titleTypography=await page.locator('#tcgCardPreview header').evaluate(e=>({font:getComputedStyle(e).fontFamily,size:parseFloat(getComputedStyle(e).fontSize)}));
  assert.deepEqual(titleTypography,typography);
 }
 assert.equal(files.get(p+'baralhos/teste-de-compatibilidade.json').fonteTexto,'Arial');
 assert.equal(files.get(p+'baralhos/teste-de-compatibilidade.json').tamanhoFonteTexto,10);
 await page.locator('#cardForm [data-close-dialog]').click();await page.locator('#backToProject').click();
 // Preview em três tamanhos, sem overflow horizontal da página/dialog.
 await page.locator('.deck-card').filter({hasText:'Situações'}).click();await page.locator('#openDeckPage').click();await page.locator('[data-card-index="8"]').click();
 // Frente pública: pré-requisitos, sem pagamento ou resultados.
 const front=await page.locator('#tcgCardPreview').textContent();assert(!front.includes('Escolham uma opção antes de virar a carta.'));
 const gap=await page.locator('#tcgCardPreview').evaluate(e=>e.querySelector('.tcg-description').getBoundingClientRect().top-e.querySelector('header').getBoundingClientRect().bottom);assert(gap>=8);assert(front.includes('Requer:'));assert(front.includes('Provisões'));assert(!front.includes('Resolver:'));assert(!front.includes('Pagamento:'));assert(!front.includes('Alarme:'));
 await page.locator('#previewBack').click();assert((await page.locator('#tcgCardPreview').textContent()).includes('Resolver:'));assert((await page.locator('#tcgCardPreview').textContent()).includes('Alarme:'));
 await page.locator('#previewFront').click();
 // Editar a resolução no verso, sem tocar em JSON.
 const resolution=page.locator('[data-schema=verso] [data-items=resolucao] > details').first();await resolution.locator(':scope > summary').click();
 const effect=resolution.locator('[data-items=efeito] > details').first();await effect.locator(':scope > summary').click();
 await effect.locator('label').filter({hasText:/^Quantidade \/ alteração$/}).locator('input').fill('-2');
 await page.locator('#cardForm button.primary-button').click();await page.waitForTimeout(200);
 assert.equal(files.get(p+'baralhos/ambrosio-situacoes.json').cartas[8].verso.resolucoes[0].efeitos[0].quantidade,-2);
 await page.locator('[data-card-index="8"]').click();
 for(const width of [1280,768,360]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
  const overflow=await page.evaluate(()=>{const d=document.querySelector('#cardPreviewDialog');return {page:document.documentElement.scrollWidth>innerWidth+2,dialog:d.scrollWidth>d.clientWidth+2};});
  assert(!overflow.page && !overflow.dialog,JSON.stringify({width,...overflow}));
  assert.equal(await page.locator('#previewActualSize').count(),0);
  for(const face of ['#previewFront','#previewBack']){
   await page.locator(face).click();
   const metrics=await page.locator('#tcgCardPreview').evaluate(e=>({
    width:e.offsetWidth,height:e.offsetHeight,shown:e.getBoundingClientRect().width,
    available:e.closest('.preview-viewport').clientWidth,
    font:getComputedStyle(e.querySelector('header')).fontSize,
    overflow:hasCardOverflow(e)
   }));
   assert(Math.abs(metrics.width-70*96/25.4)<1);
   assert(Math.abs(metrics.height-120*96/25.4)<1);
   assert(Math.abs(metrics.shown-Math.min(metrics.available,70*96/25.4))<1);
   assert.equal(metrics.font,'12px');
   const titleInput=await page.locator('#cardForm [name=title]').boundingBox();
   assert(titleInput.x>=0&&titleInput.x+titleInput.width<=width);
  }
  await page.locator('#previewFront').click();
  const textOverflow=await page.locator('#tcgCardPreview .tcg-description').evaluate(e=>e.scrollHeight>e.clientHeight+2);
  if(textOverflow)await page.waitForFunction(()=>document.querySelector('#cardOverflowWarning').textContent.includes('excede'));
  await page.locator('#cardPreviewDialog').evaluate(d=>d.scrollTop=0);
  await page.screenshot({path:`/tmp/card-builder-${width}.png`});
  await page.locator('#previewBack').click();await page.screenshot({path:`/tmp/card-builder-verso-${width}.png`});await page.locator('#previewFront').click();
 }
 // A wide card scales text, title and borders together without changing layout/overflow.
 await page.evaluate(()=>{window.originalPreviewDeck=previewDeckDraft;previewDeckDraft={...previewDeckDraft,tamanho:'Personalizado',tamanhoPersonalizado:{largura:140,altura:180}};renderStructuredPreview();});
 let canonicalLayout;
 for(const width of [1280,768,360]) {
  await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
  const layout=await page.locator('#tcgCardPreview').evaluate(e=>{
   const text=e.querySelector('.tcg-description');
   return {width:e.offsetWidth,height:e.offsetHeight,textWidth:text.clientWidth,textHeight:text.clientHeight,scroll:text.scrollHeight,overflow:hasCardOverflow(e)};
  });
  if(canonicalLayout)assert.deepEqual(layout,canonicalLayout);else canonicalLayout=layout;
  const fit=await page.locator('#tcgCardPreview').evaluate(e=>({shown:e.getBoundingClientRect().width,available:e.closest('.preview-viewport').clientWidth,scale:new DOMMatrix(getComputedStyle(e).transform).a}));
  assert(fit.shown<=fit.available+1);assert(fit.scale<1);
 }
 await page.evaluate(()=>{previewDeckDraft=window.originalPreviewDeck;delete window.originalPreviewDeck;renderStructuredPreview();});
 // Remover uma seção realmente a remove do JSON salvo.
 await page.locator('#cardForm [data-close-dialog]').click();await page.locator('#backToProject').click();
 await page.locator('.deck-card').filter({hasText:files.get(p+'baralhos/ambrosio-quest.json').nome}).click();await page.locator('#openDeckPage').click();await page.locator('[data-card-index="0"]').click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remover Seções',exact:true}).first().click();
 await page.locator('#cardForm button.primary-button').click();await page.waitForTimeout(200);assert(!Object.hasOwn(files.get(p+'baralhos/ambrosio-quest.json').cartas[0],'secoes'));
 assert.deepEqual(errors,[]);
 // Baralho legado com metadados desconhecidos continua editável.
 files.get(p+'projeto.json').baralhos.push('legado.json');
 files.set(p+'baralhos/legado.json',{nome:'Legado',quantidade:1,cartas:[{titulo:'Antiga',descricao:'Texto antigo',imagem:'',extra:{cartaId:'referência de outro formato',valor:7}}]});
 // Recarregar busca do GitHub simulado preserva edição e quatro baralhos originais.
 await page.reload();await page.locator('#githubForm [name=repository]').fill('uneluneravie/save-the-prince-bgrpg');await page.locator('#githubForm [name=token]').fill('test-only');await page.locator('#connectGithub').click();await page.locator('[data-project-path]').click();await page.waitForSelector('.deck-card');assert.equal(await page.locator('.deck-card').count(),6);
 await page.locator('.deck-card').filter({hasText:'Legado'}).click();await page.locator('#openDeckPage').click();await page.locator('[data-card-index="0"]').click();
 await page.locator('#cardForm [name=title]').fill('Antiga revisada');await page.locator('#cardForm button.primary-button').click();await page.waitForTimeout(200);
 assert.deepEqual(files.get(p+'baralhos/legado.json').cartas[0].extra,{cartaId:'referência de outro formato',valor:7});assert.equal(files.get(p+'baralhos/legado.json').cartas[0].titulo,'Antiga revisada');
 assert.deepEqual(errors,[]);
 assert.deepEqual(staleAssets,[],'O HTML deve solicitar arquivos versionados para evitar JavaScript antigo em cache');
 await browser.close();server.close();console.log('Integração passou: 28 cartas, versos, edição/sync, referências, definições, novo baralho, recarga e 360/768/1280 px.');
})().catch(e=>{console.error(e);process.exit(1);});
