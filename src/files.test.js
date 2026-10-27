import { afterEach, describe, expect, it, vi } from 'vitest';
import { supportsFileSystemAccess, openMarkdown, saveMarkdown, registerFileHandler } from './files.js';

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

// OS file launches are independent of the in-app picker API.
describe('installed PWA file handler', () => {
  function launchQueue(onFile = vi.fn(), onError = vi.fn()) {
    const queue = { setConsumer: vi.fn() };
    expect(registerFileHandler(onFile, onError, { launchQueue: queue })).toBe(true);
    return { consume: queue.setConsumer.mock.calls[0][0], onFile, onError };
  }
  const handle = (name, content) => ({ getFile: async () => ({ name, text: async () => content }) });

  it('does not register when launchQueue is unavailable', () => {
    expect(registerFileHandler(vi.fn(), vi.fn(), {})).toBe(false);
    expect(registerFileHandler(vi.fn(), vi.fn(), { launchQueue: {} })).toBe(false);
  });

  it('ignores a launch without files', async () => {
    const { consume, onFile, onError } = launchQueue();
    await consume({ files: [] });
    await consume({});
    expect(onFile).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reads every .md file, including uppercase extensions', async () => {
    const { consume, onFile, onError } = launchQueue();
    await consume({ files: [handle('a.md', '# A'), handle('b.MD', '# B')] });
    expect(onFile.mock.calls).toEqual([[{ name: 'a.md', content: '# A' }], [{ name: 'b.MD', content: '# B' }]]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('handles separate launches in order while an earlier file is still importing', async () => {
    let release;
    const firstImport = new Promise((resolve) => { release = resolve; });
    const events = [];
    const onFile = vi.fn(async (file) => {
      events.push(file.name);
      if (file.name === 'a.md') await firstImport;
    });
    const { consume } = launchQueue(onFile);
    const first = consume({ files: [handle('a.md', 'a')] });
    const second = consume({ files: [handle('b.md', 'b')] });
    await vi.waitFor(() => expect(events).toEqual(['a.md']));
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(['a.md', 'b.md']);
  });

  it('reports denied access, bad extensions and read failures without losing later files', async () => {
    const denied = new DOMException('Denied', 'NotAllowedError');
    const { consume, onFile, onError } = launchQueue();
    await consume({ files: [
      { getFile: async () => { throw denied; } },
      handle('bad.txt', 'not markdown'),
      { getFile: async () => ({ name: 'broken.md', text: async () => { throw new Error('Read failed'); } }) },
      handle('good.md', 'good'),
    ] });
    expect(onError).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenNthCalledWith(1, denied);
    expect(onFile).toHaveBeenCalledExactlyOnceWith({ name: 'good.md', content: 'good' });
    await consume({ files: [handle('next.md', 'next')] });
    expect(onFile).toHaveBeenLastCalledWith({ name: 'next.md', content: 'next' });
  });
});
