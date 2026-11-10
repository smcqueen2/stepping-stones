// @vitest-environment jsdom
import { gaugeSeries, recentLevels } from '../../scripts/lib/recent-levels.mjs';
import { levelLine, renderLevelGraphs } from '../../src/lib/level-graphs';
import type { LevelPoint, LivePayload } from '../../src/lib/types';
import { monitoringFixture } from '../fixtures/monitoring';

const now = Date.parse('2026-11-07T12:00:00Z');
const iso = (minutes: number) => new Date(now + minutes * 60000).toISOString();
const point = (minutes: number, value: number): LevelPoint => ({ time: iso(minutes), value });

describe('observed level history', () => {
  it('sorts mixed timestamp formats by their actual instant and retains stable duplicates and bucket choices', () => {
    const series = gaugeSeries({ data: [
      { x: '2026-11-07T12:00:00+01:00', y: '.3' },
      { x: '2026-11-07T10:59:00Z', y: '-.1' },
      { x: '2026-11-07T11:00:00Z', y: 0 },
      { x: '2026-11-07T11:01:00Z', y: '.4' },
    ] });
    expect(series.map((p: LevelPoint) => p.value)).toEqual([-.1, .3, 0, .4]);
    expect(series.every((p: LevelPoint) => Object.keys(p).sort().join(',') === 'time,value')).toBe(true);
    expect(recentLevels(series, [], iso(0)).river).toEqual([
      { time: '2026-11-07T10:59:00Z', value: -.1 }, { time: '2026-11-07T11:01:00Z', value: .4 },
    ]);
  });
  it('retains genuine zero/negative readings but never converts missing values into zero', () => {
    const data = [null, '', ' ', undefined, 'bad', Infinity, 0, '-2.5', .4].map((y, i) => ({ x: iso(-i), y }));
    expect(gaugeSeries({ data })).toEqual([point(-8, .4), point(-7, -2.5), point(-6, 0)]);
    expect(gaugeSeries({ data: [{ x: 'bad', y: .5 }] })).toEqual([]);
  });
  it('uses only actual readings in the previous twelve hours, with bounded sampling and no future points', () => {
    const river = Array.from({ length: 1500 }, (_, i) => point(i - 1490, i / 1000));
    const data = recentLevels(river, [], iso(0));
    expect(data.from).toBe(iso(-720)); expect(data.to).toBe(iso(0));
    expect(data.river.length).toBeLessThanOrEqual(73);
    expect(data.river.length).toBeGreaterThan(70);
    expect(data.river.every((p: LevelPoint) => river.some(original => original.time === p.time && original.value === p.value))).toBe(true);
    expect(data.river.at(-1)).toEqual(point(0, 1.49));
    expect(data.tide).toEqual([]);
  });
});

