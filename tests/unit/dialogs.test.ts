// @vitest-environment jsdom
import { installDialogs } from '../../src/lib/dialogs';

it('switches hash-addressed dialogs and returns to the scene when closed', () => {
  history.replaceState(null, '', '#top');
  document.body.innerHTML = `<a href="#about" data-open-dialog>About</a>
    <dialog id="about" class="app-dialog"><a href="#history" data-open-dialog>History</a></dialog>
    <dialog id="history" class="app-dialog"><button data-close-dialog>Close</button></dialog>`;
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.showModal = vi.fn(() => { dialog.setAttribute('open', ''); });
    dialog.close = vi.fn(() => { dialog.removeAttribute('open'); dialog.dispatchEvent(new Event('close')); });
  });
  const dispose = installDialogs();
  document.querySelector<HTMLAnchorElement>('a')!.click();
  expect(location.hash).toBe('#about');
  expect(document.querySelector<HTMLDialogElement>('#about')!.open).toBe(true);
  document.querySelector<HTMLAnchorElement>('dialog a')!.click();
  expect(document.querySelector<HTMLDialogElement>('#about')!.open).toBe(false);
  expect(document.querySelector<HTMLDialogElement>('#history')!.open).toBe(true);
  document.querySelector<HTMLButtonElement>('button')!.click();
  expect(location.hash).toBe('#top');
  dispose(); document.body.innerHTML = '';
});
