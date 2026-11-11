// @vitest-environment jsdom
import content from '../../docs/design/historical-timeline/timeline-content.json';
import { mountHistoryTimeline } from '../../src/lib/history-timeline';

let host: HTMLElement;
let page: HTMLElement;
let dispose: () => void;
let articles: HTMLElement[];
let offset: number;
let reducedMotion: boolean;
let frames: Map<number, FrameRequestCallback>;
const dates = () => [...host.querySelectorAll<HTMLButtonElement>('[data-history-index]')];
const active = () => host.querySelector<HTMLButtonElement>('[data-history-index][aria-current]');
function draw() {
  const pending = [...frames];
  frames.clear();
  pending.forEach(([, callback]) => callback(0));
}
function scrollTo(y: number) { offset = y; window.dispatchEvent(new Event('scroll')); draw(); }
beforeEach(() => {
  document.body.innerHTML = '<section data-page-view="history"><div id="history-content"></div></section>';
  page = document.querySelector('section')!;
  host = document.getElementById('history-content')!;
  frames = new Map();
  offset = 0;
  reducedMotion = false;
  let nextFrame = 0;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reducedMotion })));
  dispose = mountHistoryTimeline(host);
  articles = [...host.querySelectorAll<HTMLElement>('.history-chapter')];
  articles.forEach((article, index) => {
    vi.spyOn(article, 'getBoundingClientRect').mockImplementation(() => ({ top: index * 800 - offset } as DOMRect));
    article.scrollIntoView = vi.fn(() => { offset = index * 800 - 24; });
  });
  draw();
});
afterEach(() => { dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('renders all chapters in normal reading order with their artwork, AI labels, notes and sources', () => {
  expect(articles).toHaveLength(content.milestones.length);
  expect(host.querySelector('.history-track, .history-controls')).toBeNull();
  expect(host.querySelector('select')).toBeNull();
  content.milestones.forEach((milestone, index) => {
    const article = articles[index];
    expect(article.hasAttribute('aria-hidden')).toBe(false);
    expect(article.inert).not.toBe(true);
    expect(article.querySelector('h2')!.textContent).toBe(milestone.title);
    expect(article.querySelector('img')!.alt).toBe(milestone.artLabel);
    expect(article.querySelector('img')!.getAttribute('src')).not.toContain('undefined');
    expect(article.querySelector('.history-art-label')!.textContent).toContain('AI generated');
    const notes = article.querySelector('.history-note-copy')!;
    expect(notes.textContent).toContain(milestone.context);
    expect(notes.textContent).toContain(milestone.dateNote);
    const links = [...notes.querySelectorAll('a')];
    expect(links.map(link => link.href)).toEqual(milestone.sources.map(key => content.sources[key as keyof typeof content.sources].url));
    expect(links.every(link => link.protocol === 'https:' && link.rel.includes('noopener'))).toBe(true);
  });
  expect(host.querySelector('.history-legend')!.textContent).toContain('Local folklore · undated');
});

it('places the new evidence in chronological order and keeps legends out of the dated rail', () => {
  const ids = content.milestones.map(milestone => milestone.id);
  expect(new Set(ids).size).toBe(ids.length);
  const index = (id: string) => { expect(ids).toContain(id); return ids.indexOf(id); };
  expect(index('landscape')).toBeLessThan(index('early-christian'));
  expect(index('early-christian')).toBeLessThan(index('foundation'));
  expect(index('lancaster')).toBeLessThan(index('candleston'));
  expect(index('candleston')).toBeLessThan(index('revolt'));
  expect(index('estate')).toBeLessThan(index('rifle-range'));
  expect(index('rifle-range')).toBeLessThan(index('care'));
  expect(dates()).toHaveLength(content.milestones.length);
  const legends = [...host.querySelectorAll('.history-legend')];
  expect(legends).toHaveLength(2);
  for (const [i, story] of [content.legend, ...content.additionalLegends].entries()) {
    expect(legends[i].textContent).toContain(story.title);
    expect(legends[i].textContent).toContain('Local folklore');
    expect([...legends[i].querySelectorAll('a')].map(link => link.href))
      .toEqual(story.sources.map(key => content.sources[key as keyof typeof content.sources].url));
    expect(dates().some(button => button.textContent?.includes(story.title))).toBe(false);
  }
});

it('follows actual scroll position in both directions without changing focus or hiding chapters', () => {
  const focused = document.activeElement;
  expect(active()).toBe(dates()[0]);
  scrollTo(800 * 5 + 40);
  expect(active()).toBe(dates()[5]);
  expect(active()!.querySelector('.history-rail-date')!.textContent).toBe(content.milestones[5].shortDate);
  expect(Number(host.querySelector<HTMLElement>('.history-timeline')!.style.getPropertyValue('--history-progress'))).toBeGreaterThan(5 / (articles.length - 1));
  expect(document.activeElement).toBe(focused);
  scrollTo(800);
  expect(active()).toBe(dates()[1]);
  scrollTo(800 * (articles.length - 1));
  expect(active()).toBe(dates().at(-1));
  expect(host.querySelector<HTMLElement>('.history-timeline')!.style.getPropertyValue('--history-progress')).toBe('1');
});

it('jumps from timeline dots and date labels, preserves source notes and honours reduced motion', () => {
  dates()[9].click();
  expect(articles[9].scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  expect(document.activeElement).toBe(articles[9].querySelector('h2'));
  draw();
  expect(active()).toBe(dates()[9]);
  reducedMotion = true;
  dates()[3].querySelector('.history-rail-dot')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(articles[3].scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
  draw();
  expect(active()).toBe(dates()[3]);
  expect(articles[9].querySelector('.history-note-copy')!.textContent).toContain(content.milestones[9].context);
});

it('supports vertical keyboard navigation in the rail without intercepting browser shortcuts', () => {
  const buttons = dates();
  buttons[0].focus();
  buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(document.activeElement).toBe(buttons[1]);
  buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  expect(document.activeElement).toBe(buttons.at(-1));
  buttons.at(-1)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, altKey: true }));
  expect(document.activeElement).toBe(buttons.at(-1));
  expect(articles.every(article => vi.mocked(article.scrollIntoView).mock.calls.length === 0)).toBe(true);
});

it('coalesces scrolling, skips hidden views and cleans up observers and scheduled work', async () => {
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
  expect(frames.size).toBe(1);
  page.hidden = true;
  offset = 800 * 7;
  draw();
  expect(active()).toBe(dates()[0]);
  page.hidden = false;
  await Promise.resolve();
  draw();
  expect(active()).toBe(dates()[7]);
  window.dispatchEvent(new Event('scroll'));
  dispose();
  expect(frames.size).toBe(0);
  expect(host.childElementCount).toBe(0);
  window.dispatchEvent(new Event('scroll'));
  expect(frames.size).toBe(0);
});
