/* Editor visual genérico; não contém regras de um jogo específico. */
const CardEditor = (() => {
  const schemas={...CardModel.fields,
    carta:{id:'string',tags:['@tags'],secoes:['secao'],verso:'verso',resolucoes:['resolucao'],opcoes:['opcao'],condicoes:['condicaoCarta'],regras:['regra']},
    definicoes:{condicoes:['condicao'],recursos:['recurso'],tags:['tag'],zonas:['zona']}};
  const labels={resolucoes:'Resoluções',resolucao:'Resolução vinculada',resolucaoId:'ID da resolução',id:'Identificador',tipo:'Tipo',acao:'Ação',texto:'Texto / instrução',rotulo:'Nome da opção',requisitos:'Requisitos',requisito:'Requisito',custos:'Custos',efeitos:'Efeitos',entao:'Se atendido',senao:'Caso contrário',itens:'Requisitos combinados',alvo:'Alvo',cartaId:'Carta',baralhoId:'Baralho',condicaoId:'Condição',recursoId:'Recurso',zonaId:'Zona',tagId:'Tag',quantidade:'Quantidade / alteração',comparador:'Comparação',selecao:'Seleção',alternativas:'Alternativas de pagamento',condicoes:'Condições',recursos:'Recursos e contadores',zonas:'Zonas',tags:'Tags',secoes:'Seções',verso:'Verso individual',opcoes:'Opções',regras:'Regras e gatilhos',evento:'Evento',descricao:'Descrição',imagem:'URL da imagem',titulo:'Título',nome:'Nome',grupoExclusivo:'Grupo de exclusividade',minimo:'Mínimo',maximo:'Máximo',inicial:'Valor inicial'};
  const esc=escapeHtml;
  let context={};
  function catalog(kind){
    if(kind==='cartas')return activeDecks.flatMap(d=>(d.cartas||[]).filter(c=>c.id).map(c=>({id:c.id,nome:`${c.id} — ${c.titulo}`})));
    if(kind==='baralhos')return activeDecks.filter(d=>d.id).map(d=>({id:d.id,nome:d.nome}));
    return (context.definicoes||activeProject?.definicoes||{})[kind]||[];
  }
  const opened=new WeakSet();
  const el=(tag,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;return e;};
  function seed(type){
    if(Array.isArray(type))return [];
    if(type==='number')return 0;
    if(['string','text'].includes(type)||type.startsWith('@'))return '';
    const defaults={requisito:{tipo:'texto',texto:''},efeito:{acao:'texto',texto:''},custo:{tipo:'recurso',recursoId:'',quantidade:1},alvo:{tipo:'carta',cartaId:''},resolucao:{id:'',titulo:'',efeitos:[]},referenciaResolucao:{resolucaoId:''},opcao:{id:'',rotulo:''},secao:{titulo:'',texto:''},regra:{evento:'manual',efeitos:[]},condicaoCarta:{condicaoId:'',efeitos:[]},condicao:{id:'',nome:''},recurso:{id:'',nome:'',minimo:0,maximo:5,inicial:0},tag:{id:'',nome:''},zona:{id:'',nome:''},verso:{titulo:'',descricao:''}};
    return CardModel.clone(defaults[type]||{});
  }
  function mount(container,data,type,onChange,defs){
    context={definicoes:defs||activeProject?.definicoes};
    container.replaceChildren();
    function draw(parent,value,spec,set,label){
      if(Array.isArray(spec)&&spec.length===1){
        const box=el('fieldset','rule-array'),legend=el('legend');legend.textContent=label;box.append(legend);box.dataset.items=spec[0];parent.append(box);
        const list=Array.isArray(value)?value:[];
        list.forEach((item,i)=>{
          const row=el('details','rule-item'),toolbar=el('div','rule-toolbar');
          const summary=el('summary');summary.textContent=item?.rotulo||item?.titulo||item?.nome||item?.acao||item?.condicaoId||`${label} ${i+1}`;row.append(summary);if(item&&typeof item==='object'){row.open=opened.has(item);row.ontoggle=()=>{if(row.open)opened.add(item);else opened.delete(item);};}
          const info=el('strong');info.textContent=`${label} ${i+1}`;toolbar.append(info);
          for(const [caption,delta] of [['↑',-1],['↓',1]]){const b=el('button');b.type='button';b.textContent=caption;b.setAttribute('aria-label',`Mover ${label} ${i+1} ${delta<0?'para cima':'para baixo'}`);b.disabled=i+delta<0||i+delta>=list.length;b.onclick=()=>{[list[i],list[i+delta]]=[list[i+delta],list[i]];set(list);refresh();};toolbar.append(b);}
          const remove=el('button');remove.type='button';remove.textContent='Remover';remove.onclick=()=>{if(!confirm(`Remover ${label} ${i+1}?`))return;list.splice(i,1);set(list);refresh();};toolbar.append(remove);row.append(toolbar);box.append(row);
          draw(row,item,spec[0],v=>{list[i]=v;set(list);},`${label} ${i+1}`);
        });
        const add=el('button','secondary-button');add.type='button';add.textContent=`Adicionar ${label.toLowerCase()}`;add.onclick=()=>{const item=seed(spec[0]);if(item&&typeof item==='object'&&!Array.isArray(item)&&['opcao','resolucao'].includes(spec[0]))item.id=`${spec[0]}-${crypto.randomUUID()}`;list.push(item);set(list);refresh();};box.append(add);return;
      }
      if(typeof spec==='string'&&schemas[spec]){
        const box=el('fieldset','rule-object'),legend=el('legend');legend.textContent=label;box.append(legend);box.dataset.schema=spec;parent.append(box);
        const obj=value||{},schema=schemas[spec];
        for(const [key,t] of Object.entries(schema))if(Object.hasOwn(obj,key)){
          const row=el('div','rule-field');box.append(row);
          draw(row,obj[key],t,v=>{obj[key]=v;set(obj);if(key==='tipo'||key==='acao'){const variants={efeito:{mover:['alvo','zonaId'],aplicar:['alvo','condicaoId'],remover:['alvo','condicaoId'],alterar:['recursoId','quantidade'],revelar:['alvo'],ramificar:['requisito','entao','senao'],texto:['texto'],encerrar:['texto']},requisito:{texto:['texto'],condicao:['alvo','condicaoId'],recurso:['recursoId','comparador','quantidade'],zona:['alvo','zonaId'],contagem:['tagId','zonaId','comparador','quantidade'],todos:['itens'],qualquer:['itens'],nao:['itens']},custo:{recurso:['recursoId','quantidade'],carta:['cartaId','quantidade'],alternativa:['alternativas'],condicionado:['requisito','entao','senao']},alvo:{carta:['cartaId'],baralho:['baralhoId','selecao'],grupo:[]}};for(const k of variants[spec]?.[v]||[])if(!Object.hasOwn(obj,k)){const field=schema[k];obj[k]=Array.isArray(field)&&field.length>1?field[0]:seed(field);}set(obj);refresh();}},labels[key]||key);
          const remove=el('button','remove-field');remove.type='button';remove.hidden=['id','tipo','acao','rotulo'].includes(key);remove.textContent=`Remover ${labels[key]||key}`;remove.onclick=()=>{if(!confirm(`Remover ${labels[key]||key}?`))return;delete obj[key];set(obj);refresh();};row.append(remove);
        }
        const missing=Object.keys(schema).filter(k=>!Object.hasOwn(obj,k));
        if(missing.length){const select=el('select');select.setAttribute('aria-label',`Adicionar campo em ${label}`);select.append(new Option('Adicionar campo…',''));for(const k of missing)select.append(new Option(labels[k]||k,k));select.onchange=()=>{if(!select.value)return;const t=schema[select.value];obj[select.value]=Array.isArray(t)&&t.length>1?t[0]:seed(t);set(obj);refresh();};box.append(select);}
        return;
      }
      const wrapper=el('label');wrapper.append(document.createTextNode(label));parent.append(wrapper);
      let input;
      if(Array.isArray(spec)||typeof spec==='string'&&spec.startsWith('@')){
        input=el('select');input.append(new Option('Selecione…',''));
        const options=Array.isArray(spec)?spec.map(v=>({id:v,nome:v})):catalog(spec.slice(1));
        for(const opt of options)input.append(new Option(opt.nome||opt.id,opt.id));
        if(value&&!options.some(o=>o.id===value))input.append(new Option(`${value} (referência não disponível)`,value));
        input.value=value||'';input.onchange=()=>set(input.value);
      }else{input=el(spec==='text'?'textarea':'input');if(spec==='number'){input.type='number';input.step='any';}if(spec==='text')input.rows=3;input.value=value??'';input.oninput=()=>set(spec==='number'?Number(input.value):input.value);}
      wrapper.append(input);
    }
    function refresh(){container.replaceChildren();draw(container,data,type,v=>{data=v;onChange(data);},type==='carta'?'Estrutura da carta':'Definições do projeto');}
    refresh();return ()=>data;
  }
  function describe(r){
    if(!r)return '';
    const name=(kind,id)=>catalog(kind).find(d=>d.id===id)?.nome||id||'';
    const target=r.alvo?.cartaId||name('baralhos',r.alvo?.baralhoId)||(r.alvo?.tipo==='grupo'?'grupo':'alvo escolhido');
    if(r.tipo==='nao')return `NÃO (${describe(r.itens?.[0])})`;
    if(r.tipo==='todos'||r.tipo==='qualquer')return (r.itens||[]).map(x=>`(${describe(x)})`).join(r.tipo==='todos'?' E ':' OU ');
    if(r.tipo==='condicao')return `${target}: ${name('condicoes',r.condicaoId)}`;
    if(r.tipo==='zona')return `${target} em ${name('zonas',r.zonaId)}`;
    if(r.tipo==='contagem')return `${name('tags',r.tagId)} em ${name('zonas',r.zonaId)} ${r.comparador} ${r.quantidade}`;
    if(r.tipo==='recurso'&&!r.comparador)return `Gastar ${r.quantidade} ${name('recursos',r.recursoId)}`;
    if(r.tipo==='condicionado')return `Se ${describe(r.requisito)}: ${(r.entao||[]).map(describe).join('; ')||'sem custo'}; caso contrário: ${(r.senao||[]).map(describe).join('; ')||'sem custo'}`;
    if(r.tipo==='recurso')return `${name('recursos',r.recursoId)} ${r.comparador} ${r.quantidade}`;
    if(r.tipo==='carta')return `Gastar ${r.quantidade} × ${r.cartaId}`;
    if(r.tipo==='alternativa')return `Pagar uma alternativa: ${(r.alternativas||[]).map(describe).join(' OU ')}`;
    if(r.tipo==='recurso'&&!r.comparador)return `Gastar ${r.quantidade} ${name('recursos',r.recursoId)}`;
    if(r.acao==='mover')return `Mover ${target} para ${name('zonas',r.zonaId)}`;
    if(r.acao==='alterar')return `${name('recursos',r.recursoId)}: ${r.quantidade>=0?'+':''}${r.quantidade}`;
    if(r.acao==='aplicar'||r.acao==='remover')return `${r.acao}: ${name('condicoes',r.condicaoId)} em ${target}`;
    if(r.acao==='revelar')return `Revelar verso: ${target}`;
    if(r.acao==='ramificar')return `Se ${describe(r.requisito)}: ${(r.entao||[]).map(describe).join('; ')}. Caso contrário: ${(r.senao||[]).map(describe).join('; ')}`;
    return r.texto||r.acao||'';
  }
  function content(card,face){
    const c=face==='verso'?card.verso||{}:card;
    let html=`<p>${esc(c.descricao||'Sem descrição.')}</p>`;
    for(const s of c.secoes||[])html+=`<h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p>`;
    for(const r of c.resolucoes||[])html+=`<section class="resolution"><h3>${esc(r.titulo||r.id)} <small class="resolution-code">${esc(r.id)}</small></h3>${r.texto?`<p>${esc(r.texto)}</p>`:''}${r.custos?.length?`<p><b>Pagamento:</b> ${esc(r.custos.map(describe).join('; '))}</p>`:''}<p><b>Resolver:</b> ${esc((r.efeitos||[]).map(describe).join('; '))}</p></section>`;
    if(face!=='verso'){
      for(const o of card.opcoes||[]){
        const requirement=CardModel.publicRequirements(card,o,activeDecks);
        html+=`<section><h3>${esc(o.rotulo)}${o.resolucao?` <small class="resolution-code">${esc(o.resolucao.resolucaoId)}${o.resolucao.cartaId?` · ${esc(o.resolucao.cartaId)}`:''}</small>`:''}</h3>${o.texto?`<p>${esc(o.texto)}</p>`:''}${requirement?`<p><b>Requer:</b> ${esc(describe(requirement))}</p>`:''}`;
        if(!o.resolucao)html+=`${o.custos?.length?`<p><b>Custo:</b> ${esc(o.custos.map(describe).join('; '))}</p>`:''}${o.efeitos?.length?`<p><b>Efeitos:</b> ${esc(o.efeitos.map(describe).join('; '))}</p>`:''}`;
        html+='</section>';
      }
      for(const r of card.condicoes||[])html+=`<h3>${esc(catalog('condicoes').find(x=>x.id===r.condicaoId)?.nome||r.condicaoId)}</h3><p>${esc((r.efeitos||[]).map(describe).join('; '))}</p>`;
      for(const r of card.regras||[])html+=`<h3>${esc(r.evento==='manual'?'Uso manual':'Ao '+r.evento)}</h3><p>${esc(r.texto||'')}</p>${r.requisitos?`<p>Requer: ${esc(describe(r.requisitos))}</p>`:''}<p>${esc((r.efeitos||[]).map(describe).join('; '))}</p>`;
    }
    return html;
  }
  return {mount,describe,content};
})();
