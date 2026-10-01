const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const projectSwitcher = $('#projectSwitcher');
const projectMenu = $('#projectMenu');
const deckDialog = $('#deckDialog');
const noteDialog = $('#noteDialog');
const projectDialog = $('#projectDialog');
const deleteProjectDialog = $('#deleteProjectDialog');
const githubDialog = $('#githubDialog');
const cardPreviewDialog = $('#cardPreviewDialog');
const toast = $('#toast');
let projects = [];
let activeProject = null;
let diaryEntries = [];
let editingDiaryIndex = null;
let activeDecks = [];
let editingDeckIndex = null;
let viewingDeckIndex = null;
let editingCardIndex = null;
let activeDeckFiles = [];
let githubConnection = null;
let syncInterval = null;
let nextSyncAt = null;
let syncInProgress = false;
let lastSyncError = '';
let lastSyncedAt = '';
const pendingGithubFiles = new Map();
const SYNC_SECONDS = 60;
const DATA_RESET_VERSION = '2026-10-01';

function resetLegacyProjectsOnce() {
  if (localStorage.getItem('card-builder-reset-version') === DATA_RESET_VERSION) return;
  ['card-builder-projects', 'card-builder-deleted-projects', 'card-builder-decks', 'card-builder-notes']
    .forEach((key) => localStorage.removeItem(key));
  localStorage.setItem('card-builder-reset-version', DATA_RESET_VERSION);
}

function githubHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubConnection.token}`
  };
}

function syncApiUrl(path) {
  const [owner, repository] = githubConnection.repository.split('/');
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function restartSyncTimer() {
  clearInterval(syncInterval);
  if (!githubConnection) {
    nextSyncAt = null;
    updateSyncStatus('local');
    return;
  }
  nextSyncAt = Date.now() + SYNC_SECONDS * 1000;
  updateSyncCountdown();
  syncInterval = setInterval(() => {
    updateSyncCountdown();
    if (Date.now() >= nextSyncAt) void syncWithGithub();
  }, 1000);
}

function updateSyncStatus(state, detail = '') {
  const status = $('#saveStatus');
  status.className = `save-status${state === 'local' || state === 'connected' ? '' : ` ${state}`}`;
  const copy = {
    local: ['Rascunhos salvos localmente', 'Conecte o GitHub para ativar o autosave.'],
    connected: ['Autosave do GitHub ativo', detail],
    syncing: ['Sincronizando com o GitHub…', detail || 'Enviando alterações pendentes.'],
    'sync-error': ['Falha no autosave', detail]
  }[state];
  status.querySelector('strong').textContent = copy[0];
  $('#syncCountdown').textContent = copy[1];
}

function updateSyncCountdown() {
  if (!githubConnection || !nextSyncAt || syncInProgress) return;
  const seconds = Math.max(0, Math.ceil((nextSyncAt - Date.now()) / 1000));
  if (lastSyncError) {
    updateSyncStatus('sync-error', `${lastSyncError} Nova tentativa em ${seconds}s.`);
    return;
  }
  const pending = pendingGithubFiles.size
    ? `${pendingGithubFiles.size} ${pendingGithubFiles.size === 1 ? 'arquivo pendente' : 'arquivos pendentes'} · `
    : '';
  const lastSync = lastSyncedAt ? `Último envio às ${lastSyncedAt} · ` : '';
  updateSyncStatus('connected', `${pending}${lastSync}próxima verificação em ${seconds}s.`);
}

async function syncWithGithub() {
  if (!githubConnection || syncInProgress) return;
  if (!pendingGithubFiles.size) {
    restartSyncTimer();
    return;
  }

  syncInProgress = true;
  lastSyncError = '';
  const filesToSync = [...pendingGithubFiles.entries()];
  $('#githubButton').classList.add('syncing');
  updateSyncStatus('syncing');
  try {
    for (const [path, data] of filesToSync) {
      const fileResponse = await fetch(syncApiUrl(path), { headers: githubHeaders() });
      if (!fileResponse.ok && fileResponse.status !== 404) throw new Error(`Não foi possível consultar ${path} (${fileResponse.status}).`);
      const existingFile = fileResponse.ok ? await fileResponse.json() : null;
      const json = `${JSON.stringify(data, null, 2)}\n`;
      const content = btoa(unescape(encodeURIComponent(json)));
      const response = await fetch(syncApiUrl(path), {
        method: 'PUT',
        headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `chore: atualizar ${path}`, content, ...(existingFile?.sha ? { sha: existingFile.sha } : {}) })
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details.message || `O GitHub recusou a atualização de ${path} (${response.status}).`);
      }
      if (pendingGithubFiles.get(path) === data) pendingGithubFiles.delete(path);
    }
    lastSyncedAt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    showToast('GitHub sincronizado', `${filesToSync.length} ${filesToSync.length === 1 ? 'arquivo JSON atualizado' : 'arquivos JSON atualizados'}.`);
  } catch (error) {
    const message = error instanceof TypeError ? 'Sem acesso ao GitHub. Tentaremos novamente.' : error.message;
    lastSyncError = message;
    updateSyncStatus('sync-error', message);
    showToast('Falha no sync', message);
  } finally {
    $('#githubButton').classList.remove('syncing');
    syncInProgress = false;
    restartSyncTimer();
  }
}

function queueGithubFile(path, data) {
  pendingGithubFiles.set(path, JSON.parse(JSON.stringify(data)));
  if (githubConnection) updateSyncCountdown();
  else updateSyncStatus('local', 'Alteração salva neste navegador; conecte o GitHub para enviá-la.');
}

function syncCompletedSave() {
  if (githubConnection) void syncWithGithub();
}

projectSwitcher.addEventListener('click', () => {
  const willOpen = projectMenu.hidden;
  projectMenu.hidden = !willOpen;
  projectSwitcher.setAttribute('aria-expanded', String(willOpen));
});

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[character]));

async function loadProjects() {
  try {
    const index = githubConnection
      ? await loadGithubJson('projetos/index.json', { projetos: [] })
      : await loadJson('projetos/index.json');
    const fileProjects = await Promise.all(index.projetos.map(async (path) => {
      const project = githubConnection
        ? await loadGithubJson(`projetos/${path}/projeto.json`)
        : await loadJson(`projetos/${path}/projeto.json`);
      return { ...project, path };
    }));
    projects = fileProjects;
    renderProjects();
    renderProjectMenu();
  } catch (error) {
    $('#projectGrid').innerHTML = `<p class="error-state">${escapeHtml(error.message)} Execute a aplicação por meio de um servidor local.</p>`;
    if (githubConnection) throw error;
  }
}

async function loadGithubJson(path, notFoundFallback) {
  const response = await fetch(syncApiUrl(path), { headers: githubHeaders() });
  if (response.status === 404 && arguments.length > 1) return notFoundFallback;
  if (!response.ok) throw new Error(`Não foi possível carregar ${path} do GitHub (${response.status}).`);
  const file = await response.json();
  if (!file.content) throw new Error(`${path} não é um arquivo JSON válido no GitHub.`);
  try {
    const decoded = decodeURIComponent(escape(atob(file.content.replace(/\s/g, ''))));
    return JSON.parse(decoded);
  } catch {
    throw new Error(`O conteúdo de ${path} não é um JSON válido.`);
  }
}

function discardLocalProjectChanges() {
  ['card-builder-projects', 'card-builder-deleted-projects', 'card-builder-decks', 'card-builder-notes']
    .forEach((key) => localStorage.removeItem(key));
  pendingGithubFiles.clear();
}

function renderProjects() {
  $('#projectGrid').innerHTML = projects.length ? projects.map((project) => `
    <button class="project-card" data-project-path="${escapeHtml(project.path)}">
      <span class="project-card-art" ${project.imagem ? `style="background-image:url('${escapeHtml(project.imagem)}')"` : ''} aria-hidden="true">${project.imagem ? '' : escapeHtml(project.sigla)}</span>
      <span class="project-card-copy"><small>PROJETO</small><strong>${escapeHtml(project.nome)}</strong><span>${escapeHtml(project.descricao)}</span></span>
      <span class="project-card-arrow" aria-hidden="true">→</span>
    </button>`).join('') : '<p class="loading-state">Nenhum projeto por aqui. Crie o primeiro para começar.</p>';
  $$('[data-project-path]').forEach((button) => button.addEventListener('click', () => openProject(button.dataset.projectPath)));
}

function renderProjectMenu() {
  projectMenu.innerHTML = `${projects.map((project) => `<button data-menu-project="${escapeHtml(project.path)}">${escapeHtml(project.nome)}</button>`).join('')}<button id="newProjectFromMenu">＋ Criar projeto</button>`;
  $$('[data-menu-project]').forEach((button) => button.addEventListener('click', () => openProject(button.dataset.menuProject)));
  $('#newProjectFromMenu').addEventListener('click', () => {
    projectMenu.hidden = true;
    projectSwitcher.setAttribute('aria-expanded', 'false');
    projectDialog.showModal();
  });
}

async function openProject(path) {
  const project = projects.find((item) => item.path === path);
  if (!project) return;
  activeProject = project;
  projectMenu.hidden = true;
  projectSwitcher.setAttribute('aria-expanded', 'false');
  $('.project-switcher-copy strong').textContent = project.nome;
  $('.project-thumb').textContent = project.sigla;
  $('#homeWelcome').hidden = true;
  $('#projectsSection').hidden = true;
  $('#projectPage').hidden = false;
  $('#projectPageTitle').textContent = project.nome;
  $('#heroProjectName').textContent = project.nome;
  $('#heroProjectDescription').textContent = project.descricao;
  $('#diaryCount').textContent = '0';
  $('#deckGrid').innerHTML = '<p class="loading-state">Carregando baralhos…</p>';
  $('[data-view="diario"]').href = `#projeto/${path}/diario`;
  $('[data-view="baralhos"]').href = `#projeto/${path}/baralhos`;

  try {
    const decks = project.local ? project.baralhos : await Promise.all(project.baralhos.map((file) => (
      githubConnection
        ? loadGithubJson(`projetos/${path}/baralhos/${file}`)
        : loadJson(`projetos/${path}/baralhos/${file}`)
    )));
    activeDeckFiles = project.local
      ? decks.map((deck, index) => deck.arquivo || `${slugify(deck.nome || `baralho-${index + 1}`)}.json`)
      : [...project.baralhos];
    const diary = project.local
      ? project.diario
      : githubConnection
        ? await loadGithubJson(`projetos/${path}/${project.diario}`)
        : await loadJson(`projetos/${path}/${project.diario}`);
    const storedDecks = readLocalJson('card-builder-decks', {});
    const savedDecks = Array.isArray(storedDecks) ? {} : storedDecks;
    activeDecks = savedDecks[path] || decks;
    activeDecks.slice(activeDeckFiles.length).forEach((deck, extraIndex) => {
      const usedFiles = new Set(activeDeckFiles);
      const base = slugify(deck.nome || `baralho-${activeDeckFiles.length + extraIndex + 1}`);
      let file = `${base}.json`;
      let suffix = 2;
      while (usedFiles.has(file)) file = `${base}-${suffix++}.json`;
      activeDeckFiles.push(file);
    });
    renderDecks(activeDecks);
    const savedDiaryEntries = readLocalJson('card-builder-notes', [])
      .filter((note) => note.project === path && Number.isInteger(note.index));
    diaryEntries = diary.map((entry, index) => savedDiaryEntries.find((note) => note.index === index)?.entry || entry);
    savedDiaryEntries
      .filter((note) => note.index >= diaryEntries.length)
      .sort((a, b) => a.index - b.index)
      .forEach((note) => diaryEntries.push(note.entry));
    renderDiary();
    $('#deckCount').textContent = activeDecks.length;
    $('#cardCount').textContent = activeDecks.reduce((total, deck) => total + deck.quantidade, 0);
    $('#diaryCount').textContent = diaryEntries.length;
    $('#navDeckCount').textContent = activeDecks.length;
    $('#navDiaryCount').textContent = diaryEntries.length;
    updateProjectUrl('visao');
    showToast('Projeto carregado', `${project.nome} está pronto para editar.`);
  } catch (error) {
    $('#deckGrid').innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`;
  }
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Não foi possível abrir ${path}.`);
  return response.json();
}

function readLocalJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function renderDiary() {
  $('#noteList').innerHTML = diaryEntries.length ? diaryEntries.map((entry, index) => `
    <button type="button" data-diary-index="${index}" aria-label="Editar ${escapeHtml(entry.titulo)}"><span class="note-icon ${['', 'peach', 'teal-bg'][index]}">▤</span><span><strong>${escapeHtml(entry.titulo)}</strong><small>${escapeHtml(entry.resumo)}</small></span><time>${escapeHtml(entry.data)}<br><b>${escapeHtml(entry.hora)}</b></time></button>
  `).join('') : '<p class="empty-state">O diário ainda não tem páginas.</p>';
  $$('[data-diary-index]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.diaryIndex);
    const entry = diaryEntries[index];
    editingDiaryIndex = index;
    $('#noteDialogTitle').textContent = 'Editar página';
    $('#saveNote').textContent = 'Salvar alterações';
    $('#noteForm').elements.title.value = entry.titulo;
    $('#noteForm').elements.content.value = entry.conteudo || entry.resumo || '';
    noteDialog.showModal();
  }));
}

function renderDecks(decks) {
  const cards = decks.map((deck, index) => {
    const progress = Math.round((deck.cartasProntas / deck.quantidade) * 100);
    const theme = ['heroes', 'relics', 'lands'][index % 3];
    const progressClass = index % 3 === 1 ? 'amber' : index % 3 === 2 ? 'teal' : '';
    return `<article class="deck-card" data-name="${escapeHtml(deck.nome)}" data-deck-index="${index}" tabindex="0" role="button" aria-label="Editar baralho ${escapeHtml(deck.nome)}">
      <div class="deck-preview ${theme}"><span class="card-back back-one">${escapeHtml(deck.simbolo || '✦')}</span><span class="card-back back-two">${escapeHtml(deck.simbolo || '◆')}</span></div>
      <div class="deck-body"><div class="deck-title"><h3>${escapeHtml(deck.nome)}</h3></div><p>${escapeHtml(deck.descricao)}</p><div class="progress-label"><span>${deck.cartasProntas} de ${deck.quantidade} cartas</span><strong>${progress}%</strong></div><div class="progress ${progressClass}"><span style="width:${progress}%"></span></div><div class="deck-meta"><span>◫ ${escapeHtml(deckSizeLabel(deck))}</span><span>◉ ${escapeHtml(deck.espessura)}</span></div></div>
    </article>`;
  }).join('');
  $('#deckGrid').innerHTML = `${cards}<button class="add-deck-card" id="addDeckCard"><span>＋</span><strong>Criar novo baralho</strong><small>Defina formato, materiais e comece a criar.</small></button>`;
  $$('[data-deck-index]').forEach((card) => {
    const edit = () => openDeckDialog(Number(card.dataset.deckIndex));
    card.addEventListener('click', edit);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        edit();
      }
    });
  });
  $('#addDeckCard').addEventListener('click', () => openDeckDialog());
}

