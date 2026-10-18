/* Tokens usam o mesmo ciclo de persistência dos baralhos, sem conteúdo textual. */
function isTokenDeck(deck) { return deck?.componente === 'tokens'; }
function tokenDimensions(deck) {
  const width = deck.token.larguraCm * 10;
  return {width, height: (deck.token.formato === 'retangular' ? deck.token.alturaCm * 10 : width)};
}
function tokenSizeLabel(deck) {
  const t=deck.token;
  return t.formato === 'redondo' ? `Redondo · Ø ${t.larguraCm} cm` : `${{quadrado:'Quadrado',retangular:'Retangular',hexagonal:'Hexagonal'}[t.formato]} · ${t.larguraCm} × ${t.formato==='retangular'?t.alturaCm:t.larguraCm} cm`;
}
function configureTokenFields(deck) {
  const form=$('#deckForm'),tokens=isTokenDeck(deck),t=deck.token||{};
  form.dataset.component=tokens?'tokens':'baralho';
  form.querySelectorAll('[data-card-setting]').forEach(label=>{
    label.hidden=tokens;
    label.querySelectorAll('input,select').forEach(input=>input.disabled=tokens);
  });
  $('#tokenSettings').hidden=!tokens;
  $('#tokenSettings').disabled=!tokens;
  form.elements.tokenShape.value=t.formato||'redondo';
  form.elements.tokenWidth.value=t.larguraCm||3;
  form.elements.tokenHeight.value=t.alturaCm||3;
  form.elements.tokenMargin.checked=Boolean(t.margem);
  form.elements.tokenMarginColor.value=t.corMargem||'#e8d9bc';
  if(tokens) {
    $('#deckDialogTitle').textContent=editingDeckIndex===null?'Criar conjunto de tokens':'Editar conjunto de tokens';
    $('#deckDialogIntro').textContent='Defina o formato e as medidas do conjunto. Depois, adicione uma imagem a cada token.';
    $('#saveDeck').textContent=editingDeckIndex===null?'Criar tokens':'Salvar alterações';
    if(editingDeckIndex===null)form.elements.quantity.value=1;
  }
  $('#quantityLabel').textContent=tokens?'Quantidade de tokens':'Quantidade de cartas';
  $('#openDeckPage').textContent=tokens?'Ver tokens do conjunto':'Ver cartas do baralho';
  updateTokenFields();
}
function updateTokenFields() {
  const form=$('#deckForm'),shape=form.elements.tokenShape.value,rect=shape==='retangular';
  $('#tokenHeightField').hidden=!rect;
  form.elements.tokenHeight.disabled=!rect||form.dataset.component!=='tokens';
  form.elements.tokenWidth.required=form.dataset.component==='tokens';
  form.elements.tokenHeight.required=rect&&form.dataset.component==='tokens';
  $('#tokenWidthLabel').textContent=shape==='redondo'?'Diâmetro (cm)':'Largura (cm)';
  form.elements.tokenMarginColor.disabled=!form.elements.tokenMargin.checked;
}
function tokenSettingsFromForm(form) {
  return {componente:'tokens',token:{formato:form.elements.tokenShape.value,larguraCm:Number(form.elements.tokenWidth.value),alturaCm:Number(form.elements.tokenHeight.value),margem:form.elements.tokenMargin.checked,corMargem:form.elements.tokenMarginColor.value}};
}
function createTokenVisual(deck,token) {
  const outer=document.createElement('div');
  outer.className=`token-visual token-${deck.token.formato}`;
  const {width,height}=tokenDimensions(deck);
  outer.style.aspectRatio=`${width} / ${height}`;
  outer.style.backgroundColor=deck.token.margem?deck.token.corMargem:'transparent';
  const image=document.createElement('div');image.className='token-image';
  image.style.inset=deck.token.margem?'5%':'0';
  if(token.imagem)image.style.backgroundImage=`url(${JSON.stringify(token.imagem)})`;
  outer.append(image);
  return outer;
}
function tokenCollectionCard(deck,index) {
  const ready=deckCards(deck).filter(t=>t.imagem).length;
  return `<article class="deck-card token-deck-card" data-name="${escapeHtml(deck.nome)}" data-deck-index="${index}" tabindex="0" role="button" aria-label="Editar conjunto de tokens ${escapeHtml(deck.nome)}"><div class="deck-preview token-deck-preview"><span aria-hidden="true">◉</span><strong>TOKENS</strong></div><div class="deck-body"><div class="deck-title"><h3>${escapeHtml(deck.nome)}</h3></div><p>${ready} de ${deck.quantidade} tokens com imagem</p><div class="deck-meta"><span>${escapeHtml(tokenSizeLabel(deck))}</span><span>${deck.token.margem?'Com margem':'Sem margem'}</span></div></div></article>`;
}
function renderTokenCollection(deck) {
  $('#deckPageCount').textContent=`${deck.quantidade} ${deck.quantidade===1?'token':'tokens'}`;
  const cards=deckCards(deck);
  document.querySelectorAll('[data-card-index]').forEach(button=>{
    const index=Number(button.dataset.cardIndex);
    const art=button.querySelector('.collection-card-art');
    art.removeAttribute('style');art.classList.add('token-collection-art');
    const visual=createTokenVisual(deck,cards[index]),{width,height}=tokenDimensions(deck);
    visual.style.width=`${Math.min(150,150*width/height)}px`;art.replaceChildren(visual);
    button.querySelector('.collection-card-copy').innerHTML=`<small>TOKEN ${String(index+1).padStart(2,'0')}</small><strong>${cards[index].imagem?'Imagem adicionada':'Adicionar imagem'}</strong>`;
    const group=button.parentElement.querySelector('.card-order-actions');
    group.setAttribute('aria-label',`Posição do token ${index+1}`);
    group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-label',b.getAttribute('aria-label').replace('carta','token')));
  });
}
let tokenEditingIndex=null,tokenDraftImage='';
function openTokenEditor(deck,index) {
  tokenEditingIndex=index;tokenDraftImage=deckCards(deck)[index].imagem||'';
  $('#tokenForm').reset();
  $('#tokenDialogTitle').textContent=`Editar token ${index+1}`;
  $('#tokenImageHint').textContent=tokenDraftImage?'A imagem atual será mantida se nenhum arquivo for escolhido.':'Escolha uma imagem. O token não contém texto.';
  $('#tokenPreview').replaceChildren(createTokenVisual(deck,{imagem:tokenDraftImage}));
  $('#tokenDialog').showModal();
}
document.addEventListener('DOMContentLoaded',()=>{
  $('#newTokenButton').addEventListener('click',()=>openDeckDialog(null,'tokens'));
  $('#deckForm').elements.tokenShape.addEventListener('change',updateTokenFields);
  $('#deckForm').elements.tokenMargin.addEventListener('change',updateTokenFields);
  $('#tokenForm').elements.image.addEventListener('change',async event=>{
    const file=event.target.files[0];
    if(file)tokenDraftImage=await fileToDataUrl(file);
    $('#tokenPreview').replaceChildren(createTokenVisual(activeDecks[viewingDeckIndex],{imagem:tokenDraftImage}));
  });
  $('#tokenForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const deck=activeDecks[viewingDeckIndex],file=event.currentTarget.elements.image.files[0];
    if(!isTokenDeck(deck)||tokenEditingIndex===null)return;
    const cards=deckCards(deck);
    cards[tokenEditingIndex]={...cards[tokenEditingIndex],imagem:file?await fileToDataUrl(file):cards[tokenEditingIndex].imagem};
    deck.cartas=cards;deck.cartasProntas=cards.filter(t=>t.imagem).length;
    const stored=readLocalJson('card-builder-decks',{}),saved=Array.isArray(stored)?{}:stored;
    saved[activeProject.path]=activeDecks;
    localStorage.setItem('card-builder-decks',JSON.stringify(saved));
    if(activeProject.local){activeProject.baralhos=activeDecks;localStorage.setItem('card-builder-projects',JSON.stringify(readLocalJson('card-builder-projects',[]).map(p=>p.path===activeProject.path?activeProject:p)));}
    queueGithubFile(deckGithubPath(viewingDeckIndex),deck);syncCompletedSave();
    $('#tokenDialog').close();renderDecks(activeDecks);openDeckPage(viewingDeckIndex);
    showToast('Token salvo','Imagem salva localmente e adicionada à fila do GitHub.');
  });
});
