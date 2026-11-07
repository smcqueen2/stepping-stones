// @vitest-environment jsdom
import { gaugeSeries, recentLevels } from '../../scripts/lib/recent-levels.mjs';
import { levelLine, renderLevelGraphs } from '../../src/lib/level-graphs';
import type { LevelPoint, LivePayload } from '../../src/lib/types';
import { monitoringFixture } from '../fixtures/monitoring';

const now = Date.parse('2026-11-07T12:00:00Z');
const iso = (minutes: number) => new Date(now + minutes * 60000).toISOString();
const point = (minutes: number, value: number): LevelPoint => ({ time: iso(minutes), value });

describe('observed level history', () => {
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
});
