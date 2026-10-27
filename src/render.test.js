import { describe, expect, it, vi } from 'vitest';
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

describe('XSS boundary', () => {
  function markup(source) {
    const output = document.createElement('div');
    output.innerHTML = render(source);
    return output;
  }

  it('never creates an onerror attribute from raw HTML', () => {
    const output = markup('<img src=x onerror=alert(1)>');
    expect(output.querySelector('img')).toBeNull();
    expect(output.querySelector('[onerror]')).toBeNull();
    expect(render('<img src=x onerror=alert(1)>')).not.toContain('onerror');
  });

  it('never leaves a javascript: URL in an HTML attribute', () => {
    for (const source of ['[x](javascript:alert(1))', '[x](JaVaScRiPt:alert(1))', '[x](javascript&#58;alert(1))']) {
      const output = markup(source);
      expect(output.querySelector('[href]')).toBeNull();
      expect(render(source)).not.toMatch(/javascript:/i);
      for (const element of output.querySelectorAll('*')) {
        for (const attribute of element.attributes) {
          expect(attribute.value).not.toMatch(/javascript:/i);
          expect(attribute.name).not.toBe('onerror');
        }
      }
    }
  });

  it('sanitizes parser output even when it contains a dangerous attribute', async () => {
    const { default: DOMPurify } = await import('dompurify');
    const spy = vi.spyOn(DOMPurify, 'sanitize');
    render('**safe**');
    expect(spy).toHaveBeenCalled();
    const example = markup('```html\n<img src=x onerror=alert(1)>\n```');
    expect(example.querySelector('img')).toBeNull();
    expect(example.querySelector('code').textContent).toContain('<img src=x onerror=alert(1)>');
  });
});


it('preserves escaped code, ordinary less-than signs, and safe links', () => {
  const output = document.createElement('div');
  output.innerHTML = render('A < B & C > D, ` <img src=x> ` and [safe](https://example.com).');
  expect(output.textContent).toContain('A < B & C > D');
  expect(output.querySelector('code').textContent).toContain('<img src=x>');
  expect(output.querySelector('a').href).toBe('https://example.com/');
});