function deckSizeLabel(deck) {
  if (deck.tamanho !== 'Personalizado' || !deck.tamanhoPersonalizado) return deck.tamanho;
  return `${deck.tamanhoPersonalizado.largura} × ${deck.tamanhoPersonalizado.altura} mm`;
}

function openDeckDialog(index = null) {
  editingDeckIndex = index;
  const form = $('#deckForm');
  form.reset();
  const isEditing = index !== null;
  $('#deckDialogTitle').textContent = isEditing ? 'Editar baralho' : 'Criar baralho';
  $('#deckDialogIntro').textContent = isEditing ? 'Atualize os dados do baralho selecionado.' : 'Comece pelos dados de produção. Você poderá adicionar e compor as cartas em seguida.';
  $('#saveDeck').textContent = isEditing ? 'Salvar alterações' : 'Criar baralho';
  $('#openDeckPage').hidden = !isEditing;
  if (isEditing) {
    const deck = activeDecks[index];
    form.elements.name.value = deck.nome;
    form.elements.quantity.value = deck.quantidade;
    setSelectValue(form.elements.size, deck.tamanho);
    form.elements.customWidth.value = deck.tamanhoPersonalizado?.largura || '';
    form.elements.customHeight.value = deck.tamanhoPersonalizado?.altura || '';
    setSelectValue(form.elements.material, deck.material);
    setSelectValue(form.elements.weight, deck.espessura);
  }
  updateCustomCardSizeFields();
  deckDialog.showModal();
}

function deckCards(deck) {
  return Array.from({ length: deck.quantidade }, (_, index) => deck.cartas?.[index] || {
    titulo: `Carta ${index + 1}`,
    descricao: 'Esta carta ainda não possui conteúdo.',
    imagem: ''
  });
}

function cardDimensions(deck) {
  if (deck.tamanho === 'Personalizado' && deck.tamanhoPersonalizado) {
    const width = Number(deck.tamanhoPersonalizado.largura);
    const height = Number(deck.tamanhoPersonalizado.altura);
    if (width > 0 && height > 0) return { width, height };
  }
  const dimensions = String(deck.tamanho || '').match(/([\d.,]+)\s*[×x]\s*([\d.,]+)/i);
  if (!dimensions) return { width: 63, height: 88 };
  return {
    width: Number(dimensions[1].replace(',', '.')),
    height: Number(dimensions[2].replace(',', '.'))
  };
}

function updateCustomCardSizeFields() {
  const form = $('#deckForm');
  const isCustom = form.elements.size.value === 'Personalizado';
  $('#customCardSize').hidden = !isCustom;
  form.elements.customWidth.required = isCustom;
  form.elements.customHeight.required = isCustom;
}

