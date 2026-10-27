import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import DOMPurify from 'dompurify';

const markdown = new MarkdownIt({ html: false }).use(taskLists);

/** The sole Markdown-to-HTML boundary. Never insert unsanitized HTML. */
export function render(source) {
  return DOMPurify.sanitize(markdown.render(source), {
    USE_PROFILES: { html: true },
  });
}
