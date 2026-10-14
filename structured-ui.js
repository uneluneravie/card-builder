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
  const face=previewFace==='verso'?card.verso||{}:card;
  const image=face.imagem||(previewFace==='verso'?previewDeckDraft.imagemVerso:'');
  const {width,height}=cardDimensions(previewDeckDraft);
  const preview=$('#tcgCardPreview');preview.style.aspectRatio=`${width}/${height}`;
  preview.innerHTML=`<div class="tcg-frame structured-frame"><header>${escapeHtml(face.titulo||card.titulo)}${previewFace==='verso'?' — Verso':''}</header>${image?`<div class="tcg-art" style="background-image:url('${escapeHtml(image)}')"></div>`:''}<div class="tcg-description">${CardEditor.content(card,previewFace)}</div><footer><span>${escapeHtml(card.id||'')}</span><small>${escapeHtml(previewDeckDraft.nome)}</small></footer></div>`;
  if(previewDeckDraft.imagemFrame)preview.firstElementChild.style.backgroundImage=`url("${previewDeckDraft.imagemFrame.replaceAll('"','%22')}")`;
  $('#previewFront').setAttribute('aria-pressed',String(previewFace==='frente'));
  $('#previewBack').setAttribute('aria-pressed',String(previewFace==='verso'));
  requestAnimationFrame(updatePreviewOverflow);
}
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

function updatePreviewOverflow() { const text=$('#tcgCardPreview .tcg-description'); if(!text)return; $('#cardOverflowWarning').textContent=text.scrollHeight>text.clientHeight+2?'O conteúdo excede o espaço da carta. Revise o texto ou aumente suas dimensões. Role o preview para ler tudo.':''; }
new ResizeObserver(updatePreviewOverflow).observe($('#tcgCardPreview'));