function openDeckPage(index) {
  viewingDeckIndex = index;
  const deck = activeDecks[index];
  if (!deck) return;
  deckDialog.close();
  $('#projectPage').hidden = true;
  $('#deckPage').hidden = false;
  $('#deckPageTitle').textContent = deck.nome;
  $('#deckPageDescription').textContent = deck.descricao || 'Todas as cartas deste baralho.';
  $('#deckPageCount').textContent = `${deck.quantidade} ${deck.quantidade === 1 ? 'carta' : 'cartas'}`;
  $('#cardsGrid').innerHTML = deckCards(deck).map((card, cardIndex) => `
    <button type="button" class="collection-card" data-card-index="${cardIndex}">
      <span class="collection-card-art" ${card.imagem ? `style="background-image:url('${escapeHtml(card.imagem)}')"` : ''}>${card.imagem ? '' : '<span aria-hidden="true">✦</span>'}</span>
      <span class="collection-card-copy"><small>CARTA ${String(cardIndex + 1).padStart(2, '0')}</small><strong>${escapeHtml(card.titulo || `Carta ${cardIndex + 1}`)}</strong><span>${escapeHtml(card.descricao || 'Sem descrição.')}</span></span>
    </button>`).join('');
  $$('[data-card-index]').forEach((button) => button.addEventListener('click', () => {
    const cardIndex = Number(button.dataset.cardIndex);
    openCardPreview(deck, deckCards(deck)[cardIndex], cardIndex);
  }));
  history.replaceState(null, '', `#projeto/${activeProject.path}/baralhos/${index + 1}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openCardPreview(deck, card, cardIndex) {
  editingCardIndex = cardIndex;
  const title = card.titulo || 'Carta sem título';
  const form = $('#cardForm');
  form.reset();
  form.elements.title.value = title;
  form.elements.description.value = card.descricao || '';
  $('#cardImageHint').textContent = card.imagem ? 'A imagem atual será mantida se nenhum novo arquivo for escolhido.' : 'Escolha uma imagem para esta carta.';
  const frameStyle = deck.imagemFrame ? `background-image:url('${escapeHtml(deck.imagemFrame)}')` : '';
  const { width, height } = cardDimensions(deck);
  $('#tcgCardPreview').style.aspectRatio = `${width} / ${height}`;
  $('#tcgCardPreview').innerHTML = `
    <div class="tcg-frame" style="${frameStyle}">
      <header>${escapeHtml(title)}</header>
      <div class="tcg-art" ${card.imagem ? `style="background-image:url('${escapeHtml(card.imagem)}')"` : ''}>${card.imagem ? '' : '<span aria-hidden="true">✦</span>'}</div>
      <div class="tcg-description">${escapeHtml(card.descricao || 'Sem descrição.')}</div>
      <footer><span>${escapeHtml(deck.simbolo || '✦')}</span><small>${escapeHtml(deck.nome)}</small></footer>
    </div>`;
  cardPreviewDialog.showModal();
}

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'baralho';
}

function deckGithubPath(index) {
  return `projetos/${activeProject.path}/baralhos/${activeDeckFiles[index]}`;
}

function setSelectValue(select, value) {
  if (![...select.options].some((option) => option.value === value)) select.add(new Option(value, value));
  select.value = value;
}

function updateProjectUrl(section) {
  if (!activeProject) return;
  const suffix = section === 'visao' ? '' : `/${section}`;
  history.replaceState(null, '', `#projeto/${activeProject.path}${suffix}`);
}

function showHome() {
  activeProject = null;
  $('.project-switcher-copy strong').textContent = 'Selecione um projeto';
  $('.project-thumb').textContent = '—';
  $('#navDeckCount').textContent = '0';
  $('#navDiaryCount').textContent = '0';
  $('[data-view="diario"]').href = '#diario';
  $('[data-view="baralhos"]').href = '#baralhos';
  $('#homeWelcome').hidden = false;
  $('#projectsSection').hidden = false;
  $('#projectPage').hidden = true;
  $('#deckPage').hidden = true;
  history.replaceState(null, '', '#visao');
}

function closeMobileMenu() {
  $('#sidebar').classList.remove('open');
  $('#menuButton').setAttribute('aria-expanded', 'false');
}

$('#homeLink').addEventListener('click', (event) => {
  event.preventDefault();
  showHome();
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#backToProjects').addEventListener('click', showHome);
$('#backToProject').addEventListener('click', () => {
  $('#deckPage').hidden = true;
  $('#projectPage').hidden = false;
  viewingDeckIndex = null;
  updateProjectUrl('visao');
});
$('#openDeckPage').addEventListener('click', () => openDeckPage(editingDeckIndex));
$('#newDeckButton').addEventListener('click', () => openDeckDialog());
$('#newProjectButton').addEventListener('click', () => projectDialog.showModal());
$('#newNoteButton').addEventListener('click', () => {
  editingDiaryIndex = null;
  $('#noteForm').reset();
  $('#noteDialogTitle').textContent = 'Nova página';
  $('#saveNote').textContent = 'Salvar página';
  noteDialog.showModal();
});
$('#githubButton').addEventListener('click', () => {
  const form = $('#githubForm');
  $('#githubFeedback').textContent = githubConnection
    ? `Conectado a ${githubConnection.repository}.`
    : 'Ainda não conectado.';
  $('#githubFeedback').className = `connection-feedback${githubConnection ? ' success' : ''}`;
  $('#disconnectGithub').hidden = !githubConnection;
  form.elements.repository.value = githubConnection?.repository || '';
  form.elements.token.value = '';
  githubDialog.showModal();
});
$('#menuButton').addEventListener('click', () => {
  const isOpen = $('#sidebar').classList.toggle('open');
  $('#menuButton').setAttribute('aria-expanded', String(isOpen));
});
document.addEventListener('click', (event) => {
  if (window.innerWidth > 760 || !$('#sidebar').classList.contains('open')) return;
  if ($('#sidebar').contains(event.target) || $('#menuButton').contains(event.target)) return;
  closeMobileMenu();
});

$('#githubForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const repository = form.elements.repository.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  const token = form.elements.token.value.trim();
  const feedback = $('#githubFeedback');
  const connectButton = $('#connectGithub');

  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    feedback.textContent = 'Use o formato organização/repositório.';
    feedback.className = 'connection-feedback error';
    form.elements.repository.focus();
    return;
  }

  connectButton.disabled = true;
  connectButton.textContent = 'Verificando…';
  feedback.textContent = 'Verificando o acesso no GitHub…';
  feedback.className = 'connection-feedback';

  try {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(repository.split('/')[0])}/${encodeURIComponent(repository.split('/')[1])}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Token inválido ou expirado. Confira o PAT e tente novamente.');
      if (response.status === 404) throw new Error('Repositório não encontrado ou sem acesso para este token.');
      throw new Error(`O GitHub não conseguiu validar a conexão (erro ${response.status}).`);
    }

    const repositoryData = await response.json();
    githubConnection = { repository: repositoryData.full_name, token };
    feedback.textContent = 'Acesso validado. Carregando os projetos do repositório…';
    try {
      await loadProjects();
    } catch (error) {
      githubConnection = null;
      throw error;
    }
    discardLocalProjectChanges();
    showHome();
    lastSyncError = '';
    lastSyncedAt = '';
    restartSyncTimer();
    updateGithubButton();
    feedback.textContent = `Conectado a ${repositoryData.full_name}.`;
    feedback.className = 'connection-feedback success';
    $('#disconnectGithub').hidden = false;
    githubDialog.close();
    showToast('GitHub conectado', `Os projetos de ${repositoryData.full_name} substituíram os dados locais.`);
  } catch (error) {
    githubConnection = null;
    updateGithubButton();
    feedback.textContent = error instanceof TypeError
      ? 'Não foi possível acessar o GitHub. Verifique sua conexão e tente novamente.'
      : error.message;
    feedback.className = 'connection-feedback error';
  } finally {
    connectButton.disabled = false;
    connectButton.textContent = 'Entrar e sincronizar';
  }
});

