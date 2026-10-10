/* Teste de integração com API GitHub simulada; nenhum PAT real ou push. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
(async()=>{
 const server=require('node:http').createServer((req,res)=>{const file=path.resolve(__dirname,'..',req.url.replace(/^\/card-builder\/?/,'')||'index.html');if(!file.startsWith(path.resolve(__dirname,'..')+path.sep)){res.writeHead(403);res.end();return;}try{const data=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root=path.resolve(process.argv[2]||'../save-the-prince-bgrpg');
 const files=new Map([['projetos/index.json',{projetos:['local-1790897190889']}],['projetos/local-1790897190889/diario/paginas.json',[]]]);
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
 await page.goto(origin+'/card-builder/');
 await page.locator('#githubForm [name=repository]').fill('uneluneravie/save-the-prince-bgrpg');
 await page.locator('#githubForm [name=token]').fill('test-only');
 await page.locator('#connectGithub').click();
 await page.locator('[data-project-path]').click();
 await page.waitForSelector('.deck-card');assert.equal(await page.locator('.deck-card').count(),4);
 assert.equal(await page.locator('#cardCount').textContent(),'28');
 // Un candidato: somente o verso contém o segredo.
 await page.locator('.deck-card').filter({hasText:'Candidatos'}).click();
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
 await page.locator('#saveDeck').click();await page.waitForTimeout(200);
 assert.equal(files.get(p+'projeto.json').baralhos.length,5);assert.equal(files.get(p+'projeto.json').definicoes.condicoes.length,3);
 // Preview em três tamanhos, sem overflow horizontal da página/dialog.
 await page.locator('.deck-card').filter({hasText:'Situações'}).click();await page.locator('#openDeckPage').click();await page.locator('[data-card-index="8"]').click();
 // Editar um efeito estruturado, sem tocar em JSON.
 const option=page.locator('[data-items=opcao] > details').first();await option.locator(':scope > summary').click();
 const effect=option.locator('[data-items=efeito] > details').first();await effect.locator(':scope > summary').click();
 await effect.locator('label').filter({hasText:/^Quantidade \/ alteração$/}).locator('input').fill('-2');
 await page.locator('#cardForm button.primary-button').click();await page.waitForTimeout(200);
 assert.equal(files.get(p+'baralhos/ambrosio-situacoes.json').cartas[8].opcoes[0].efeitos[0].quantidade,-2);
 await page.locator('[data-card-index="8"]').click();
 for(const width of [1280,768,360]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
  const overflow=await page.evaluate(()=>{const d=document.querySelector('#cardPreviewDialog');return {page:document.documentElement.scrollWidth>innerWidth+2,dialog:d.scrollWidth>d.clientWidth+2};});
  assert(!overflow.page && !overflow.dialog,JSON.stringify({width,...overflow}));
  const textOverflow=await page.locator('#tcgCardPreview .tcg-description').evaluate(e=>e.scrollHeight>e.clientHeight+2);
  if(textOverflow)assert((await page.locator('#cardOverflowWarning').textContent()).includes('excede'));
  await page.locator('#cardPreviewDialog').evaluate(d=>d.scrollTop=0);
  await page.screenshot({path:`/tmp/card-builder-${width}.png`});
 }
 // Remover uma seção realmente a remove do JSON salvo.
 await page.locator('#cardForm [data-close-dialog]').click();await page.locator('#backToProject').click();
 await page.locator('.deck-card').filter({hasText:'Ambrósio — Quest'}).click();await page.locator('#openDeckPage').click();await page.locator('[data-card-index="0"]').click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remover Seções',exact:true}).click();
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
 await browser.close();server.close();console.log('Integração passou: 28 cartas, versos, edição/sync, referências, definições, novo baralho, recarga e 360/768/1280 px.');
})().catch(e=>{console.error(e);process.exit(1);});
