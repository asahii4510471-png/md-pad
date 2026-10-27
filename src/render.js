import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import DOMPurify from 'dompurify';

const markdown = new MarkdownIt({ html: false }).use(taskLists);
// Parse URLs as links so DOMPurify can remove unsafe href/src attributes,
// rather than leaving rejected URL syntax verbatim in the preview.
markdown.validateLink = () => true;

/** The sole Markdown-to-HTML boundary. Never insert unsanitized HTML. */
export function render(source) {
  const environment = {};
  const tokens = markdown.parse(source, environment);
  for (const block of tokens) {
    for (const token of block.children || []) {
      if (token.type === 'text' && token.content.includes('<')) {
        // Suppress raw HTML in prose; fenced and inline code stay literal.
        token.content = DOMPurify.sanitize(token.content, {
          ALLOWED_TAGS: [], ALLOWED_ATTR: [], RETURN_DOM_FRAGMENT: true,
        }).textContent;
      }
    }
  }
  return DOMPurify.sanitize(markdown.renderer.render(tokens, markdown.options, environment), {
    USE_PROFILES: { html: true },
  });
}
