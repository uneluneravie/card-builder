/* Markdown is presentation only: the original source remains in the diary JSON. */
(() => {
  let generation = 0;
  let diagramId = 0;
  window.renderDiaryPreview = async (source) => {
    const current = ++generation;
    const preview = document.querySelector('#notePreview');
    if (!source.trim()) {
      preview.innerHTML = '<p class="empty-state">Esta página ainda não tem conteúdo.</p>';
      return;
    }
    preview.innerHTML = DiaryMarkdown.html(source);
    for (const code of preview.querySelectorAll('pre > code.language-mermaid')) {
      const container = document.createElement('figure');
      container.className = 'diary-diagram';
      container.setAttribute('aria-label', 'Diagrama Mermaid');
      container.textContent = 'Carregando diagrama…';
      code.parentElement.replaceWith(container);
      try {
        const svg = await DiaryMarkdown.diagram(`diary-mermaid-${++diagramId}`, code.textContent);
        if (generation !== current) return;
        container.innerHTML = svg;
      } catch {
        if (generation !== current) return;
        container.replaceChildren();
        const message = document.createElement('p');
        message.className = 'error-state';
        message.textContent = 'Não foi possível renderizar este diagrama. Confira a sintaxe Mermaid no modo de edição.';
        const original = document.createElement('pre');
        original.textContent = code.textContent;
        container.append(message, original);
      }
    }
  };
})();
