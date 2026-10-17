let getStructuredCard = () => ({});
let previewCardDraft = null;
let previewDeckDraft = null;
let previewFace = 'frente';
function withoutStructuredFields(card) { const result={...card}; for(const key of ['id','tags','secoes','verso','resolucoes','opcoes','condicoes','regras'])delete result[key]; return result; }
function structuredCardData() { return getStructuredCard(); }
function projectPayload() {
  const {path,local,...rest}=activeProject;
  return {...rest,baralhos:[...activeDeckFiles],diario:typeof rest.diario==='string'?rest.diario:'diario/paginas.json'};
}
function openStructuredCardEditor(deck,card) {
  const structured={};
  for(const key of ['id','tags','secoes','verso','resolucoes','opcoes','condicoes','regras'])if(card[key]!==undefined)structured[key]=CardModel.clone(card[key]);
  // Cartas antigas recebem ID estável apenas quando forem salvas.
  structured.id ||= `carta-${crypto.randomUUID()}`;
  previewCardDraft={...card,...structured};previewDeckDraft=deck;previewFace='frente';
  $('#cardValidation').textContent='';
  getStructuredCard=CardEditor.mount($('#structuredCardEditor'),structured,'carta',next=>{previewCardDraft={...withoutStructuredFields(card),...next};renderStructuredPreview();});
  renderStructuredPreview();
}
function renderStructuredPreview() {
  if(!previewCardDraft)return;
  const form=$('#cardForm');
  const card={...previewCardDraft,titulo:form.elements.title.value,descricao:form.elements.description.value};
  const {width,height}=cardDimensions(previewDeckDraft);
  const preview=$('#tcgCardPreview');preview.style.aspectRatio=`${width}/${height}`;
  // CSS pixels at 100% zoom: one inch is 96 px and 25.4 mm.
  const actualSize=$('#previewActualSize').checked;
  preview.classList.toggle('actual-size',actualSize);
  preview.style.width=actualSize?`${width*96/25.4}px`:'';
  preview.style.height=actualSize?`${height*96/25.4}px`:'';
  fillCardPreview(preview,previewDeckDraft,card,previewFace);
  $('#previewFront').setAttribute('aria-pressed',String(previewFace==='frente'));
  $('#previewBack').setAttribute('aria-pressed',String(previewFace==='verso'));
  requestAnimationFrame(updatePreviewOverflow);
}
$('#previewActualSize').onchange=renderStructuredPreview;
$('#previewFront').onclick=()=>{previewFace='frente';renderStructuredPreview();};
$('#previewBack').onclick=()=>{previewFace='verso';renderStructuredPreview();};
$('#cardForm').elements.title.addEventListener('input',renderStructuredPreview);
$('#cardForm').elements.description.addEventListener('input',renderStructuredPreview);
let getDefinitions=()=>({});
$('#editDefinitions').onclick=()=>{
  const draft=CardModel.clone(activeProject.definicoes||{condicoes:[],recursos:[],tags:[],zonas:[]});
  $('#definitionsValidation').textContent='';
  getDefinitions=CardEditor.mount($('#definitionsEditor'),draft,'definicoes',()=>{},draft);
  $('#definitionsDialog').showModal();
  $('#definitionsDialog').scrollTop=0;
};
$('#definitionsForm').onsubmit=event=>{
  event.preventDefault();
  const definitions=getDefinitions();
  const errors=CardModel.validate({...activeProject,definicoes:definitions},activeDecks);
  if(errors.length){$('#definitionsValidation').textContent=errors.join('\n');return;}
  activeProject.definicoes=definitions;
  activeProject.versaoFormato=2;
  const stored=readLocalJson('card-builder-definitions',{});stored[activeProject.path]=definitions;
  localStorage.setItem('card-builder-definitions',JSON.stringify(stored));
  if(activeProject.local){localStorage.setItem('card-builder-projects',JSON.stringify(readLocalJson('card-builder-projects',[]).map(p=>p.path===activeProject.path?activeProject:p)));}
  queueGithubFile(`projetos/${activeProject.path}/projeto.json`,projectPayload());
  syncCompletedSave();$('#definitionsDialog').close();showToast('Definições salvas','Condições, recursos, tags e zonas atualizados.');
};

