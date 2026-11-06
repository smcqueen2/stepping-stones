// @vitest-environment jsdom
import { installHistoryLoader } from '../../src/lib/history-loader';

function fixture() {
  document.body.innerHTML = '<dialog id="history"><p id="history-loading"></p><button id="history-retry" hidden>Try again</button><div id="history-content" hidden></div></dialog>';
  return document.querySelector<HTMLDialogElement>('dialog')!;
}

it('loads only on opening and reuses the mounted timeline across subsequent visits', async () => {
  const dialog = fixture();
  const unmount = vi.fn();
  const mountHistoryTimeline = vi.fn(() => unmount);
  const load = vi.fn().mockResolvedValue({ mountHistoryTimeline });
  const dispose = installHistoryLoader(load);
  expect(load).not.toHaveBeenCalled();
  dialog.open = true;
  await vi.waitFor(() => expect(mountHistoryTimeline).toHaveBeenCalledOnce());
  expect(document.getElementById('history-content')!.hidden).toBe(false);
  dialog.open = false;
  dialog.open = true;
  await Promise.resolve();
  expect(load).toHaveBeenCalledOnce();
  dispose();
  expect(unmount).toHaveBeenCalledOnce();
  document.body.innerHTML = '';
});

it('offers a working retry when the lazy module cannot be downloaded', async () => {
  const dialog = fixture();
  dialog.open = true;
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

it('does not mount a delayed import after the page has been disposed', async () => {
  const dialog = fixture();
  dialog.open = true;
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
