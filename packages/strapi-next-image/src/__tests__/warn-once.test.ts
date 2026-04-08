import { describe, it, expect, vi, beforeEach } from 'vitest';

// Each test gets a fresh module so the internal warnedSet is reset.
async function importFresh() {
  vi.resetModules();
  return import('../warn-once');
}

describe('warnOnce', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls console.warn on first invocation', async () => {
    const { warnOnce } = await importFresh();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnce('hello');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith('hello');
  });

  it('does not call console.warn a second time for the same message', async () => {
    const { warnOnce } = await importFresh();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnce('duplicate');
    warnOnce('duplicate');
    warnOnce('duplicate');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('warns separately for distinct messages', async () => {
    const { warnOnce } = await importFresh();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnce('msg-a');
    warnOnce('msg-b');
    warnOnce('msg-a'); // duplicate — should not fire again
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('msg-a');
    expect(warn).toHaveBeenCalledWith('msg-b');
  });

  it('is safe to call many times without side effects beyond the first', async () => {
    const { warnOnce } = await importFresh();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 100; i++) warnOnce('repeated');
    expect(warn).toHaveBeenCalledOnce();
  });
});
