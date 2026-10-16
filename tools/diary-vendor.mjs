import { marked } from 'marked';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', htmlLabels: false, suppressErrorRendering: true });
window.DiaryMarkdown = {
  html: (source) => DOMPurify.sanitize(marked.parse(source, { gfm: true }), { USE_PROFILES: { html: true } }),
  diagram: async (id, source) => {
    const { svg } = await mermaid.render(id, source);
    return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
  }
};
