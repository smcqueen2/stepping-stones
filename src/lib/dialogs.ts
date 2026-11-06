/** Native dialogs retain focus trapping, Escape and return-to-trigger behaviour. */
export function installDialogs(): () => void {
  const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog.app-dialog'));
  let active: HTMLDialogElement | undefined;
  function sync(): void {
    const target = dialogs.find(dialog => `#${dialog.id}` === location.hash);
    if (active === target) return;
    const previous = active;
    active = target;
    previous?.close();
    if (target && !target.open) target.showModal();
  }
  function click(event: MouseEvent): void {
    const target = event.target as Element;
    const settings = document.querySelector<HTMLDetailsElement>('.scene-settings[open]');
    if (settings && !settings.contains(target)) settings.open = false;
    const link = target.closest<HTMLAnchorElement>('a[data-open-dialog]');
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
      event.preventDefault();
      history.pushState(null, '', link.hash);
      sync();
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
    history.replaceState(null, '', `${location.pathname}${location.search}#top`);
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
