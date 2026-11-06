// @vitest-environment jsdom
import { installHistoryLoader } from '../../src/lib/history-loader';

function fixture() {
  document.body.innerHTML = '<section id="history" hidden><p id="history-loading"></p><button id="history-retry" hidden>Try again</button><div id="history-content" hidden></div></section>';
  return document.getElementById('history')!;
}

it('loads only on visiting History and reuses the mounted timeline on return', async () => {
  const page = fixture();
  const unmount = vi.fn();
  const mountHistoryTimeline = vi.fn(() => unmount);
  const load = vi.fn().mockResolvedValue({ mountHistoryTimeline });
  const dispose = installHistoryLoader(load);
  expect(load).not.toHaveBeenCalled();
  page.hidden = false;
  await vi.waitFor(() => expect(mountHistoryTimeline).toHaveBeenCalledOnce());
  expect(document.getElementById('history-content')!.hidden).toBe(false);
  page.hidden = true;
  page.hidden = false;
  await Promise.resolve();
  expect(load).toHaveBeenCalledOnce();
  dispose();
  expect(unmount).toHaveBeenCalledOnce();
  document.body.innerHTML = '';
});

it('offers a working retry when the lazy module cannot be downloaded', async () => {
  const page = fixture();
  page.hidden = false;
  const mountHistoryTimeline = vi.fn(() => () => {});
  const load = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ mountHistoryTimeline });
  const dispose = installHistoryLoader(load);
  const retry = document.getElementById('history-retry')!;
  await vi.waitFor(() => expect(retry.hidden).toBe(false));
  expect(document.getElementById('history-loading')!.textContent).toContain('couldn’t be loaded');
  retry.click();
  await vi.waitFor(() => expect(mountHistoryTimeline).toHaveBeenCalledOnce());
  expect(retry.hidden).toBe(true);
  expect(document.getElementById('history-loading')!.hidden).toBe(true);
  dispose(); document.body.innerHTML = '';
});

it('waits for a return visit when navigation hides History during its download', async () => {
  const page = fixture();
  page.hidden = false;
  const mountHistoryTimeline = vi.fn(() => () => {});
  let resolveModule!: (module: { mountHistoryTimeline: typeof mountHistoryTimeline }) => void;
  const delayed = new Promise<{ mountHistoryTimeline: typeof mountHistoryTimeline }>(resolve => { resolveModule = resolve; });
  const load = vi.fn().mockReturnValueOnce(delayed).mockResolvedValue({ mountHistoryTimeline });
  const dispose = installHistoryLoader(load);
  page.hidden = true;
  resolveModule({ mountHistoryTimeline });
  await delayed;
  expect(mountHistoryTimeline).not.toHaveBeenCalled();
  page.hidden = false;
  await vi.waitFor(() => expect(mountHistoryTimeline).toHaveBeenCalledOnce());
  dispose(); document.body.innerHTML = '';
});

it('does not mount a delayed import after the page has been disposed', async () => {
  const page = fixture();
  page.hidden = false;
  const mountHistoryTimeline = vi.fn(() => () => {});
  let resolveModule!: (module: { mountHistoryTimeline: typeof mountHistoryTimeline }) => void;
  const load = () => new Promise<{ mountHistoryTimeline: typeof mountHistoryTimeline }>(resolve => { resolveModule = resolve; });
  const dispose = installHistoryLoader(load);
  dispose();
  resolveModule({ mountHistoryTimeline });
  await Promise.resolve();
  expect(mountHistoryTimeline).not.toHaveBeenCalled();
  document.body.innerHTML = '';
});