$('#disconnectGithub').addEventListener('click', () => {
  githubConnection = null;
  lastSyncError = '';
  lastSyncedAt = '';
  restartSyncTimer();
  updateGithubButton();
  $('#githubForm').reset();
  $('#githubFeedback').textContent = 'Conexão encerrada. O token foi removido da memória desta aba.';
  $('#githubFeedback').className = 'connection-feedback';
  $('#disconnectGithub').hidden = true;
  showToast('GitHub desconectado', 'O token desta sessão foi descartado.');
});

function updateGithubButton() {
  const button = $('#githubButton');
  button.classList.toggle('connected', Boolean(githubConnection));
  button.querySelector('strong').textContent = githubConnection ? githubConnection.repository : 'Conectar ao GitHub';
}

$$('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  if (link.dataset.view === 'visao') showHome();
  else if (activeProject && ['diario', 'baralhos'].includes(link.dataset.view)) {
    updateProjectUrl(link.dataset.view);
    document.getElementById(link.dataset.view).scrollIntoView();
  }
  $$('.main-nav a').forEach((item) => item.classList.remove('active'));
  link.classList.add('active');
  if (window.innerWidth <= 760) closeMobileMenu();
}));

$('#globalSearch').addEventListener('input', (event) => {
  const query = event.target.value.toLocaleLowerCase('pt-BR').trim();
  if (activeProject) {
    $$('.deck-card').forEach((card) => card.classList.toggle('hidden', !card.dataset.name.toLocaleLowerCase('pt-BR').includes(query)));
  } else {
    $$('.project-card').forEach((card) => card.classList.toggle('hidden', !card.textContent.toLocaleLowerCase('pt-BR').includes(query)));
  }
});

$('#deckForm').elements.size.addEventListener('change', updateCustomCardSizeFields);

