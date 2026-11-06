/** Hash routes work on static hosting; only readings, forecast and reporting use dialogs. */
export function installNavigation(): () => void {
  const pages = Array.from(document.querySelectorAll<HTMLElement>('[data-page-view]'));
  const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog.app-dialog'));
  const navLinks = document.querySelectorAll<HTMLAnchorElement>('.section-nav a, .brand');
  const main = document.querySelector<HTMLElement>('main');
  const homeTitle = 'Ogmore Stepping Stones | Local Crossing Guide';
  let currentPage: HTMLElement | undefined;
  let active: HTMLDialogElement | undefined;
  let returnHash = '#top';

  function sync(): void {
    const requestedPage = pages.find(page => `#${page.dataset.pageView}` === location.hash);
    const target = dialogs.find(dialog => `#${dialog.id}` === location.hash);
    // Modal routes retain the page beneath them, including when reached with Back/Forward.
    const page = requestedPage ?? (target ? currentPage : undefined) ?? pages[0];
    if (active !== target) {
      const previous = active;
      active = target;
      previous?.close();
    }
    if (page && currentPage !== page) {
      currentPage = page;
      pages.forEach(view => { view.hidden = view !== page; });
      const name = page.dataset.pageView!;
      document.body.dataset.view = name;
      document.title = name === 'top' ? homeTitle : `${name === 'history' ? 'History' : 'About'} | Ogmore Stepping Stones`;
      navLinks.forEach(link => {
        if (link.hash === `#${name}`) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      document.querySelector<HTMLDetailsElement>('.scene-settings[open]')?.removeAttribute('open');
      window.scrollTo(0, 0);
      if (requestedPage && !target) {
        const focusTarget = name === 'top' ? document.getElementById('crossing-outlook') : page.querySelector<HTMLElement>('h1');
        focusTarget?.focus({ preventScroll: true });
      }
    }
    if (target && !target.open) target.showModal();
  }

  function click(event: MouseEvent): void {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    const settings = document.querySelector<HTMLDetailsElement>('.scene-settings[open]');
    if (settings && !settings.contains(target)) settings.open = false;
    const link = target.closest<HTMLAnchorElement>('a[data-open-page], a[data-open-dialog], a.skip-link');
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      if (link.classList.contains('skip-link')) {
        event.preventDefault();
        main?.focus();
        return;
      }
      const isPage = pages.some(page => `#${page.dataset.pageView}` === link.hash);
      const isDialog = dialogs.some(dialog => `#${dialog.id}` === link.hash);
      if (isPage || isDialog) {
        event.preventDefault();
        if (isDialog && !active) returnHash = `#${currentPage?.dataset.pageView ?? 'top'}`;
        if (location.hash !== link.hash) history.pushState(null, '', link.hash);
        sync();
      }
    }
    if (target.closest('[data-close-dialog]')) target.closest<HTMLDialogElement>('dialog')?.close();
    if (target instanceof HTMLDialogElement && target.open) {
      const box = target.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) target.close();
    }
  }

  function closed(event: Event): void {
    if (active !== event.target) return;
    active = undefined;
    history.replaceState(null, '', `${location.pathname}${location.search}${returnHash}`);
    sync();
  }

  function keydown(event: KeyboardEvent): void {
    const settings = document.querySelector<HTMLDetailsElement>('.scene-settings[open]');
    if (event.key === 'Escape' && settings) {
      settings.open = false;
      settings.querySelector('summary')?.focus();
    }
  }
  document.addEventListener('click', click);
  document.addEventListener('keydown', keydown);
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
  dialogs.forEach(dialog => dialog.addEventListener('close', closed));
  sync();
  return () => {
    document.removeEventListener('click', click);
    document.removeEventListener('keydown', keydown);
    window.removeEventListener('hashchange', sync);
    window.removeEventListener('popstate', sync);
    dialogs.forEach(dialog => dialog.removeEventListener('close', closed));
    active?.close();
  };
}
