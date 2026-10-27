import { afterEach, describe, expect, it, vi } from 'vitest';
import { supportsFileSystemAccess, openMarkdown, saveMarkdown } from './files.js';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Markdown files', () => {
  it('detects open and save APIs independently, including missing or non-function APIs', () => {
    expect(supportsFileSystemAccess('open', {})).toBe(false);
    expect(supportsFileSystemAccess('save', { showSaveFilePicker: true })).toBe(false);
    const scope = { showOpenFilePicker() {} };
    expect(supportsFileSystemAccess('open', scope)).toBe(true);
    expect(supportsFileSystemAccess('save', scope)).toBe(false);
  });
  it('reads a native file and handles picker cancellation', async () => {
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([
      { getFile: async () => ({ name: 'sample.md', text: async () => '# Sample' }) },
    ]));
    expect(await openMarkdown()).toEqual({ name: 'sample.md', content: '# Sample' });
    window.showOpenFilePicker.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    expect(await openMarkdown()).toBeNull();
  });
  it('reads using the input fallback and removes the input', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined);
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      expect(this.accept).toContain('.md');
      Object.defineProperty(this, 'files', { value: [{ name: 'fallback.md', text: async () => 'fallback' }] });
      this.dispatchEvent(new Event('change'));
    });
    expect(await openMarkdown()).toEqual({ name: 'fallback.md', content: 'fallback' });
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
  it('writes and closes a native file', async () => {
    const writable = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
    vi.stubGlobal('showSaveFilePicker', vi.fn().mockResolvedValue({ createWritable: async () => writable }));
    expect(await saveMarkdown('# Body', 'sample')).toBe(true);
    expect(writable.write).toHaveBeenCalledWith('# Body');
    expect(writable.close).toHaveBeenCalledOnce();
  });
  it('downloads a Markdown blob when the save API is unavailable', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('showSaveFilePicker', undefined);
    const create = vi.fn().mockReturnValue('blob:test');
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('my_note.md');
      expect(this.getAttribute('href')).toBe('blob:test');
    });
    expect(await saveMarkdown('body', 'my/note')).toBe(true);
    expect(create.mock.calls[0][0].type).toBe('text/markdown;charset=utf-8');
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