describe('small line geometry', () => {
  it('uses actual timestamps on a shared time window, retaining empty time before and after readings', () => {
    const graph = levelLine([point(-600, 0), point(-570, -.1)], now - 720 * 60000, now, .1)!;
    expect(graph.paths).toHaveLength(1);
    expect(graph.paths[0]).toMatch(/^M36\.00,7\.00L44\.00,49\.00$/);
    expect(graph.low).toBe(-.1); expect(graph.high).toBe(0);
  });
  it('breaks long gaps and malformed points instead of interpolating across them', () => {
    const points = [point(-150, .4), point(-135, .42), point(-60, .41), point(-45, .42)];
    expect(levelLine(points, now - 720 * 60000, now, .1)!.paths).toHaveLength(2);
    const invalid = [point(-60, .4), point(-45, .41), { time: iso(-30), value: null }, point(-15, .42), point(0, .43)];
    expect(levelLine(invalid, now - 720 * 60000, now, .1)!.paths).toHaveLength(2);
  });
  it('keeps a steady line flat and small river fluctuations small', () => {
    const flat = levelLine([point(-15, .42), point(0, .42)], now - 720 * 60000, now, .1)!;
    expect(flat.paths[0]).toMatch(/,28\.00L.*?,28\.00$/);
    const small = levelLine([point(-15, .42), point(0, .421)], now - 720 * 60000, now, .1)!;
    expect(small.paths[0]).toContain(',28.21L'); expect(small.paths[0]).toContain(',27.79');
  });
  it('rejects missing/singleton, reversed, duplicated or unbounded series and time domains', () => {
    for (const points of [undefined, [], [point(0, .4)], [point(0, .4), point(-15, .5)], [point(0, .4), point(0, .5)], Array(101).fill(point(0, .4))]) {
      expect(levelLine(points, now - 720 * 60000, now, .1)).toBeUndefined();
    }
    expect(levelLine([point(-15, .4), point(0, .5)], now, now - 1, .1)).toBeUndefined();
  });
  it('plots reference levels and observations on the same scale without calling the references observed extrema', () => {
    const graph = levelLine([point(-15, .27), point(0, .28)], now - 720 * 60000, now, .1, { low: .203, high: .538 })!;
    expect(graph.low).toBe(.27); expect(graph.high).toBe(.28);
    expect(graph.reference).toMatchObject({ low: .203, high: .538 });
    expect(graph.reference!.lowY).toBeCloseTo(64); expect(graph.reference!.highY).toBeCloseTo(12);
    const values = [...graph.paths[0].matchAll(/,([\d.]+)/g)].map(match => Number(match[1]));
    expect(values.every(y => y > 12 && y < 64)).toBe(true);
  });
  it('keeps readings outside the reference band visible rather than clamping them onto it', () => {
    for (const values of [[.8, 1.2], [.1, .15]]) {
      const graph = levelLine(values.map((value, index) => point(-15 + index * 15, value)), now - 720 * 60000, now, .1, { low: .203, high: .538 })!;
      const plotted = [...graph.paths[0].matchAll(/,([\d.]+)/g)].map(match => Number(match[1]));
      expect(plotted.every(y => y >= 12 && y <= 64)).toBe(true);
      expect(graph.reference!.highY).toBeGreaterThanOrEqual(12);
      expect(graph.reference!.lowY).toBeLessThanOrEqual(64);
      expect(plotted.every(y => values[0] > .538 ? y < graph.reference!.highY : y > graph.reference!.lowY)).toBe(true);
    }
  });
  it('ignores invalid reference ranges without losing the observed line', () => {
    const points = [point(-15, .27), point(0, .28)];
    const plain = levelLine(points, now - 720 * 60000, now, .1)!;
    for (const range of [{ low: NaN, high: 1 }, { low: .2, high: Infinity }, { low: .5, high: .2 }, { low: .2, high: .2 }]) {
      const graph = levelLine(points, now - 720 * 60000, now, .1, range)!;
      expect(graph.reference).toBeUndefined(); expect(graph.paths).toEqual(plain.paths);
    }
  });
});

