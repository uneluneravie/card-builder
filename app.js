const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const projectSwitcher = $('#projectSwitcher');
const projectMenu = $('#projectMenu');
const deckDialog = $('#deckDialog');
const noteDialog = $('#noteDialog');
const projectDialog = $('#projectDialog');
const deleteProjectDialog = $('#deleteProjectDialog');
const toast = $('#toast');
let projects = [];
let activeProject = null;
let diaryEntries = [];
let editingDiaryIndex = null;

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

  try {
    const decks = project.local ? project.baralhos : await Promise.all(project.baralhos.map(async (file) => {
      const response = await fetch(`projetos/${path}/baralhos/${file}`);
      if (!response.ok) throw new Error(`Não foi possível abrir ${file}.`);
      return response.json();
    }));
    const [diary, activities] = project.local
      ? [project.diario, project.atividades]
      : await Promise.all([
        loadJson(`projetos/${path}/${project.diario}`),
        loadJson(`projetos/${path}/${project.atividades}`)
      ]);
    renderDecks(decks);
    const savedDiaryEntries = readLocalJson('card-builder-notes', [])
      .filter((note) => note.project === path && Number.isInteger(note.index));
    diaryEntries = diary.map((entry, index) => savedDiaryEntries.find((note) => note.index === index)?.entry || entry);
    savedDiaryEntries
      .filter((note) => note.index >= diaryEntries.length)
      .sort((a, b) => a.index - b.index)
      .forEach((note) => diaryEntries.push(note.entry));
    renderDiary();
    renderActivities(activities);
    $('#deckCount').textContent = decks.length;
    $('#cardCount').textContent = decks.reduce((total, deck) => total + deck.quantidade, 0);
    $('#diaryCount').textContent = diaryEntries.length;
    $('#navDeckCount').textContent = decks.length;
    $('#navDiaryCount').textContent = diaryEntries.length;
    history.replaceState(null, '', `#projeto/${path}`);
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
  $('#noteList').innerHTML = diaryEntries.length ? diaryEntries.slice(0, 3).map((entry, index) => `
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

function renderActivities(entries) {
  $('#activityList').innerHTML = entries.length ? entries.map((entry) => `
    <div><span class="activity-avatar ${escapeHtml(entry.estilo || '')}">${escapeHtml(entry.icone)}</span><p><strong>${escapeHtml(entry.titulo)}</strong><small>${escapeHtml(entry.detalhe)}</small></p></div>
  `).join('') : '<p class="empty-state">Nenhuma atividade recente.</p>';
}

function renderDecks(decks) {
  const cards = decks.map((deck, index) => {
    const progress = Math.round((deck.cartasProntas / deck.quantidade) * 100);
    const theme = ['heroes', 'relics', 'lands'][index % 3];
    const statusClass = deck.status === 'Em revisão' ? 'review' : deck.status === 'Rascunho' ? 'draft' : '';
    const progressClass = index % 3 === 1 ? 'amber' : index % 3 === 2 ? 'teal' : '';
    return `<article class="deck-card" data-name="${escapeHtml(deck.nome)}">
      <div class="deck-preview ${theme}"><span class="card-back back-one">${escapeHtml(deck.simbolo || '✦')}</span><span class="card-back back-two">${escapeHtml(deck.simbolo || '◆')}</span><span class="deck-status ${statusClass}">${escapeHtml(deck.status)}</span></div>
      <div class="deck-body"><div class="deck-title"><h3>${escapeHtml(deck.nome)}</h3><button aria-label="Opções de ${escapeHtml(deck.nome)}">•••</button></div><p>${escapeHtml(deck.descricao)}</p><div class="progress-label"><span>${deck.cartasProntas} de ${deck.quantidade} cartas</span><strong>${progress}%</strong></div><div class="progress ${progressClass}"><span style="width:${progress}%"></span></div><div class="deck-meta"><span>◫ ${escapeHtml(deck.tamanho)}</span><span>◉ ${escapeHtml(deck.espessura)}</span></div></div>
    </article>`;
  }).join('');
  $('#deckGrid').innerHTML = `${cards}<button class="add-deck-card" id="addDeckCard"><span>＋</span><strong>Criar novo baralho</strong><small>Defina formato, materiais e comece a criar.</small></button>`;
  $('#addDeckCard').addEventListener('click', () => deckDialog.showModal());
}

function showHome() {
  activeProject = null;
  $('.project-switcher-copy strong').textContent = 'Selecione um projeto';
  $('.project-thumb').textContent = '—';
  $('#navDeckCount').textContent = '0';
  $('#navDiaryCount').textContent = '0';
  $('#homeWelcome').hidden = false;
  $('#projectsSection').hidden = false;
  $('#projectPage').hidden = true;
  history.replaceState(null, '', '#visao');
}

$('#backToProjects').addEventListener('click', showHome);
$('#newDeckButton').addEventListener('click', () => deckDialog.showModal());
$('#newProjectButton').addEventListener('click', () => projectDialog.showModal());
$('#newNoteButton').addEventListener('click', () => {
  editingDiaryIndex = null;
  $('#noteForm').reset();
  $('#noteDialogTitle').textContent = 'Nova página';
  $('#saveNote').textContent = 'Salvar página';
  noteDialog.showModal();
});
$('#githubButton').addEventListener('click', () => $('#githubDialog').showModal());
$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

$$('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  if (link.dataset.view === 'visao') showHome();
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

$('#deckForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = $('#deckForm');
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const drafts = JSON.parse(localStorage.getItem('card-builder-decks') || '[]');
  drafts.push({ project: activeProject?.path, name: data.get('name'), quantity: data.get('quantity'), size: data.get('size'), material: data.get('material'), weight: data.get('weight'), createdAt: new Date().toISOString() });
  localStorage.setItem('card-builder-decks', JSON.stringify(drafts));
  deckDialog.close();
  showToast('Baralho criado', `${data.get('name')} foi salvo como rascunho local.`);
  form.reset();
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
    diario: [],
    atividades: []
  };
  const localProjects = readLocalJson('card-builder-projects', []);
  localProjects.push(project);
  localStorage.setItem('card-builder-projects', JSON.stringify(localProjects));
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

loadProjects().then(() => {
  const match = location.hash.match(/^#projeto\/(.+)$/);
  if (match) openProject(match[1]);
});
