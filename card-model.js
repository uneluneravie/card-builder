/* Modelo de autoria v2. Não executa partidas. Compatível com cartas v1. */
(function (root) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const fields = {
    alvo: {tipo:['carta','baralho','grupo'],cartaId:'@cartas',baralhoId:'@baralhos',selecao:['uma','todas']},
    requisito: {tipo:['texto','todos','qualquer','nao','condicao','recurso','zona','contagem'],texto:'text',alvo:'alvo',condicaoId:'@condicoes',recursoId:'@recursos',zonaId:'@zonas',tagId:'@tags',comparador:['>=','<=','=='],quantidade:'number',itens:['requisito']},
    custo: {tipo:['recurso','carta','alternativa','condicionado'],requisito:'requisito',entao:['custo'],senao:['custo'],recursoId:'@recursos',cartaId:'@cartas',quantidade:'number',alternativas:['custo']},
    efeito: {acao:['texto','mover','aplicar','remover','alterar','revelar','ramificar','encerrar'],texto:'text',alvo:'alvo',zonaId:'@zonas',condicaoId:'@condicoes',recursoId:'@recursos',quantidade:'number',requisito:'requisito',entao:['efeito'],senao:['efeito']},
    opcao: {id:'string',rotulo:'string',texto:'text',requisitos:'requisito',custos:['custo'],efeitos:['efeito']},
    secao: {titulo:'string',texto:'text'},
    regra: {evento:['receber','reaplicar','revelar','manual'],texto:'text',requisitos:'requisito',efeitos:['efeito']},
    condicaoCarta: {condicaoId:'@condicoes',efeitos:['efeito']},
    condicao: {id:'string',nome:'string',descricao:'text',grupoExclusivo:'string'},
    recurso: {id:'string',nome:'string',minimo:'number',maximo:'number',inicial:'number'},
    tag: {id:'string',nome:'string'},
    zona: {id:'string',nome:'string'},
    verso: {titulo:'string',descricao:'text',imagem:'string',secoes:['secao']}
  };
  function validate(project, decks) {
    const errors = [], defs=project.definicoes || {}, sets={cartas:new Set(),baralhos:new Set()};
    const err=(path,msg)=>errors.push(`${path}: ${msg}`);
    for (const kind of ['condicoes','recursos','tags','zonas']) {
      sets[kind]=new Set();
      for(const d of defs[kind] || []) {
        if(!d.id || sets[kind].has(d.id))err(kind,'ID ausente ou duplicado');
        sets[kind].add(d.id);
        if(kind==='recursos' && (![d.minimo,d.maximo,d.inicial].every(Number.isFinite)||d.minimo>d.maximo||d.inicial<d.minimo||d.inicial>d.maximo))err(d.id,'limites/inicial inválidos');
      }
    }
    for(const deck of decks) {
      if(deck.versaoFormato>=2 && (!deck.id||sets.baralhos.has(deck.id)))err(deck.nome,'ID de baralho ausente ou duplicado');
      if(deck.id)sets.baralhos.add(deck.id);
      if(!Number.isInteger(deck.quantidade)||deck.quantidade<1)err(deck.nome,'quantidade deve ser inteira e positiva');
      if(deck.versaoFormato>=2 && deck.quantidade !== deck.cartas?.length)err(deck.nome,'quantidade difere do número de cartas');
      for(const card of deck.cartas||[]) {
        if(deck.versaoFormato>=2 && (!card.id||sets.cartas.has(card.id)))err(card.titulo,'ID de carta ausente ou duplicado');
        if(card.id)sets.cartas.add(card.id);
      }
    }
    const refs={cartaId:'cartas',baralhoId:'baralhos',condicaoId:'condicoes',recursoId:'recursos',zonaId:'zonas',tagId:'tags'};
    function walk(v,path) {
      if(!v || typeof v!=='object')return;
      if(Array.isArray(v)){v.forEach((x,i)=>walk(x,`${path}[${i}]`));return;}
      const structural=new Set(['cartas','opcoes','condicoes','regras','custos','efeitos','requisitos','requisito','entao','senao','alternativas','itens','alvo','tags',...Object.keys(refs)]);
      for(const [k,val] of Object.entries(v)) {
        if(!structural.has(k))continue;
        if(refs[k] && val && !sets[refs[k]].has(val))err(path,`${k} inexistente: ${val}`);
        if(k==='tags' && Array.isArray(val))for(const tag of val)if(!sets.tags.has(tag))err(path,`tag inexistente: ${tag}`);
        if(k==='alvo' && val){if(!['carta','baralho','grupo'].includes(val.tipo)||val.tipo==='carta'&&!val.cartaId||val.tipo==='baralho'&&(!val.baralhoId||!['uma','todas'].includes(val.selecao)))err(path,'alvo incompleto');}
        walk(val,`${path}.${k}`);
      }
      if(v.acao && !fields.efeito.acao.includes(v.acao))err(path,'ação desconhecida');
      if(v.acao==='mover' && (!v.alvo||!v.zonaId))err(path,'mover requer alvo e zona');
      if(['aplicar','remover'].includes(v.acao) && (!v.alvo||!v.condicaoId))err(path,'condição requer alvo e condição');
      if(v.acao==='alterar' && (!v.recursoId||!Number.isFinite(v.quantidade)))err(path,'alterar requer recurso e quantidade');
      if(v.acao==='revelar' && !v.alvo)err(path,'revelar requer alvo');
      if(v.acao==='ramificar' && (!v.requisito||!v.entao))err(path,'ramificação requer requisito e efeitos');
      if(v.acao==='texto' && !v.texto)err(path,'efeito textual vazio');
      if(v.custos)for(const cost of v.custos)checkCost(cost,path);
      if(v.requisitos)checkRequirement(v.requisitos,path);
      if(v.requisito)checkRequirement(v.requisito,path);
      if(v.opcoes){const seen=new Set();for(const o of v.opcoes){if(!o.id||seen.has(o.id)||!o.rotulo)err(path,'opção sem ID/rótulo ou ID duplicado');seen.add(o.id);}}
    }
    function checkCost(c,path) {
      if(c.tipo==='condicionado'){if(!c.requisito||!Array.isArray(c.entao)||!Array.isArray(c.senao))err(path,'custo condicionado incompleto');else {checkRequirement(c.requisito,path);[...c.entao,...c.senao].forEach(x=>checkCost(x,path));}return;}
      if(c.tipo==='alternativa'){if(!c.alternativas?.length)err(path,'custo alternativo vazio');else c.alternativas.forEach(x=>checkCost(x,path));return;}
      if(!['recurso','carta'].includes(c.tipo)||!Number.isFinite(c.quantidade)||c.quantidade<=0)err(path,'custo inválido');
      if(c.tipo==='recurso'&&!c.recursoId || c.tipo==='carta'&&!c.cartaId)err(path,'custo sem referência');
    }
    function checkRequirement(r,path) {
      if(!fields.requisito.tipo.includes(r.tipo))err(path,'requisito desconhecido');
      if(['todos','qualquer','nao'].includes(r.tipo)){if(!r.itens?.length||r.tipo==='nao'&&r.itens.length!==1)err(path,'composição de requisitos inválida');else r.itens.forEach(x=>checkRequirement(x,path));}
      if(r.tipo==='condicao'&&(!r.alvo||!r.condicaoId))err(path,'requisito sem alvo/condição');
      if(r.tipo==='recurso'&&(!r.recursoId||!Number.isFinite(r.quantidade)||!r.comparador))err(path,'requisito de recurso incompleto');
      if(r.tipo==='zona'&&(!r.alvo||!r.zonaId))err(path,'requisito de zona incompleto');
      if(r.tipo==='contagem'&&(!r.tagId||!r.zonaId||!Number.isFinite(r.quantidade)||!r.comparador))err(path,'contagem incompleta');
      if(r.tipo==='texto'&&!r.texto)err(path,'requisito textual vazio');
    }
    decks.forEach(d=>walk(d,d.nome));
    return [...new Set(errors)];
  }
  function normalizeDeck(deck) {
    const d=clone(deck);
    d.cartas=(d.cartas||[]).map(c=>({...c,descricao:c.descricao??c.texto??'',imagem:c.imagem||''}));
    return d;
  }
  const api={fields,validate,normalizeDeck,clone};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CardModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
