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
let githubConnection = null;

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
    const response = await fetch('projetos/index.json');
    if (!response.ok) throw new Error('Não foi possível abrir o índice de projetos.');
    const index = await response.json();
    const fileProjects = await Promise.all(index.projetos.map(async (path) => {
      const projectResponse = await fetch(`projetos/${path}/projeto.json`);
      if (!projectResponse.ok) throw new Error(`Não foi possível abrir o projeto ${path}.`);
      return { ...(await projectResponse.json()), path };
    }));
    const localProjects = readLocalJson('card-builder-projects', []);
    const deletedProjects = readLocalJson('card-builder-deleted-projects', []);
    projects = [...fileProjects.filter((project) => !deletedProjects.includes(project.path)), ...localProjects];
    renderProjects();
    renderProjectMenu();
  } catch (error) {
    $('#projectGrid').innerHTML = `<p class="error-state">${escapeHtml(error.message)} Execute a aplicação por meio de um servidor local.</p>`;
  }
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
    const decks = project.local ? project.baralhos : await Promise.all(project.baralhos.map(async (file) => {
      const response = await fetch(`projetos/${path}/baralhos/${file}`);
      if (!response.ok) throw new Error(`Não foi possível abrir ${file}.`);
      return response.json();
    }));
    const diary = project.local
      ? project.diario
      : await loadJson(`projetos/${path}/${project.diario}`);
    const storedDecks = readLocalJson('card-builder-decks', {});
    const savedDecks = Array.isArray(storedDecks) ? {} : storedDecks;
    activeDecks = savedDecks[path] || decks;
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
      <div class="deck-body"><div class="deck-title"><h3>${escapeHtml(deck.nome)}</h3></div><p>${escapeHtml(deck.descricao)}</p><div class="progress-label"><span>${deck.cartasProntas} de ${deck.quantidade} cartas</span><strong>${progress}%</strong></div><div class="progress ${progressClass}"><span style="width:${progress}%"></span></div><div class="deck-meta"><span>◫ ${escapeHtml(deck.tamanho)}</span><span>◉ ${escapeHtml(deck.espessura)}</span></div></div>
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
    setSelectValue(form.elements.material, deck.material);
    setSelectValue(form.elements.weight, deck.espessura);
  }
  deckDialog.showModal();
}

