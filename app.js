const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const projectSwitcher = $('#projectSwitcher');
const projectMenu = $('#projectMenu');
const deckDialog = $('#deckDialog');
const noteDialog = $('#noteDialog');
const toast = $('#toast');
let projects = [];
let activeProject = null;

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
    projects = await Promise.all(index.projetos.map(async (path) => {
      const projectResponse = await fetch(`projetos/${path}/projeto.json`);
      if (!projectResponse.ok) throw new Error(`Não foi possível abrir o projeto ${path}.`);
      return { ...(await projectResponse.json()), path };
    }));
    renderProjects();
    renderProjectMenu();
  } catch (error) {
    $('#projectGrid').innerHTML = `<p class="error-state">${escapeHtml(error.message)} Execute a aplicação por meio de um servidor local.</p>`;
  }
}

function renderProjects() {
  $('#projectGrid').innerHTML = projects.map((project) => `
    <button class="project-card" data-project-path="${escapeHtml(project.path)}">
      <span class="project-card-art" aria-hidden="true">${escapeHtml(project.sigla)}</span>
      <span class="project-card-copy"><small>PROJETO</small><strong>${escapeHtml(project.nome)}</strong><span>${escapeHtml(project.descricao)}</span></span>
      <span class="project-card-arrow" aria-hidden="true">→</span>
    </button>`).join('');
  $$('[data-project-path]').forEach((button) => button.addEventListener('click', () => openProject(button.dataset.projectPath)));
}

function renderProjectMenu() {
  projectMenu.innerHTML = `${projects.map((project) => `<button data-menu-project="${escapeHtml(project.path)}">${escapeHtml(project.nome)}</button>`).join('')}<button id="newProjectFromMenu">＋ Criar projeto</button>`;
  $$('[data-menu-project]').forEach((button) => button.addEventListener('click', () => openProject(button.dataset.menuProject)));
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
  $('#diaryCount').textContent = project.paginasDiario;
  $('#deckGrid').innerHTML = '<p class="loading-state">Carregando baralhos…</p>';

  try {
    const decks = await Promise.all(project.baralhos.map(async (file) => {
      const response = await fetch(`projetos/${path}/baralhos/${file}`);
      if (!response.ok) throw new Error(`Não foi possível abrir ${file}.`);
      return response.json();
    }));
    renderDecks(decks);
    $('#deckCount').textContent = decks.length;
    $('#cardCount').textContent = decks.reduce((total, deck) => total + deck.quantidade, 0);
    history.replaceState(null, '', `#projeto/${path}`);
    showToast('Projeto carregado', `${project.nome} está pronto para editar.`);
  } catch (error) {
    $('#deckGrid').innerHTML = `<p class="error-state">${escapeHtml(error.message)}</p>`;
  }
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
  $('#homeWelcome').hidden = false;
  $('#projectsSection').hidden = false;
  $('#projectPage').hidden = true;
  history.replaceState(null, '', '#visao');
}

$('#backToProjects').addEventListener('click', showHome);
$('#newDeckButton').addEventListener('click', () => deckDialog.showModal());
$('#newNoteButton').addEventListener('click', () => noteDialog.showModal());
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

$('#saveDeck').addEventListener('click', (event) => {
  const form = $('#deckForm');
  if (!form.reportValidity()) { event.preventDefault(); return; }
  const data = new FormData(form);
  const drafts = JSON.parse(localStorage.getItem('card-builder-decks') || '[]');
  drafts.push({ project: activeProject?.path, name: data.get('name'), quantity: data.get('quantity'), size: data.get('size'), material: data.get('material'), weight: data.get('weight'), createdAt: new Date().toISOString() });
  localStorage.setItem('card-builder-decks', JSON.stringify(drafts));
  setTimeout(() => showToast('Baralho criado', `${data.get('name')} foi salvo como rascunho local.`), 80);
  form.reset();
});

$('#saveNote').addEventListener('click', (event) => {
  const form = $('#noteForm');
  if (!form.reportValidity()) { event.preventDefault(); return; }
  const data = new FormData(form);
  const notes = JSON.parse(localStorage.getItem('card-builder-notes') || '[]');
  notes.push({ project: activeProject?.path, title: data.get('title'), content: data.get('content'), updatedAt: new Date().toISOString() });
  localStorage.setItem('card-builder-notes', JSON.stringify(notes));
  setTimeout(() => showToast('Página salva', 'A anotação foi adicionada ao diário.'), 80);
  form.reset();
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
