// @vitest-environment jsdom
import { installNavigation } from '../../src/lib/navigation';

let dispose: () => void;
beforeEach(() => {
  history.replaceState(null, '', '#top');
  document.body.innerHTML = `<a class="skip-link" href="#top">Skip</a>
    <a class="brand" href="#top" data-open-page>Home</a>
    <nav class="section-nav"><a href="#about" data-open-page>About</a><a href="#history" data-open-page>History</a><a href="#report" data-open-dialog>Report</a></nav>
    <main tabindex="-1"><section data-page-view="top"><div id="crossing-outlook" tabindex="-1">Crossing</div><a href="#live" data-open-dialog>Readings</a></section>
    <section id="about" data-page-view="about" hidden><h1 tabindex="-1">About</h1></section>
    <section id="history" data-page-view="history" hidden><h1 tabindex="-1">History</h1></section></main>
    <dialog id="report" class="app-dialog"><button data-close-dialog>Close report</button></dialog>
    <dialog id="live" class="app-dialog"><button data-close-dialog>Close readings</button></dialog>`;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.showModal = vi.fn(() => { dialog.setAttribute('open', ''); });
    dialog.close = vi.fn(() => { dialog.removeAttribute('open'); dialog.dispatchEvent(new Event('close')); });
  });
});
afterEach(() => { dispose?.(); document.body.innerHTML = ''; vi.restoreAllMocks(); });

function link(hash: string) { return document.querySelector<HTMLAnchorElement>(`a[href="${hash}"]:not(.skip-link)`)!; }
function visiblePages() { return [...document.querySelectorAll<HTMLElement>('[data-page-view]')].filter(page => !page.hidden).map(page => page.dataset.pageView); }

it('opens standalone page deep links with the right title, focus and current navigation', () => {
  history.replaceState(null, '', '#history');
  dispose = installNavigation();
  expect(visiblePages()).toEqual(['history']);
  expect(document.querySelector('dialog[open]')).toBeNull();
  expect(document.activeElement).toBe(document.querySelector('#history h1'));
  expect(document.title).toBe('History | Ogmore Stepping Stones');
  expect(link('#history').getAttribute('aria-current')).toBe('page');
});

it('navigates between pages and responds to Back/Forward route events', () => {
  dispose = installNavigation();
  link('#about').click();
  expect(location.hash).toBe('#about');
  link('#history').click();
  expect(visiblePages()).toEqual(['history']);
  history.replaceState(null, '', '#about');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(visiblePages()).toEqual(['about']);
  expect(document.title).toBe('About | Ogmore Stepping Stones');
  expect(document.activeElement).toBe(document.querySelector('#about h1'));
  link('#top').click();
  expect(visiblePages()).toEqual(['top']);
  expect(document.activeElement?.id).toBe('crossing-outlook');
  expect(document.title).toBe('Ogmore Stepping Stones | Local Crossing Guide');
});

it('keeps Report modal and returns to its originating page when closed', () => {
  dispose = installNavigation();
  link('#about').click();
  link('#report').click();
  expect(location.hash).toBe('#report');
  expect(document.querySelector<HTMLDialogElement>('#report')!.open).toBe(true);
  expect(visiblePages()).toEqual(['about']);
  document.querySelector<HTMLButtonElement>('#report button')!.click();
  expect(location.hash).toBe('#about');
  expect(visiblePages()).toEqual(['about']);
  expect(document.querySelector('dialog[open]')).toBeNull();
});

it('does not replace a page route when Back closes a dialog', () => {
  dispose = installNavigation();
  link('#about').click(); link('#report').click();
  history.replaceState(null, '', '#history');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(location.hash).toBe('#history');
  expect(document.querySelector('dialog[open]')).toBeNull();
  expect(visiblePages()).toEqual(['history']);
});

it('keeps a direct Report link on the crossing and supports the shared skip link', () => {
  history.replaceState(null, '', '#report');
  dispose = installNavigation();
  expect(visiblePages()).toEqual(['top']);
  document.querySelector<HTMLButtonElement>('#report button')!.click();
  expect(location.hash).toBe('#top');
  link('#about').click();
  document.querySelector<HTMLAnchorElement>('.skip-link')!.click();
  expect(document.activeElement?.tagName).toBe('MAIN');
  expect(location.hash).toBe('#about');
  expect(visiblePages()).toEqual(['about']);
});

it('leaves modified page-link clicks available for opening a new tab', () => {
  dispose = installNavigation();
  const event = new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true });
  link('#about').dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(visiblePages()).toEqual(['top']);
});
