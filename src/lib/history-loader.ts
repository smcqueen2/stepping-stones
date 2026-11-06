type HistoryModule = { mountHistoryTimeline: (host: HTMLElement) => () => void };

/** Keep the researched content, styles and paintings off the landing-page request path. */
export function installHistoryLoader(loadModule: () => Promise<HistoryModule> = () => import('./history-timeline')) {
  const page = document.getElementById('history');
  const host = document.getElementById('history-content');
  const status = document.getElementById('history-loading');
  const retry = document.getElementById('history-retry');
  if (!page || !host || !status || !retry) return () => {};
  let pending = false;
  let mounted = false;
  let disposed = false;
  let disposeView: (() => void) | undefined;

  async function load() {
    if (disposed || pending || mounted || page!.hidden) return;
    pending = true;
    retry!.hidden = true;
    status!.hidden = false;
    host!.hidden = true;
    status!.textContent = 'Loading the illustrated timeline…';
    try {
      const module = await loadModule();
      if (disposed || page!.hidden) return;
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
      // Navigating away and back during the import can otherwise miss its visibility event.
      if (!disposed && !mounted && !page!.hidden && retry!.hidden) void load();
    }
  }
  const observer = new MutationObserver(() => { if (!page.hidden) void load(); });
  observer.observe(page, { attributes: true, attributeFilter: ['hidden'] });
  retry.addEventListener('click', load);
  if (!page.hidden) void load();
  return () => {
    disposed = true;
    observer.disconnect();
    retry.removeEventListener('click', load);
    disposeView?.();
  };
}