$('#deckForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = $('#deckForm');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const backImage = data.get('backImage');
  const frameImage = data.get('frameImage');
  const isCreating = editingDeckIndex === null;
  const deck = {
    ...(isCreating ? { cartasProntas: 0, descricao: '', simbolo: '✦', cartas: [] } : activeDecks[editingDeckIndex]),
    nome: data.get('name'), quantidade: Number(data.get('quantity')), tamanho: data.get('size'),
    material: data.get('material'), espessura: data.get('weight'),
    tamanhoPersonalizado: data.get('size') === 'Personalizado'
      ? { largura: Number(data.get('customWidth')), altura: Number(data.get('customHeight')) }
      : null,
    imagemVerso: backImage?.size ? await fileToDataUrl(backImage) : (isCreating ? '' : activeDecks[editingDeckIndex].imagemVerso || ''),
    imagemFrame: frameImage?.size ? await fileToDataUrl(frameImage) : (isCreating ? '' : activeDecks[editingDeckIndex].imagemFrame || '')
  };
  if (isCreating) {
    activeDecks.push(deck);
    const usedFiles = new Set(activeDeckFiles);
    const base = slugify(deck.nome);
    let file = `${base}.json`;
    let suffix = 2;
    while (usedFiles.has(file)) file = `${base}-${suffix++}.json`;
    activeDeckFiles.push(file);
    editingDeckIndex = activeDecks.length - 1;
  } else activeDecks[editingDeckIndex] = deck;
  const storedDecks = readLocalJson('card-builder-decks', {});
  const savedDecks = Array.isArray(storedDecks) ? {} : storedDecks;
  savedDecks[activeProject.path] = activeDecks;
  localStorage.setItem('card-builder-decks', JSON.stringify(savedDecks));
  if (activeProject.local) {
    activeProject.baralhos = activeDecks;
    const localProjects = readLocalJson('card-builder-projects', []).map((project) => project.path === activeProject.path ? activeProject : project);
    localStorage.setItem('card-builder-projects', JSON.stringify(localProjects));
  }
  queueGithubFile(deckGithubPath(editingDeckIndex), deck);
  if (isCreating) {
    queueGithubFile(`projetos/${activeProject.path}/projeto.json`, {
      nome: activeProject.nome,
      sigla: activeProject.sigla,
      descricao: activeProject.descricao,
      ...(activeProject.imagem ? { imagem: activeProject.imagem } : {}),
      baralhos: activeDeckFiles,
      diario: typeof activeProject.diario === 'string' ? activeProject.diario : 'diario/paginas.json'
    });
  }
  syncCompletedSave();
  renderDecks(activeDecks);
  $('#deckCount').textContent = activeDecks.length;
  $('#cardCount').textContent = activeDecks.reduce((total, item) => total + item.quantidade, 0);
  $('#navDeckCount').textContent = activeDecks.length;
  deckDialog.close();
  showToast(isCreating ? 'Baralho criado' : 'Baralho atualizado', `${data.get('name')} foi salvo localmente.`);
  form.reset();
  editingDeckIndex = null;
});

$('#cardForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || viewingDeckIndex === null || editingCardIndex === null) return;
  const deck = activeDecks[viewingDeckIndex];
  const cards = deckCards(deck);
  const previousCard = cards[editingCardIndex];
  const data = new FormData(form);
  const image = data.get('image');
  cards[editingCardIndex] = {
    ...previousCard,
    titulo: data.get('title').trim(),
    descricao: data.get('description').trim(),
    imagem: image?.size ? await fileToDataUrl(image) : previousCard.imagem || ''
  };
  deck.cartas = cards;
  deck.cartasProntas = cards.filter((card) => card.titulo && card.descricao).length;
  activeDecks[viewingDeckIndex] = deck;
  const storedDecks = readLocalJson('card-builder-decks', {});
  const savedDecks = Array.isArray(storedDecks) ? {} : storedDecks;
  savedDecks[activeProject.path] = activeDecks;
  localStorage.setItem('card-builder-decks', JSON.stringify(savedDecks));
  if (activeProject.local) {
    activeProject.baralhos = activeDecks;
    localStorage.setItem('card-builder-projects', JSON.stringify(readLocalJson('card-builder-projects', []).map((project) => project.path === activeProject.path ? activeProject : project)));
  }
  queueGithubFile(deckGithubPath(viewingDeckIndex), deck);
  syncCompletedSave();
  cardPreviewDialog.close();
  openDeckPage(viewingDeckIndex);
  showToast('Carta atualizada', `${cards[editingCardIndex].titulo} foi salva e enviada para a fila do GitHub.`);
  editingCardIndex = null;
});

