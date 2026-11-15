import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPlaceIndex, parseClaim, searchPlaces } from '../src/claim/parse.js';
import { checkArea, checkClaim } from '../src/claim/evaluate.js';
import { claimSentence } from '../src/claim/vocab.js';

const load = async (f) => JSON.parse(await readFile(new URL(`../public/data/${f}`, import.meta.url)));
const regions = await load('regions.json');
const checks = await load('checks.json');
const index = buildPlaceIndex(regions);

test('parses everyday claims into place, record and type', () => {
  const cases = [
    ['Rain in Pakistan is getting more erratic', 'Pakistan', 'PRECTOTCORR', 'wilder'],
    ['Is London getting hotter?', 'London', 'T2M', 'up'],
    ['Australia rainfall is becoming steadier', 'Australia', 'PRECTOTCORR', 'steadier'],
    ['Droughts are getting worse in Kenya', 'Kenya', 'GWETTOP', 'down'],
    ['the sahara is getting dustier', null, 'dust', 'up'],
    ['Temperatures in Brazil are swinging more', 'Brazil', 'T2M', 'wilder'],
    ['air pollution in China is falling', 'China', 'aerosol', 'down'],
  ];
  for (const [text, place, record, type] of cases) {
    const p = parseClaim(text, index);
    if (place) assert.equal(p.place?.label, place, text);
    assert.equal(p.record, record, text);
    assert.equal(p.type, type, text);
  }
});

test('country claims cover every study area in that country', () => {
  const p = parseClaim('rain in australia', index);
  assert.equal(p.place.kind, 'country');
  assert.equal(p.place.ids.length, regions.filter((r) => r.country === 'Australia').length);
});

test('search suggests places as you type', () => {
  const hits = searchPlaces(index, 'paki');
  assert.equal(hits[0].label, 'Pakistan');
});

test('verdicts follow the stored statistics exactly', () => {
  for (const record of ['T2M', 'PRECTOTCORR', 'GWETTOP']) {
    const c = checks.records[record];
    for (let i = 0; i < regions.length; i++) {
      const a = checkArea(checks, i, record, 'up');
      if (c.avg_slope[i] === null) assert.equal(a.verdict, 'no_data');
      else if (c.avg_q[i] >= checks.alpha) assert.equal(a.verdict, 'not_shown');
      else assert.equal(a.verdict, c.avg_slope[i] > 0 ? 'backed' : 'opposite');
      const w = checkArea(checks, i, record, 'wilder');
      if (c.swing_pct[i] !== null && c.swing_q[i] < checks.alpha) assert.equal(w.verdict, c.swing_pct[i] > 0 ? 'backed' : 'opposite');
    }
  }
});

test('the flip example: flat average, wilder swings', () => {
  const i = regions.findIndex((r) => r.name.startsWith('Pasni'));
  assert.ok(i >= 0);
  const a = checkArea(checks, i, 'PRECTOTCORR', 'wilder');
  assert.equal(a.verdict, 'backed');
  assert.equal(a.average.significant, false);
  assert.ok(a.typicalSwing.late > a.typicalSwing.early);
});

test('a country can split both ways', () => {
  const ids = regions.flatMap((r, i) => (r.country === 'Australia' ? [i] : []));
  const res = checkClaim(checks, ids, 'PRECTOTCORR', 'wilder');
  assert.equal(res.overall, 'depends');
  assert.ok(res.counts.backed >= 1 && res.counts.opposite >= 1);
});

test('claim sentences read naturally', () => {
  assert.equal(claimSentence('PRECTOTCORR', 'wilder', 'Pakistan'), 'Rain in Pakistan is getting more erratic');
  assert.equal(claimSentence('T2M', 'up', 'London'), 'Temperature in London is getting hotter');
});