describe('level graph rendering', () => {
  const live = (): LivePayload => ({ sourceStations: [
    { role: 'river', source: 'NRW', stationId: 4083, stationTitle: 'Ogmore at Bridgend', parameterId: 110 },
    { role: 'tide', source: 'NRW', stationId: 72839, stationTitle: 'Newport tide gauge', parameterId: 10254 },
  ], recentLevels: { from: iso(-720), to: iso(0), river: [point(-30, .4), point(-15, .42)], tide: [point(-30, -3), point(-15, -2)] } } as LivePayload);
  beforeEach(() => { document.body.innerHTML = '<div id="river-level-graph"></div><div id="tide-level-graph"></div>'; });
  afterEach(() => { document.body.innerHTML = ''; });
  it('renders observed lines with accessible gauge/source/units and local time labels', () => {
    renderLevelGraphs(live(), true, false, now);
    expect(document.querySelectorAll('svg path')).toHaveLength(2);
    const tide = document.querySelector('#tide-level-graph svg')!;
    expect(tide.getAttribute('aria-label')).toContain('Regional tide level at Newport tide gauge');
    expect(tide.getAttribute('aria-label')).toContain('metres above Ordnance Datum');
    expect(tide.getAttribute('aria-label')).toContain('Last reading 11:45');
    expect(document.querySelector('#tide-level-graph .level-graph-source')!.textContent).toContain('Newport · regional');
    expect([...document.querySelectorAll('#river-level-graph time')].map(node => node.textContent)).toEqual(['00:00', '12:00']);
  });
  it('clears old paths on stale/missing history and keeps other valid series independent', () => {
    const data = live(); renderLevelGraphs(data, true, false, now);
    data.recentLevels!.tide = [];
    renderLevelGraphs(data, true, false, now);
    expect(document.querySelectorAll('#river-level-graph path')).toHaveLength(1);
    expect(document.querySelector('#tide-level-graph')!.textContent).toBe('History unavailable');
    renderLevelGraphs(data, false, true, now);
    expect(document.querySelectorAll('svg')).toHaveLength(0);
    expect(document.querySelector('#river-level-graph')!.textContent).toBe('History out of date');
    renderLevelGraphs(undefined, false, false, now);
    expect(document.querySelector('#river-level-graph')!.textContent).toBe('Loading recent levels…');
    renderLevelGraphs(undefined, false, false, now, 120, false);
    expect(document.querySelector('#river-level-graph')!.textContent).toBe('History unavailable');
  });
  it('refuses old or future observations even if the caller marks the headline fresh', () => {
    const data = live();
    data.recentLevels!.river = [point(-150, .4), point(-135, .42)];
    renderLevelGraphs(data, true, false, now);
    expect(document.querySelector('#river-level-graph svg')).toBeNull();
    expect(document.querySelector('#tide-level-graph svg')).not.toBeNull();
    data.recentLevels!.to = iso(20);
    renderLevelGraphs(data, true, false, now);
    expect(document.querySelectorAll('svg')).toHaveLength(0);
    data.recentLevels!.to = iso(0); data.recentLevels!.from = iso(-360);
    renderLevelGraphs(data, true, false, now);
    expect(document.querySelectorAll('svg')).toHaveLength(0);
  });
  it('renders Ewenny independently of unavailable model gauges and never falls back to a different river', () => {
    const river = monitoringFixture(now).gauges.ewenny;
    renderLevelGraphs(live(), false, true, now, 120, false, river);
    expect(document.querySelector('#river-level-graph svg')!.getAttribute('aria-label')).toContain('Ewenny at Keepers Lodge');
    expect(document.querySelector('#tide-level-graph svg')).toBeNull();
    renderLevelGraphs(live(), true, false, now, 120, false, null);
    expect(document.querySelector('#river-level-graph svg')).toBeNull();
    expect(document.querySelector('#tide-level-graph svg')).not.toBeNull();
  });
  it('adds the official year-round range only to the matching local river, with provenance and readable labels', () => {
    const river = monitoringFixture(now).gauges.ewenny;
    renderLevelGraphs(live(), true, false, now, 120, false, river);
    expect(document.querySelectorAll('#river-level-graph line.level-graph-reference')).toHaveLength(2);
    expect(document.querySelectorAll('#tide-level-graph .level-graph-reference')).toHaveLength(0);
    expect([...document.querySelectorAll('#river-level-graph .level-graph-reference-label')].map(label => label.textContent))
      .toEqual(['Typical high 0.538m', 'Typical low 0.203m']);
    const description = document.querySelector('#river-level-graph svg')!.getAttribute('aria-label')!;
    expect(description).toContain('Observed range 0.260 to 0.270');
    expect(description).toContain('NRW year-round typical low 0.203 and high 0.538');
    expect(description).toContain('not monthly averages or crossing-safety thresholds');
    expect(document.querySelector<HTMLAnchorElement>('#river-level-graph a')!.href)
      .toBe('https://rivers-and-seas.naturalresources.wales/Station/4099?parameterType=1');
    expect(document.querySelector('#river-level-graph .level-graph-source')!.textContent).toContain('all year');
    expect(river.value).toBe(.27);
  });
  it('clears references on stale local readings and does not lend them to the old model station', () => {
    const river = monitoringFixture(now).gauges.ewenny;
    renderLevelGraphs(live(), true, false, now, 120, false, river);
    river.observedAt = iso(-150);
    renderLevelGraphs(live(), true, false, now, 120, false, river);
    expect(document.querySelector('#river-level-graph svg')).toBeNull();
    expect(document.querySelector('#river-level-graph .level-graph-reference-label')).toBeNull();
    expect(document.querySelector('#river-level-graph')!.getAttribute('data-reference')).toBeNull();
    renderLevelGraphs(live(), true, false, now);
    expect(document.querySelector('#river-level-graph svg')).not.toBeNull();
    expect(document.querySelector('#river-level-graph .level-graph-reference')).toBeNull();
    expect(document.querySelector('#tide-level-graph svg')!.getAttribute('viewBox')).toBe('0 0 200 56');
  });
});