function deckCards(deck) {
  return Array.from({ length: deck.quantidade }, (_, index) => deck.cartas?.[index] || {
    titulo: `Carta ${index + 1}`,
    descricao: 'Esta carta ainda não possui conteúdo.',
    imagem: ''
  });
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
  $$('[data-card-index]').forEach((button) => button.addEventListener('click', () => openCardPreview(deck, deckCards(deck)[Number(button.dataset.cardIndex)])));
  history.replaceState(null, '', `#projeto/${activeProject.path}/baralhos/${index + 1}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openCardPreview(deck, card) {
  const title = card.titulo || 'Carta sem título';
  $('#previewCardTitle').textContent = title;
  const frameStyle = deck.imagemFrame ? `background-image:url('${escapeHtml(deck.imagemFrame)}')` : '';
  $('#tcgCardPreview').innerHTML = `
    <div class="tcg-frame" style="${frameStyle}">
      <header>${escapeHtml(title)}</header>
      <div class="tcg-art" ${card.imagem ? `style="background-image:url('${escapeHtml(card.imagem)}')"` : ''}>${card.imagem ? '' : '<span aria-hidden="true">✦</span>'}</div>
      <div class="tcg-description">${escapeHtml(card.descricao || 'Sem descrição.')}</div>
      <footer><span>${escapeHtml(deck.simbolo || '✦')}</span><small>${escapeHtml(deck.nome)}</small></footer>
    </div>`;
  cardPreviewDialog.showModal();
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
$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

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
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Token inválido ou expirado. Confira o PAT e tente novamente.');
      if (response.status === 404) throw new Error('Repositório não encontrado ou sem acesso para este token.');
      throw new Error(`O GitHub não conseguiu validar a conexão (erro ${response.status}).`);
    }

    const repositoryData = await response.json();
    githubConnection = { repository: repositoryData.full_name, token };
    updateGithubButton();
    feedback.textContent = `Conectado a ${repositoryData.full_name}.`;
    feedback.className = 'connection-feedback success';
    $('#disconnectGithub').hidden = false;
    form.elements.token.value = '';
    showToast('GitHub conectado', `Acesso a ${repositoryData.full_name} validado nesta sessão.`);
  } catch (error) {
    githubConnection = null;
    updateGithubButton();
    feedback.textContent = error instanceof TypeError
      ? 'Não foi possível acessar o GitHub. Verifique sua conexão e tente novamente.'
      : error.message;
    feedback.className = 'connection-feedback error';
  } finally {
    connectButton.disabled = false;
    connectButton.textContent = 'Conectar';
  }
});

$('#disconnectGithub').addEventListener('click', () => {
  githubConnection = null;
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
  if (window.innerWidth <= 760) $('#sidebar').classList.remove('open');
}));

$('#globalSearch').addEventListener('input', (event) => {
  const query = event.target.value.toLocaleLowerCase('pt-BR').trim();
  if (activeProject) {
    $$('.deck-card').forEach((card) => card.classList.toggle('hidden', !card.dataset.name.toLocaleLowerCase('pt-BR').includes(query)));
  } else {
    $$('.project-card').forEach((card) => card.classList.toggle('hidden', !card.textContent.toLocaleLowerCase('pt-BR').includes(query)));
  }
});

$('#deckForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = $('#deckForm');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const backImage = data.get('backImage');
  const frameImage = data.get('frameImage');
  const deck = {
    ...(editingDeckIndex === null ? { cartasProntas: 0, descricao: '', simbolo: '✦', cartas: [] } : activeDecks[editingDeckIndex]),
    nome: data.get('name'), quantidade: Number(data.get('quantity')), tamanho: data.get('size'),
    material: data.get('material'), espessura: data.get('weight'),
    imagemVerso: backImage?.size ? await fileToDataUrl(backImage) : (editingDeckIndex === null ? '' : activeDecks[editingDeckIndex].imagemVerso || ''),
    imagemFrame: frameImage?.size ? await fileToDataUrl(frameImage) : (editingDeckIndex === null ? '' : activeDecks[editingDeckIndex].imagemFrame || '')
  };
  if (editingDeckIndex === null) activeDecks.push(deck);
  else activeDecks[editingDeckIndex] = deck;
  const storedDecks = readLocalJson('card-builder-decks', {});
  const savedDecks = Array.isArray(storedDecks) ? {} : storedDecks;
  savedDecks[activeProject.path] = activeDecks;
  localStorage.setItem('card-builder-decks', JSON.stringify(savedDecks));
  if (activeProject.local) {
    activeProject.baralhos = activeDecks;
    const localProjects = readLocalJson('card-builder-projects', []).map((project) => project.path === activeProject.path ? activeProject : project);
    localStorage.setItem('card-builder-projects', JSON.stringify(localProjects));
  }
  markLocalSave();
  renderDecks(activeDecks);
  $('#deckCount').textContent = activeDecks.length;
  $('#cardCount').textContent = activeDecks.reduce((total, item) => total + item.quantidade, 0);
  $('#navDeckCount').textContent = activeDecks.length;
  deckDialog.close();
  showToast(editingDeckIndex === null ? 'Baralho criado' : 'Baralho atualizado', `${data.get('name')} foi salvo localmente.`);
  form.reset();
  editingDeckIndex = null;
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
  markLocalSave();
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
  markLocalSave();
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
  markLocalSave();
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

function markLocalSave() {
  const status = $('#saveStatus');
  const savedAt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  status.className = 'save-status';
  status.querySelector('strong').textContent = 'Alterações salvas';
  status.querySelector('small').textContent = `Salvo neste navegador às ${savedAt}.`;
}

document.addEventListener('click', (event) => {
  if (!projectSwitcher.contains(event.target) && !projectMenu.contains(event.target)) {
    projectMenu.hidden = true;
    projectSwitcher.setAttribute('aria-expanded', 'false');
  }
});

loadProjects().then(() => {
  const match = location.hash.match(/^#projeto\/([^/]+)(?:\/(diario|baralhos))?$/);
  if (match) openProject(match[1]).then(() => {
    if (match[2]) {
      updateProjectUrl(match[2]);
      document.getElementById(match[2]).scrollIntoView();
    }
  });
});
