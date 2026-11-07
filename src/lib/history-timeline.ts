import content from '../../docs/design/historical-timeline/timeline-content.json';
import '../history.css';

const paintings: Record<string, string> = {
  dunes: new URL('../../docs/design/historical-timeline/assets/dunes.webp', import.meta.url).href,
  'early-fort': new URL('../../docs/design/historical-timeline/assets/early-fort.webp', import.meta.url).href,
  'stone-castle': new URL('../../docs/design/historical-timeline/reconstruction/ogmore-castle-stepping-stones-view-v2.webp', import.meta.url).href,
  priory: new URL('../../docs/design/historical-timeline/assets/priory.webp', import.meta.url).href,
  'present-castle': new URL('../../docs/design/historical-timeline/assets/present-castle.webp', import.meta.url).href,
};
const sources: Record<string, { name: string; url: string }> = content.sources;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sourceLinks(keys: string[]) {
  const list = element('ul', 'history-sources');
  keys.forEach(key => {
    const source = sources[key];
    const item = element('li');
    const link = element('a', '', source.name);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    list.append(item);
  });
  return list;
}

/** A continuous, normally scrolling story with a floating reading-progress timeline. */
export function mountHistoryTimeline(host: HTMLElement) {
  const page = host.closest<HTMLElement>('[data-page-view]');
  const root = element('section', 'history-timeline');
  root.setAttribute('aria-label', 'Illustrated history of Ogmore Castle and its valley');
  const chapters = element('div', 'history-chapters');
  const articles = content.milestones.map((milestone, index) => {
    const article = element('article', 'history-chapter');
    article.id = `history-period-${milestone.id}`;
    const headingId = `history-chapter-${milestone.id}`;
    article.setAttribute('aria-labelledby', headingId);
    const scene = element('div', 'history-scene');
    const painting = element('img', 'history-painting');
    painting.src = paintings[milestone.image];
    painting.alt = milestone.artLabel;
    painting.width = milestone.image === 'stone-castle' ? 1672 : 1024;
    painting.height = milestone.image === 'stone-castle' ? 941 : 576;
    painting.decoding = 'async';
    painting.loading = index === 0 ? 'eager' : 'lazy';
    const caption = element('div', 'history-caption');
    const title = element('h2', '', milestone.title);
    title.id = headingId;
    title.tabIndex = -1;
    caption.append(
      element('p', 'history-category', milestone.category),
      element('p', 'history-period', milestone.date),
      title,
      element('p', 'history-summary', milestone.summary),
      sourceLinks(milestone.sources.slice(0, 2)),
    );
    scene.append(painting, caption, element('p', 'history-art-label', milestone.artLabel));
    const notes = element('details', 'history-notes');
    notes.append(element('summary', '', 'More about this period & sources'));
    const noteCopy = element('div', 'history-note-copy');
    noteCopy.append(
      element('p', '', milestone.context),
      element('p', 'history-date-note', milestone.dateNote),
      sourceLinks(milestone.sources),
    );
    notes.append(noteCopy);
    article.append(scene, notes);
    chapters.append(article);
    return article;
  });

  const rail = element('aside', 'history-rail');
  const railPanel = element('details', 'history-rail-panel');
  // A narrow-screen overlay starts tucked away so it cannot cover the story on arrival.
  railPanel.open = !window.matchMedia('(max-width: 800px), (max-height: 680px)').matches;
  const railToggle = element('summary', 'history-rail-toggle');
  railToggle.append(element('span', 'history-rail-show', 'Timeline'), element('span', 'history-rail-hide', 'Hide timeline'));
  railPanel.append(railToggle);
  const dates = element('nav', 'history-rail-navigation');
  dates.setAttribute('aria-label', 'History timeline');
  dates.append(element('p', 'history-rail-heading', 'Through time'));
  const dateList = element('ol', 'history-rail-list');
  const dateButtons = content.milestones.map((milestone, index) => {
    const item = element('li');
    const button = element('button');
    button.type = 'button';
    button.dataset.historyIndex = String(index);
    button.setAttribute('aria-label', `${milestone.date}: ${milestone.title}`);
    button.setAttribute('aria-controls', articles[index].id);
    button.append(element('span', 'history-rail-date', milestone.shortDate), element('span', 'history-rail-dot'));
    item.append(button);
    dateList.append(item);
    return button;
  });
  dates.append(dateList);
  // Small-screen dates label every marker; the picker provides larger jump controls.
  const compact = element('div', 'history-rail-compact');
  compact.setAttribute('aria-hidden', 'true');
  const marks = element('div', 'history-rail-marks');
  const compactSteps = content.milestones.map(milestone => {
    const step = element('span', 'history-rail-mark');
    step.append(element('span', 'history-rail-date', milestone.shortDate), element('span', 'history-rail-dot'));
    return step;
  });
  marks.append(...compactSteps);
  compact.append(marks);
  railPanel.append(dates, compact);
  rail.append(railPanel);

  const jumpControl = element('div', 'history-jump');
  const jumpLabel = element('label', '', 'Jump to a period');
  const jump = element('select');
  jump.id = 'history-period-picker';
  jumpLabel.htmlFor = jump.id;
  content.milestones.forEach((milestone, index) => {
    const option = element('option', '', `${milestone.shortDate} · ${milestone.title}`);
    option.value = String(index);
    jump.append(option);
  });
  jumpControl.append(jumpLabel, jump);
  const legend = element('details', 'history-notes history-legend');
  legend.append(element('summary', '', 'Beside the history: a local legend'));
  const legendCopy = element('div', 'history-note-copy');
  legendCopy.append(
    element('p', 'history-category', content.legend.label),
    element('h2', '', content.legend.title),
    element('p', '', content.legend.text),
    element('p', 'history-date-note', content.legend.note),
    sourceLinks(content.legend.sources),
  );
  legend.append(legendCopy);
  root.append(rail, jumpControl, chapters, legend);
  host.replaceChildren(root);
  let current = -1;
  let frame: number | undefined;
  let disposed = false;

  function markCurrent(index: number) {
    if (index === current) return;
    current = index;
    dateButtons.forEach((button, i) => {
      if (i === index) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
      button.dataset.past = String(i < index);
      compactSteps[i].dataset.current = String(i === index);
      compactSteps[i].dataset.past = String(i < index);
    });
    if (document.activeElement !== jump) jump.value = String(index);
  }

  function update() {
    frame = undefined;
    if (disposed || document.hidden || page?.hidden) return;
    const line = Math.min(window.innerHeight * .38, 280);
    const tops = articles.map(article => article.getBoundingClientRect().top);
    let index = 0;
    tops.forEach((top, i) => { if (top <= line) index = i; });
    markCurrent(index);
    const next = tops[index + 1];
    const fraction = next === undefined ? 0 : Math.max(0, Math.min(1, (line - tops[index]) / (next - tops[index])));
    root.style.setProperty('--history-progress', String((index + fraction) / (articles.length - 1)));
  }
  function schedule() {
    if (frame === undefined && !disposed && !document.hidden && !page?.hidden) frame = window.requestAnimationFrame(update);
  }
  function select(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= articles.length) return;
    markCurrent(index);
    articles[index].scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    articles[index].querySelector('h2')?.focus({ preventScroll: true });
    schedule();
  }
  function click(event: MouseEvent) {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-history-index]');
    if (button) select(Number(button.dataset.historyIndex));
  }
  function change() { select(Number(jump.value)); }
  function keydown(event: KeyboardEvent) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || target.dataset.historyIndex === undefined || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const i = Number(target.dataset.historyIndex);
    const index = event.key === 'ArrowDown' ? Math.min(i + 1, dateButtons.length - 1)
      : event.key === 'ArrowUp' ? Math.max(i - 1, 0) : event.key === 'Home' ? 0
      : event.key === 'End' ? dateButtons.length - 1 : undefined;
    if (index === undefined) return;
    event.preventDefault();
    // Moving within the timeline keeps keyboard focus in the timeline; Enter/Space jumps to the chapter.
    dateButtons[index].focus();
  }
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  root.addEventListener('toggle', schedule, true);
  jump.addEventListener('change', change);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('visibilitychange', schedule);
  const visibility = new MutationObserver(schedule);
  if (page) visibility.observe(page, { attributes: true, attributeFilter: ['hidden'] });
  markCurrent(0);
  schedule();
  return () => {
    disposed = true;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    visibility.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', schedule);
    root.removeEventListener('click', click);
    root.removeEventListener('keydown', keydown);
    root.removeEventListener('toggle', schedule, true);
    jump.removeEventListener('change', change);
    root.remove();
  };
}
