import { describe, expect, it } from 'vitest';
import { render } from './render.js';

describe('Markdown rendering', () => {
  it('renders GFM tables', () => {
    expect(render('| A | B |\n| --- | --- |\n| 1 | 2 |')).toContain('<table>');
  });
  it('renders disabled task list checkboxes', () => {
    const result = document.createElement('div');
    result.innerHTML = render('- [x] done\n- [ ] todo');
    expect(result.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(result.querySelector('input').disabled).toBe(true);
    expect(result.querySelector('input').checked).toBe(true);
  });
  it('renders fenced code and strikethrough', () => {
    expect(render('```\nhello\n```')).toContain('<pre><code>hello\n</code></pre>');
    expect(render('~~old~~')).toContain('<s>old</s>');
  });
});
