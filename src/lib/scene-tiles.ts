/** Expand supporting information in place without hiding current advice or warnings. */
export function installSceneTiles() {
  function setExpanded(button: HTMLButtonElement, expanded: boolean) {
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    if (!panel) return;
    if (expanded) {
      document.querySelectorAll<HTMLButtonElement>('[data-tile-toggle][aria-expanded="true"]').forEach(other => {
        if (other !== button) setExpanded(other, false);
      });
    }
    button.setAttribute('aria-expanded', String(expanded));
    panel.hidden = !expanded;
    button.querySelector<HTMLElement>('[data-tile-more]')?.toggleAttribute('hidden', expanded);
    button.querySelector<HTMLElement>('[data-tile-less]')?.toggleAttribute('hidden', !expanded);
    button.closest<HTMLElement>('.outlook-card, .water-level')?.setAttribute('data-expanded', String(expanded));
  }
  function click(event: MouseEvent) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-tile-toggle]');
    if (button) setExpanded(button, button.getAttribute('aria-expanded') !== 'true');
  }
  function keydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !(event.target instanceof Element)) return;
    const tile = event.target.closest('.outlook-card, .water-level');
    const button = tile?.querySelector<HTMLButtonElement>('[data-tile-toggle][aria-expanded="true"]');
    if (!button) return;
    event.preventDefault();
    setExpanded(button, false);
    button.focus();
  }
  document.addEventListener('click', click);
  document.addEventListener('keydown', keydown);
  return () => {
    document.removeEventListener('click', click);
    document.removeEventListener('keydown', keydown);
  };
}
