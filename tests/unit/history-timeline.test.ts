// @vitest-environment jsdom
import content from '../../docs/design/historical-timeline/timeline-content.json';
import { mountHistoryTimeline } from '../../src/lib/history-timeline';

it('keeps the selected chapter, painting, sources and accessible slide in sync', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const dispose = mountHistoryTimeline(host);
  const slides = [...host.querySelectorAll<HTMLElement>('.history-slide')];
  const jump = host.querySelector('select')!;
  expect(slides).toHaveLength(12);

  content.milestones.forEach((milestone, index) => {
    jump.value = String(index);
    jump.dispatchEvent(new Event('change', { bubbles: true }));
    expect(host.querySelector('.history-count')!.textContent).toBe(`${String(index + 1).padStart(2, '0')} / 12`);
    expect(slides.filter(slide => slide.getAttribute('aria-hidden') === 'false')).toEqual([slides[index]]);
    expect(slides[index].inert).toBe(false);
    expect(slides[(index + 1) % slides.length].inert).toBe(true);
    expect(slides[index].querySelector('h3')!.textContent).toBe(milestone.title);
    expect(slides[index].querySelector('img')!.alt).toBe(milestone.artLabel);
    expect(slides[index].querySelector('img')!.getAttribute('src')).not.toContain('undefined');
    const notes = host.querySelector('.history-notes .history-note-copy')!;
    expect(notes.textContent).toContain(milestone.context);
    expect(notes.textContent).toContain(milestone.dateNote);
    const links = [...notes.querySelectorAll('a')];
    expect(links.map(link => link.href)).toEqual(milestone.sources.map(key => content.sources[key as keyof typeof content.sources].url));
    expect(links.every(link => link.protocol === 'https:' && link.rel.includes('noopener'))).toBe(true);
  });
  expect(host.querySelectorAll('.history-notes')[1].textContent).toContain('Local folklore · undated');
  dispose();
  expect(host.childElementCount).toBe(0);
  host.remove();
});

it('bounds previous/next and keyboard navigation without hijacking browser shortcuts', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const dispose = mountHistoryTimeline(host);
  const [previous, next] = host.querySelectorAll<HTMLButtonElement>('.history-controls button');
  expect(previous.disabled).toBe(true);
  next.click();
  expect(host.querySelector('.history-count')!.textContent).toBe('02 / 12');
  next.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  expect(host.querySelector('.history-count')!.textContent).toBe('12 / 12');
  expect(next.disabled).toBe(true);
  previous.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  expect(previous.disabled).toBe(true);
  next.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
  expect(host.querySelector('.history-count')!.textContent).toBe('01 / 12');
  const dates = host.querySelectorAll<HTMLButtonElement>('[data-history-index]');
  dates[9].click();
  expect(dates[9].getAttribute('aria-current')).toBe('step');
  expect(host.querySelector('.history-count')!.textContent).toBe('10 / 12');
  dispose(); host.remove();
});
