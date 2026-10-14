const assert=require('node:assert/strict');
const M=require('../card-model.js');
const project={definicoes:{condicoes:[{id:'aliado',nome:'Aliado',grupoExclusivo:'atitude'}],recursos:[{id:'energia',minimo:0,maximo:5,inicial:2}],tags:[{id:'pista'}],zonas:[{id:'mesa'}]}};
const deck={versaoFormato:2,id:'teste',nome:'Teste',quantidade:1,cartas:[{id:'C1',titulo:'Carta',descricao:'Texto',opcoes:[{id:'A',rotulo:'Ajudar',custos:[{tipo:'recurso',recursoId:'energia',quantidade:1}],efeitos:[{acao:'aplicar',alvo:{tipo:'carta',cartaId:'C1'},condicaoId:'aliado'}]}]}]};
assert.deepEqual(M.validate(project,[deck]),[]);
function invalid(edit,pattern){const p=M.clone(project),d=M.clone(deck);edit(p,d);assert(M.validate(p,[d]).some(e=>pattern.test(e)));}
invalid((p,d)=>d.cartas[0].opcoes[0].efeitos[0].alvo.cartaId='fantasma',/inexistente/);
invalid((p,d)=>d.cartas[0].opcoes[0].efeitos[0].condicaoId='errada',/inexistente/);
invalid((p,d)=>d.quantidade=2,/difere/);
invalid((p,d)=>d.cartas.push(M.clone(d.cartas[0])),/duplicado/);
invalid((p,d)=>p.definicoes.recursos[0].inicial=10,/inválidos/);
invalid((p,d)=>d.cartas[0].opcoes[0].custos[0].quantidade=-1,/custo inválido/);
invalid((p,d)=>d.cartas[0].opcoes[0].efeitos[0]={acao:'ramificar'},/ramificação/);
invalid((p,d)=>d.cartas[0].opcoes[0].requisitos={tipo:'nao',itens:[]},/composição/);
invalid((p,d)=>d.cartas[0].opcoes[0].efeitos[0].alvo={tipo:'baralho',baralhoId:'teste'},/alvo incompleto/);
const legacy={nome:'Antigo',quantidade:1,cartas:[{titulo:'Carta',descricao:'Descrição',imagem:'',extra:{livre:1,cartaId:'ID de outro formato'}}]};
assert.deepEqual(M.validate({},[legacy]),[]);
assert.deepEqual(M.normalizeDeck(legacy),legacy);
assert.deepEqual(M.normalizeDeck(legacy).cartas[0].extra,{livre:1,cartaId:'ID de outro formato'});
const fs=require('node:fs'),path=require('node:path');
if(process.argv[2]){
 const root=process.argv[2],p=JSON.parse(fs.readFileSync(path.join(root,'projeto.json'))),decks=p.baralhos.map(f=>JSON.parse(fs.readFileSync(path.join(root,'baralhos',f))));
 assert.deepEqual(M.validate(p,decks),[]);assert.deepEqual(decks.map(d=>d.quantidade),[1,14,3,10]);
 assert.equal(decks.reduce((n,d)=>n+d.cartas.length,0),28);
 assert.equal(decks[1].cartas.reduce((n,c)=>n+c.opcoes.length,0),42);
 assert.equal(decks[2].cartas.filter(c=>c.verso).length,3);
 assert.equal(M.findResolution(decks[1].cartas[8],decks[1].cartas[8].opcoes[0],decks).custos[0].tipo,'condicionado');
 assert.equal(decks[3].cartas[4].regras[0].evento,'reaplicar');
}
const local=M.clone(deck);local.cartas[0].verso={resolucoes:[{id:'R1',custos:local.cartas[0].opcoes[0].custos,efeitos:local.cartas[0].opcoes[0].efeitos}]};
local.cartas[0].opcoes[0]={id:'A',rotulo:'Ajudar',resolucao:{resolucaoId:'R1'}};
assert.deepEqual(M.validate(project,[local]),[]);
assert.equal(M.publicRequirements(local.cartas[0],local.cartas[0].opcoes[0],[local]).recursoId,'energia');
const missing=M.clone(local);missing.cartas[0].opcoes[0].resolucao.resolucaoId='ausente';assert(M.validate(project,[missing]).some(e=>e.includes('resolução inexistente')));
const badHidden=M.clone(local);badHidden.cartas[0].verso.resolucoes[0].efeitos[0].alvo.cartaId='ausente';assert(M.validate(project,[badHidden]).some(e=>e.includes('inexistente')));
const ambiguous=M.clone(local);ambiguous.cartas[0].opcoes[0].efeitos=[{acao:'texto',texto:'duplicado'}];assert(M.validate(project,[ambiguous]).some(e=>e.includes('não ambos')));
const separate=M.clone(local), resolutionCard={id:'R-CARD',titulo:'Resolução',resolucoes:separate.cartas[0].verso.resolucoes};delete separate.cartas[0].verso;
separate.cartas[0].opcoes[0].resolucao.cartaId='R-CARD';separate.cartas.push(resolutionCard);separate.quantidade=2;
assert.deepEqual(M.validate(project,[separate]),[]);assert.equal(M.findResolution(separate.cartas[0],separate.cartas[0].opcoes[0],[separate]).id,'R1');
console.log('Modelo validado: compatibilidade, referências, limites, custos, ramificações e migração.');
// Preview público não pode incluir a resolução; o verso deve renderizá-la.
const vm=require('node:vm');const code=require('node:fs').readFileSync(require('node:path').join(__dirname,'../card-editor.js'),'utf8');
const sandbox={CardModel:M,activeDecks:[local],activeProject:project,escapeHtml:v=>String(v??'').replaceAll('<','&lt;')};
vm.createContext(sandbox);vm.runInContext(code+';globalThis.Editor=CardEditor;',sandbox);
const front=sandbox.Editor.content(local.cartas[0],'frente'),back=sandbox.Editor.content(local.cartas[0],'verso');
assert(front.includes('Requer:'));assert(!front.includes('Resolver:'));assert(!front.includes('Pagamento:'));assert(back.includes('Resolver:'));assert(back.includes('Pagamento:'));
console.log('Separação frente/verso e pré-requisitos públicos validados.');
