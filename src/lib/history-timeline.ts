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

/** A click-through landscape, using the same sourced copy as the archived design. */
export function mountHistoryTimeline(host: HTMLElement) {
  let current = 0;
  const root = element('section', 'history-timeline');
  root.setAttribute('aria-label', 'Illustrated history of Ogmore Castle and its valley');
  const window = element('div', 'history-window');
  const track = element('div', 'history-track');
  window.append(track);

  const slides = content.milestones.map((milestone, index) => {
    const slide = element('article', 'history-slide');
    const headingId = `history-chapter-${milestone.id}`;
    slide.setAttribute('aria-labelledby', headingId);
    const painting = element('img', 'history-painting');
    painting.src = paintings[milestone.image];
    painting.alt = milestone.artLabel;
    painting.width = milestone.image === 'stone-castle' ? 1672 : 1024;
    painting.height = milestone.image === 'stone-castle' ? 941 : 576;
    painting.decoding = 'async';
    painting.loading = index === 0 ? 'eager' : 'lazy';
    const caption = element('div', 'history-caption');
    const title = element('h3', '', milestone.title);
    title.id = headingId;
    caption.append(
      element('p', 'history-category', milestone.category),
      element('p', 'history-period', milestone.date),
      title,
      element('p', 'history-summary', milestone.summary),
      sourceLinks(milestone.sources.slice(0, 2)),
    );
    slide.append(painting, caption, element('p', 'history-art-label', milestone.artLabel));
    track.append(slide);
    return slide;
  });

  const controls = element('div', 'history-controls');
  const previous = element('button', '', '← Previous');
  const next = element('button', '', 'Next →');
  previous.type = next.type = 'button';
  const counter = element('span', 'history-count');
  controls.append(previous, counter, next);

  const dates = element('ol', 'history-dates');
  dates.setAttribute('aria-label', 'Choose a historical milestone');
  const dateButtons = content.milestones.map((milestone, index) => {
    const item = element('li');
    const button = element('button', '', milestone.shortDate);
    button.type = 'button';
    button.dataset.historyIndex = String(index);
    button.setAttribute('aria-label', `${milestone.date}: ${milestone.title}`);
    item.append(button);
    dates.append(item);
    return button;
  });
  const jumpLabel = element('label', 'history-jump', 'Jump to a milestone');
  const jump = element('select');
  content.milestones.forEach((milestone, index) => {
    const option = element('option', '', `${milestone.shortDate} · ${milestone.title}`);
    option.value = String(index);
    jump.append(option);
  });
  jumpLabel.append(jump);

  const announcement = element('p', 'sr-only');
  announcement.setAttribute('aria-live', 'polite');
  const notes = element('details', 'history-notes');
  notes.append(element('summary', '', 'Read this chapter & its sources'));
  const noteCopy = element('div', 'history-note-copy');
  notes.append(noteCopy);
  const legend = element('details', 'history-notes');
  legend.append(element('summary', '', 'Beside the history: a local legend'));
  const legendCopy = element('div', 'history-note-copy');
  legendCopy.append(
    element('p', 'history-category', content.legend.label),
    element('h3', '', content.legend.title),
    element('p', '', content.legend.text),
    element('p', 'history-date-note', content.legend.note),
    sourceLinks(content.legend.sources),
  );
  legend.append(legendCopy);
  root.append(window, controls, dates, jumpLabel, announcement, notes, legend);

  function render(announce = false) {
    const milestone = content.milestones[current];
    track.style.transform = `translateX(${-100 * current}%)`;
    slides.forEach((slide, index) => {
      slide.inert = index !== current;
      slide.setAttribute('aria-hidden', String(index !== current));
    });
    dateButtons.forEach((button, index) => {
      if (index === current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    jump.value = String(current);
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
    noteCopy.replaceChildren(
      element('p', '', milestone.context),
      element('p', 'history-date-note', milestone.dateNote),
      sourceLinks(milestone.sources),
    );
    if (announce) announcement.textContent = `Milestone ${current + 1} of ${slides.length}. ${milestone.date}. ${milestone.title}`;
  }
  function select(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= slides.length) return;
    current = index;
    render(true);
  }
  function click(event: MouseEvent) {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button === previous) select(current - 1);
    else if (button === next) select(current + 1);
    else if (button.dataset.historyIndex !== undefined) select(Number(button.dataset.historyIndex));
  }
  function change() { select(Number(jump.value)); }
  function keydown(event: KeyboardEvent) {
    if (!(event.target instanceof HTMLButtonElement) || event.altKey || event.ctrlKey || event.metaKey) return;
    const index = event.key === 'ArrowRight' ? current + 1 : event.key === 'ArrowLeft' ? current - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : undefined;
    if (index === undefined) return;
    event.preventDefault();
    select(index);
    if (event.target.disabled) (current === 0 ? next : previous).focus();
  }
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  jump.addEventListener('change', change);
  host.replaceChildren(root);
  render();
  return () => {
    root.removeEventListener('click', click);
    root.removeEventListener('keydown', keydown);
    jump.removeEventListener('change', change);
    root.remove();
  };
}