$('#projectForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const name = data.get('name').trim();
  const file = data.get('image');
  const project = {
    nome: name,
    sigla: name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toLocaleUpperCase('pt-BR'),
    descricao: data.get('description').trim(),
    imagem: file?.size ? await fileToDataUrl(file) : '',
    path: `local-${Date.now()}`,
    local: true,
    baralhos: [],
    diario: []
  };
  const localProjects = readLocalJson('card-builder-projects', []);
  localProjects.push(project);
  localStorage.setItem('card-builder-projects', JSON.stringify(localProjects));
  queueGithubFile('projetos/index.json', { projetos: [...projects.map((item) => item.path), project.path] });
  queueGithubFile(`projetos/${project.path}/projeto.json`, {
    nome: project.nome, sigla: project.sigla, descricao: project.descricao, imagem: project.imagem,
    baralhos: [], diario: 'diario/paginas.json'
  });
  queueGithubFile(`projetos/${project.path}/diario/paginas.json`, []);
  syncCompletedSave();
  projects.push(project);
  renderProjects();
  renderProjectMenu();
  projectDialog.close();
  form.reset();
  await openProject(project.path);
  showToast('Projeto criado', `${name} foi salvo como rascunho local.`);
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$('#deleteProjectButton').addEventListener('click', () => {
  $('#deleteProjectName').textContent = activeProject.nome;
  deleteProjectDialog.showModal();
});

$('#deleteProjectForm').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!activeProject) return;
  const deletedName = activeProject.nome;
  if (activeProject.local) {
    const localProjects = readLocalJson('card-builder-projects', []).filter((project) => project.path !== activeProject.path);
    localStorage.setItem('card-builder-projects', JSON.stringify(localProjects));
  } else {
    const deletedProjects = readLocalJson('card-builder-deleted-projects', []);
    if (!deletedProjects.includes(activeProject.path)) deletedProjects.push(activeProject.path);
    localStorage.setItem('card-builder-deleted-projects', JSON.stringify(deletedProjects));
  }
  projects = projects.filter((project) => project.path !== activeProject.path);
  syncCompletedSave();
  deleteProjectDialog.close();
  renderProjects();
  renderProjectMenu();
  showHome();
  showToast('Projeto excluído', `${deletedName} foi removido deste navegador.`);
});

$$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => {
  button.closest('dialog').close('cancel');
}));

$('#noteForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity() || !activeProject) return;
  const data = new FormData(form);
  const now = new Date();
  const index = editingDiaryIndex ?? diaryEntries.length;
  const previousEntry = diaryEntries[index] || {};
  const entry = {
    ...previousEntry,
    titulo: data.get('title').trim(),
    conteudo: data.get('content').trim(),
    resumo: data.get('content').trim().replace(/\s+/g, ' ').slice(0, 55) || 'Página sem conteúdo',
    data: previousEntry.data || 'HOJE',
    hora: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  };
  diaryEntries[index] = entry;
  const notes = readLocalJson('card-builder-notes', []).filter((note) => !(note.project === activeProject.path && note.index === index));
  notes.push({ project: activeProject.path, index, entry, updatedAt: now.toISOString() });
  localStorage.setItem('card-builder-notes', JSON.stringify(notes));
  if (activeProject.local) {
    activeProject.diario = diaryEntries;
    const localProjects = readLocalJson('card-builder-projects', []).map((project) => project.path === activeProject.path ? activeProject : project);
    localStorage.setItem('card-builder-projects', JSON.stringify(localProjects));
  }
  const diaryPath = typeof activeProject.diario === 'string' ? activeProject.diario : 'diario/paginas.json';
  queueGithubFile(`projetos/${activeProject.path}/${diaryPath}`, diaryEntries);
  syncCompletedSave();
  renderDiary();
  $('#diaryCount').textContent = diaryEntries.length;
  $('#navDiaryCount').textContent = diaryEntries.length;
  noteDialog.close();
  showToast(editingDiaryIndex === null ? 'Página salva' : 'Página atualizada', editingDiaryIndex === null ? 'A anotação foi adicionada ao diário.' : 'As alterações foram salvas localmente.');
  form.reset();
  editingDiaryIndex = null;
});

function showToast(title, message) {
  toast.querySelector('strong').textContent = title;
  toast.querySelector('small').textContent = message;
  toast.classList.add('show');
  clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => toast.classList.remove('show'), 3200);
}



document.addEventListener('click', (event) => {
  if (!projectSwitcher.contains(event.target) && !projectMenu.contains(event.target)) {
    projectMenu.hidden = true;
    projectSwitcher.setAttribute('aria-expanded', 'false');
  }
});

resetLegacyProjectsOnce();
// A conexão é solicitada em toda nova carga. O navegador pode preencher as
// credenciais, mas o aplicativo nunca persiste o token por conta própria.
githubDialog.addEventListener('cancel', (event) => {
  if (!githubConnection) event.preventDefault();
});
githubDialog.showModal();
$('#githubForm').elements.repository.focus();
