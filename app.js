const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const projectSwitcher = $('#projectSwitcher');
const projectMenu = $('#projectMenu');
const deckDialog = $('#deckDialog');
const noteDialog = $('#noteDialog');
const toast = $('#toast');

projectSwitcher.addEventListener('click', () => {
  const willOpen = projectMenu.hidden;
  projectMenu.hidden = !willOpen;
  projectSwitcher.setAttribute('aria-expanded', String(willOpen));
});

$$('[data-project]').forEach((button) => button.addEventListener('click', () => {
  $('.project-switcher-copy strong').textContent = button.dataset.project;
  projectMenu.hidden = true;
  showToast('Projeto carregado', `${button.dataset.project} está pronto para editar.`);
}));

const openDeckDialog = () => deckDialog.showModal();
$('#newDeckButton').addEventListener('click', openDeckDialog);
$('#addDeckCard').addEventListener('click', openDeckDialog);
$('#newNoteButton').addEventListener('click', () => noteDialog.showModal());
$('#githubButton').addEventListener('click', () => $('#githubDialog').showModal());

$('#menuButton').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$$('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  $$('.main-nav a').forEach((item) => item.classList.remove('active'));
  link.classList.add('active');
  if (window.innerWidth <= 760) $('#sidebar').classList.remove('open');
}));

$('#globalSearch').addEventListener('input', (event) => {
  const query = event.target.value.toLocaleLowerCase('pt-BR').trim();
  $$('.deck-card').forEach((card) => card.classList.toggle('hidden', !card.dataset.name.toLocaleLowerCase('pt-BR').includes(query)));
});

$('#saveDeck').addEventListener('click', (event) => {
  const form = $('#deckForm');
  if (!form.reportValidity()) { event.preventDefault(); return; }
  const data = new FormData(form);
  const drafts = JSON.parse(localStorage.getItem('card-builder-decks') || '[]');
  drafts.push({ name: data.get('name'), quantity: data.get('quantity'), size: data.get('size'), material: data.get('material'), weight: data.get('weight'), createdAt: new Date().toISOString() });
  localStorage.setItem('card-builder-decks', JSON.stringify(drafts));
  setTimeout(() => showToast('Baralho criado', `${data.get('name')} foi salvo como rascunho local.`), 80);
  form.reset();
});

$('#saveNote').addEventListener('click', (event) => {
  const form = $('#noteForm');
  if (!form.reportValidity()) { event.preventDefault(); return; }
  const data = new FormData(form);
  const notes = JSON.parse(localStorage.getItem('card-builder-notes') || '[]');
  notes.push({ title: data.get('title'), content: data.get('content'), updatedAt: new Date().toISOString() });
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
