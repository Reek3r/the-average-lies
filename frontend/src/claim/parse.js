import { RECORDS, RECORD_ORDER, TYPE_PHRASES } from './vocab.js';

/**
 * Turn a sentence into { place, record, type }. Deterministic: a lookup, not a
 * language model, so the same words always give the same check. Anything it
 * can't find is left null and the interface asks for it.
 */

const COUNTRY_ALIASES = {
  usa: ['united states', 'america', 'the us', 'u.s.', 'us'],
  uk: ['united kingdom', 'britain', 'great britain'],
  russia: ['russian federation'],
  'dr congo': ['democratic republic of the congo', 'drc'],
};

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[`'’]/g, '')
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

const hasWord = (text, phrase) => new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text);

// Province names that are only compass words: "Northern" in Zambia would
// otherwise swallow "northern Kenya".
const GENERIC = new Set(['north', 'south', 'east', 'west', 'northern', 'southern', 'eastern', 'western', 'central', 'north west', 'north east', 'south west', 'south east', 'northwest', 'northeast', 'southwest', 'southeast', 'north-western', 'north-eastern', 'south-western', 'south-eastern', 'upper', 'lower', 'coast', 'centre', 'center']);

// Named regions people use in headlines, as lon/lat boxes [w, s, e, n].
const REGIONS = {
  'the amazon': [-75, -15, -48, 5], amazon: [-75, -15, -48, 5],
  'the sahel': [-18, 10, 40, 18], sahel: [-18, 10, 40, 18],
  'horn of africa': [38, -3, 52, 15], 'east africa': [28, -12, 52, 15],
  'southern africa': [10, -35, 41, -10], 'west africa': [-18, 4, 16, 20],
  'the sahara': [-15, 18, 35, 32], sahara: [-15, 18, 35, 32],
  'the arctic': [-180, 66, 180, 90], arctic: [-180, 66, 180, 90],
  'the himalayas': [72, 26, 98, 36], 'the tibetan plateau': [78, 28, 104, 38],
  'the mediterranean': [-10, 30, 37, 46], 'the middle east': [34, 12, 63, 40],
  'south asia': [60, 5, 98, 36], 'southeast asia': [92, -11, 141, 23],
  'central asia': [46, 35, 88, 55], siberia: [60, 50, 180, 75],
  'the american west': [-125, 31, -102, 49], 'the us southwest': [-120, 31, -103, 38],
};
const COMPASS = [
  ['northern', 'n'], ['southern', 's'], ['eastern', 'e'], ['western', 'w'],
  ['north', 'n'], ['south', 's'], ['east', 'e'], ['west', 'w'], ['central', 'c'],
];

/** Build a search index of places: areas, towns, provinces and countries. */
export function buildPlaceIndex(regions) {
  const groups = new Map(); // key -> { label, kind, ids:Set }
  const add = (key, label, kind, id) => {
    const k = norm(key);
    if (!k || k.length < 3) return;
    if (!groups.has(k)) groups.set(k, { key: k, label, kind, ids: new Set() });
    groups.get(k).ids.add(id);
  };
  regions.forEach((r, i) => {
    add(r.name.replace(/\s*\([NSEW]\)\s*\d*$/, ''), r.name, 'area', i);
    add(r.name, r.name, 'area', i);
    if (r.nearest_place?.distance_km <= 250) {
      add(r.nearest_place.name, r.nearest_place.name, 'town', i);
      if (r.nearest_place.admin1 && !GENERIC.has(norm(r.nearest_place.admin1))) add(r.nearest_place.admin1, r.nearest_place.admin1, 'province', i);
    }
    if (r.country) {
      add(r.country, r.country, 'country', i);
      for (const alias of COUNTRY_ALIASES[norm(r.country)] ?? []) add(alias, r.country, 'country', i);
    }
  });
  for (const [name, [w, so, e, n]] of Object.entries(REGIONS)) {
    regions.forEach((r, i) => {
      if (r.lon >= w && r.lon <= e && r.lat >= so && r.lat <= n) add(name, titleCase(name.replace(/^the /, '')), 'region', i);
    });
  }
  // "northern Australia": the country's areas on that side of its middle
  const byCountry = new Map();
  regions.forEach((r, i) => r.country && (byCountry.get(r.country) ?? byCountry.set(r.country, []).get(r.country)).push(i));
  for (const [country, ids] of byCountry) {
    if (ids.length < 3) continue;
    const lats = ids.map((i) => regions[i].lat).sort((a, b) => a - b);
    const lons = ids.map((i) => regions[i].lon).sort((a, b) => a - b);
    const midLat = (lats[0] + lats.at(-1)) / 2;
    const midLon = (lons[0] + lons.at(-1)) / 2;
    const spanLat = lats.at(-1) - lats[0];
    const spanLon = lons.at(-1) - lons[0];
    for (const [word, side] of COMPASS) {
      const pick = ids.filter((i) => {
        const { lat, lon } = regions[i];
        if (side === 'n') return lat > midLat;
        if (side === 's') return lat < midLat;
        if (side === 'e') return lon > midLon;
        if (side === 'w') return lon < midLon;
        return Math.abs(lat - midLat) <= spanLat / 4 && Math.abs(lon - midLon) <= spanLon / 4;
      });
      if (!pick.length) continue;
      for (const name of [country, ...(COUNTRY_ALIASES[norm(country)] ?? [])]) {
        for (const i of pick) add(`${word} ${name}`, `${titleCase(word.replace(/ern$/, '').replace(/^(north|south|east|west)$/, '$1ern'))} ${country}`, 'region', i);
      }
    }
  }
  const entries = [...groups.values()].map((g) => ({ ...g, ids: [...g.ids] }));
  entries.sort((a, b) => b.key.length - a.key.length);
  return entries;
}

/** Places whose name starts with or contains the query, for the "Where?" box. */
export function searchPlaces(index, query, limit = 8) {
  const q = norm(query);
  if (!q) return [];
  const rank = { country: 0, region: 1, province: 2, area: 3, town: 4 };
  const seen = new Set();
  return index
    .filter((e) => e.key.includes(q))
    .sort((a, b) => (a.key.startsWith(q) ? 0 : 1) - (b.key.startsWith(q) ? 0 : 1) || rank[a.kind] - rank[b.kind] || a.key.length - b.key.length)
    .filter((e) => {
      const id = `${e.kind}:${e.label}:${e.ids.join(',')}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, limit);
}