function updatePreviewOverflow() { const preview=$('#tcgCardPreview'); if(!preview)return; $('#cardOverflowWarning').textContent=hasCardOverflow(preview)?'O conteúdo excede o espaço da carta. Revise o texto ou aumente suas dimensões. Role o preview para ler tudo.':''; }
new ResizeObserver(updatePreviewOverflow).observe($('#tcgCardPreview'));

// Both the visible preview and background measurements use the same markup.
function fillCardPreview(preview,deck,card,faceName) {
  const face=faceName==='verso'?card.verso||{}:card;
  const image=face.imagem||(faceName==='verso'?deck.imagemVerso:'');
  preview.innerHTML=`<div class="tcg-frame structured-frame"><header>${escapeHtml(face.titulo||card.titulo)}${faceName==='verso'?' — Verso':''}</header>${image?`<div class="tcg-art" style="background-image:url('${escapeHtml(image)}')"></div>`:''}<div class="tcg-description">${CardEditor.content(card,faceName)}</div><footer><span>${escapeHtml(card.id||'')}</span><small>${escapeHtml(deck.nome)}</small></footer></div>`;
  if(deck.imagemFrame)preview.firstElementChild.style.backgroundImage=`url("${deck.imagemFrame.replaceAll('"','%22')}")`;
}
function hasCardOverflow(preview) {
  return [...preview.querySelectorAll('header,.tcg-description,footer')].some(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2);
}
const cardOverflowResults=new WeakMap();
let overflowScanVersion=0;
function updateCardOverflowBadges() {
  const deck=activeDecks[viewingDeckIndex];
  if(!deck)return;
  for(const button of document.querySelectorAll('[data-card-index]')) {
    button.querySelector('.card-overflow-badge')?.remove();
    const result=cardOverflowResults.get(deck)?.[Number(button.dataset.cardIndex)];
    if(!result?.length)continue;
    const badge=document.createElement('span');
    badge.className='card-overflow-badge';
    badge.textContent='⚠ Texto excedente';
    const label=`Texto excede o espaço da carta: ${result.join(' e ')} (tamanho real)`;
    badge.title=label;badge.setAttribute('aria-label',label);
    button.querySelector('.collection-card-copy').append(badge);
  }
}
async function scheduleCardOverflowScan() {
  const version=++overflowScanVersion;
  await document.fonts.ready;
  const decks=[...activeDecks];
  const host=document.createElement('div');
  host.className='card-measure-host';host.setAttribute('aria-hidden','true');host.inert=true;
  const preview=document.createElement('div');preview.className='tcg-card actual-size';host.append(preview);document.body.append(host);
  const idle=()=>new Promise(resolve=>window.requestIdleCallback?requestIdleCallback(resolve,{timeout:150}):setTimeout(resolve,0));
  try {
    for(const deck of decks) {
      const results=[];cardOverflowResults.set(deck,results);
      const {width,height}=cardDimensions(deck);
      preview.style.width=`${width*96/25.4}px`;preview.style.height=`${height*96/25.4}px`;
      const cards=deckCards(deck);
      for(let i=0;i<cards.length;i++) {
        await idle();
        if(version!==overflowScanVersion)return;
        const faces=[];
        for(const face of cards[i].verso?['frente','verso']:['frente']) {
          fillCardPreview(preview,deck,cards[i],face);
          if(hasCardOverflow(preview))faces.push(face);
        }
        results[i]=faces;updateCardOverflowBadges();
      }
    }
  } finally {host.remove();}
}
window.addEventListener('resize',scheduleCardOverflowScan);
