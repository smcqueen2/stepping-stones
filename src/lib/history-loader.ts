type HistoryModule = { mountHistoryTimeline: (host: HTMLElement) => () => void };

/** Keep the researched content, styles and paintings off the landing-page request path. */
export function installHistoryLoader(loadModule: () => Promise<HistoryModule> = () => import('./history-timeline')) {
  const dialog = document.querySelector<HTMLDialogElement>('#history');
  const host = document.getElementById('history-content');
  const status = document.getElementById('history-loading');
  const retry = document.getElementById('history-retry');
  if (!dialog || !host || !status || !retry) return () => {};
  let pending = false;
  let mounted = false;
  let disposed = false;
  let disposeView: (() => void) | undefined;

  async function load() {
    if (disposed || pending || mounted || !dialog!.open) return;
    pending = true;
    retry!.hidden = true;
    status!.hidden = false;
    host!.hidden = true;
    status!.textContent = 'Loading the illustrated timeline…';
    try {
      const module = await loadModule();
      if (disposed || !dialog!.open) return;
      disposeView = module.mountHistoryTimeline(host!);
      mounted = true;
      host!.hidden = false;
      status!.hidden = true;
    } catch {
      if (!disposed) {
        status!.textContent = 'The history view couldn’t be loaded. Please try again.';
        retry!.hidden = false;
      }
    } finally {
      pending = false;
      // A close/reopen while the import was pending can otherwise miss its open event.
      if (!disposed && !mounted && dialog!.open && retry!.hidden) void load();
    }
  }
  const observer = new MutationObserver(() => { if (dialog.open) void load(); });
  observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  retry.addEventListener('click', load);
  if (dialog.open) void load();
  return () => {
    disposed = true;
    observer.disconnect();
    retry.removeEventListener('click', load);
    disposeView?.();
  };
}