export function parseClaim(text, index) {
  const t = ` ${norm(text)} `;
  const out = { place: null, record: null, type: null };

  // place: longest name mentioned
  for (const e of index) {
    if (hasWord(t, e.key)) {
      out.place = { label: e.label, kind: e.kind, ids: e.ids };
      break;
    }
  }

  // record: count word hits; "drier soil" beats "drier" alone
  let best = null;
  for (const id of RECORD_ORDER) {
    const r = RECORDS[id];
    const score = r.words.filter((w) => hasWord(t, w)).length * 2 + [...r.upWords, ...r.downWords].filter((w) => hasWord(t, w)).length;
    if (score > 0 && (!best || score > best.score)) best = { id, score };
  }
  if (!best) {
    // bare direction words imply a record ("is it getting hotter?")
    if (['hotter', 'warmer', 'colder', 'cooler', 'warming', 'heatwaves'].some((w) => hasWord(t, w))) best = { id: 'T2M' };
    else if (['wetter', 'drier', 'dryer', 'rainier', 'drying', 'drying out'].some((w) => hasWord(t, w))) best = { id: 'PRECTOTCORR' };
  }
  out.record = best?.id ?? null;

  // claim type: erratic / steadier words win over plain more / less
  for (const [phrase, type] of TYPE_PHRASES) {
    if (hasWord(t, phrase)) {
      out.type = type;
      break;
    }
  }
  if (out.record && (!out.type || out.type === 'up' || out.type === 'down')) {
    const r = RECORDS[out.record];
    if (r.upWords.some((w) => hasWord(t, w))) out.type = 'up';
    else if (r.downWords.some((w) => hasWord(t, w))) out.type = 'down';
  }
  // "droughts are getting worse" means drier soil, not wetter
  if (out.record === 'GWETTOP' && /(^|[^a-z])droughts?([^a-z]|$)/.test(t) && (out.type === 'up' || out.type === 'down')) {
    out.type = out.type === 'up' ? 'down' : 'up';
  }
  return out;
}

/**
 * Pull every checkable sentence out of a paragraph or article. A sentence is
 * checkable when it names a place we cover, something we measure and a
 * direction. Others come back with what was missing, so the reader sees why.
 */
export function parseArticle(text, index) {
  const sentences = String(text ?? '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  let lastPlace = null;
  return sentences.map((sentence) => {
    const p = parseClaim(sentence, index);
    // a sentence that says "here" or "the region" keeps the last place named
    if (!p.place && lastPlace && p.record && p.type) p.place = { ...lastPlace, inherited: true };
    if (p.place && !p.place.inherited) lastPlace = p.place;
    const missing = ['place', 'record', 'type'].filter((k) => !p[k]);
    return { sentence, ...p, checkable: missing.length === 0, missing };
  });
}
