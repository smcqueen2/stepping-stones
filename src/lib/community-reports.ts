const conditions = [
  ['Completely submerged', 'Unpassable. All the stones are under water.'],
  ['Mostly submerged', 'Unpassable. Most of the stones are under water.'],
  ['Partly submerged', 'Water is covering some of the stone tops.'],
  ['Mostly clear', 'Most stone tops are visible, with water over a few.'],
  ['Clear and passable', 'The stones are clear of the water.'],
] as const;
const previewMessage = 'Preview only — reports aren’t being collected yet.';

/** Interface preview only. Shared storage and hourly counts are deferred at the owner's request. */
export function installCommunityReports(): () => void {
  const form = document.querySelector<HTMLFormElement>('#observation-form');
  const slider = document.querySelector<HTMLInputElement>('#report-condition');
  const submit = document.querySelector<HTMLButtonElement>('#observation-submit');
  const status = document.getElementById('observation-status');
  if (!form || !slider || !submit || !status) return () => {};
  let chosen = false;
  slider.disabled = false;

  function choose(): void {
    const condition = conditions[Number(slider!.value)];
    if (!condition) return;
    chosen = true;
    slider!.setAttribute('aria-valuetext', `${condition[0]}. ${condition[1]}`);
    document.getElementById('condition-label')!.textContent = condition[0];
    document.getElementById('condition-description')!.textContent = condition[1];
    submit!.disabled = false;
    status!.textContent = previewMessage;
  }

  function preview(event: SubmitEvent): void {
    event.preventDefault();
    if (!chosen) return;
    const condition = conditions[Number(slider!.value)];
    if (!condition) return;
    status!.textContent = `Your selection: ${condition[0].toLowerCase()}. Nothing has been sent.`;
    status!.focus({ preventScroll: true });
  }

  slider.addEventListener('input', choose);
  // Tapping the middle position must also choose it, even when the numeric value hasn't changed.
  slider.addEventListener('click', choose);
  form.addEventListener('submit', preview);
  return () => {
    slider.removeEventListener('input', choose);
    slider.removeEventListener('click', choose);
    form.removeEventListener('submit', preview);
  };
}
