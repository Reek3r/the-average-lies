import { esc, num, signed } from '../ui/format.js';
import { recordInfo, areaName, words } from '../tool/briefing.js';
import { createFlatMap } from './flatmap.js';

const PATTERNS = [
  ['hidden', 'swings growing, average steady'],
  ['avg_up', 'average rising'],
  ['avg_down', 'average falling'],
  ['sw_up', 'swings growing'],
  ['sw_down', 'swings shrinking'],
  ['contest', 'two NASA systems disagree'],
];
const SECOND = { PRECTOTCORR: 'gpm_rain', GWETTOP: 'soil_moisture', gpm_rain: 'PRECTOTCORR', soil_moisture: 'GWETTOP' };
const TONE = { avg_down: '#ffb511', avg_up: '#0078bf', sw_down: '#00a95c', contest: '#765ba7', hidden: '#ff48b0', sw_up: '#ff48b0' };
const KIND = { country: 'Country', region: 'Region', province: 'Province' };

/**
 * Plate 03 · Survey: a query over every area. One or two conditions, any set of
 * places, ranked; shown as a map, a scatter of average change against swing
 * change, a ranked table and a comparison tray. Exports CSV and GeoJSON.
 */
export function renderFind(el, ctx, { onOpen }) {
  const { regions, checks, manifest, index } = ctx;
  const seen = new Set();
  const places = index
    .filter((e) => ['country', 'region', 'province'].includes(e.kind) && e.ids.length > 1)
    .filter((p) => (seen.has(p.label) ? false : seen.add(p.label)));
  const PRE = ['Sahel', 'Horn Of Africa', 'Southern Africa', 'South Asia', 'Amazon', 'Mediterranean', 'Central Asia', 'American West', 'Arctic'];
  const presets = PRE.map((n) => places.find((p) => p.label.toLowerCase() === n.toLowerCase())).filter(Boolean);
  const recOpts = (sel, none = false) => `${none ? '<option value="">nothing else</option>' : ''}${manifest.variables.map((v) => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(v.label.toLowerCase())}</option>`).join('')}`;
  const patOpts = (skip = []) => PATTERNS.filter(([id]) => !skip.includes(id)).map(([id, l]) => `<option value="${id}">${l}</option>`).join('');

  el.innerHTML = `
    <div class="survey">
      <header class="plate-head"><p class="plate-k">Plate 03 · Survey</p><h2>Search 360 areas for a pattern</h2>
        <p class="sub">Write the question as a sentence. Combine two conditions, limit it to the places you care about, and export what you find.</p></header>
      <section class="q-sentence" aria-label="Query">
        <span>Show areas where</span>
        <select class="f-rec" aria-label="Measure">${recOpts('PRECTOTCORR')}</select>
        <span>shows</span>
        <select class="f-pat" aria-label="Pattern">${patOpts()}</select>
        <span class="q-and">and</span>
        <select class="f-rec2" aria-label="Second measure">${recOpts('', true)}</select>
        <span class="q2" hidden>shows</span>
        <select class="f-pat2" aria-label="Second pattern" hidden>${patOpts(['contest', 'hidden'])}</select>
        <span>in</span>
        <span class="combo">
          <span class="chips"></span>
          <input class="f-where" placeholder="anywhere" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="f-sugg" aria-label="Places">
          <ul id="f-sugg" class="sugg" role="listbox" hidden></ul>
        </span>
        <span>ranked by</span>
        <select class="f-sort" aria-label="Rank by"><option value="q">confidence</option><option value="size">size of change</option></select>
      </section>
      <div class="q-tools">
        <span class="q-pre">Quick regions: ${presets.map((p) => `<button type="button" class="pre" data-pre="${esc(p.label)}">${esc(p.label)}</button>`).join('')}</span>
        <label class="f-sig"><input type="checkbox" class="f-only" checked> Only results that pass the luck test</label>
      </div>
      <section class="s-out">
        <div class="fo-head"><p class="fo-sum" aria-live="polite"></p><span class="fo-x"><button type="button" class="btn-line f-csv">CSV</button><button type="button" class="btn-line f-geo">GeoJSON</button><button type="button" class="btn-line f-link">Copy link</button></span></div>
        <div class="s-grid">
          <figure class="fo-map"><figcaption>Fig. 1 · Where</figcaption><canvas aria-label="Map of matching areas"></canvas></figure>
          <figure class="scatter"><figcaption>Fig. 2 · Change in the average against change in the swings</figcaption><svg role="img" aria-label="Scatter of every area"></svg></figure>
        </div>
        <div class="tray" hidden></div>
        <div class="fo-table"><table><thead><tr><th></th><th>Area</th><th>Country</th><th class="r">Change</th><th class="r">q</th><th></th></tr></thead><tbody></tbody></table></div>
      </section>
    </div>`;
  const $ = (s) => el.querySelector(s);
  const map = createFlatMap($('.fo-map canvas'), { regions, onPick: (i) => onOpen(i, $('.f-rec').value) });
  let rows = [];
  let pool = [];
  let picked = [];
  let pinned = [];

  // ---------------------------------------------------------------- tests
  function test(rec, pat, i, only) {
    const c = checks.records[rec];
    const a = checks.alpha;
    const R = recordInfo(rec, manifest);
    const w = words(rec);
    const av = c.avg_slope[i];
    const sw = c.swing_pct[i];
    if (av === null || av === undefined) return null;
    const aSig = c.avg_q[i] < a;
    const sSig = c.swing_q[i] < a;
    if (pat === 'avg_up' || pat === 'avg_down') {
      return { ok: (pat === 'avg_up' ? av > 0 : av < 0) && (!only || aSig), q: c.avg_q[i], size: Math.abs(av), label: `${signed(av, R.decimals)}${R.unit ? ` ${R.unit}` : ''}/decade` };
    }
    if (pat === 'contest') {
      const o = checks.records[SECOND[rec]];
      if (!o) return { ok: false, q: 1, size: 0, label: '' };
      return { ok: av * o.avg_slope[i] < 0 && (!only || (aSig && o.avg_q[i] < a)), q: Math.max(c.avg_q[i], o.avg_q[i]), size: Math.abs(av), label: `${av > 0 ? w.up : w.down} vs ${o.avg_slope[i] > 0 ? w.up : w.down}` };
    }
    return { ok: (pat === 'sw_down' ? sw < 0 : sw > 0) && (!only || sSig) && (pat !== 'hidden' || !aSig), q: c.swing_q[i], size: Math.abs(sw), label: `swings ${signed(sw, 0)}%/decade` };
  }

  // ------------------------------------------------------------- the run
  function run() {
    const rec = $('.f-rec').value;
    const pat = $('.f-pat').value;
    const rec2 = $('.f-rec2').value;
    const pat2 = $('.f-pat2').value;
    const only = $('.f-only').checked;
    $('.q2').hidden = !rec2;
    $('.f-pat2').hidden = !rec2;
    pool = picked.length ? [...new Set(picked.flatMap((p) => p.ids))] : regions.map((_, i) => i);
    rows = [];
    for (const i of pool) {
      const t = test(rec, pat, i, only);
      if (!t?.ok) continue;
      let t2 = null;
      if (rec2) {
        t2 = test(rec2, pat2, i, only);
        if (!t2?.ok) continue;
      }
      rows.push({ i, q: t2 ? Math.max(t.q, t2.q) : t.q, size: t.size, label: t.label, label2: t2?.label ?? '' });
    }
    rows.sort((x, y) => ($('.f-sort').value === 'q' ? x.q - y.q : y.size - x.size));
    const R = recordInfo(rec, manifest);
    const name = PATTERNS.find((p) => p[0] === pat)[1];
    const contestBad = pat === 'contest' && !SECOND[rec];
    const where = picked.length ? ` · ${picked.map((p) => esc(p.label)).join(', ')}` : '';
    $('.fo-sum').innerHTML = contestBad
      ? 'Only rain and soil have a second NASA system. Pick one of those measures.'
      : `<b>${rows.length}</b> of ${pool.length} areas · ${esc(R.noun.toLowerCase())}: ${esc(name)}${rec2 ? ` + ${esc(recordInfo(rec2, manifest).noun.toLowerCase())}: ${esc(PATTERNS.find((p) => p[0] === pat2)[1])}` : ''}${where}`;
    const tone = TONE[pat];
    const hit = new Set(rows.map((r) => r.i));
    const inPool = new Set(pool);
    map.paint((i) => (hit.has(i) ? { fill: tone, hit: true } : inPool.has(i) ? { fill: 'rgba(27,26,23,0.5)' } : { fill: 'rgba(27,26,23,0.15)' }), new Set(pinned));
    scatter(rec, hit, inPool, tone);
    $('tbody').innerHTML = rows.slice(0, 200).map((r, k) => {
      const g = regions[r.i];
      return `<tr data-i="${r.i}" tabindex="0"><td class="rk">${k + 1}</td><td>${esc(areaName(g))}</td><td>${esc(g.country ?? '')}</td><td class="r">${esc(r.label)}${r.label2 ? `<br><small>${esc(r.label2)}</small>` : ''}</td><td class="r">${num(r.q, 3)}</td><td><button type="button" class="pin ${pinned.includes(r.i) ? 'on' : ''}" data-pin="${r.i}" aria-label="Compare">${pinned.includes(r.i) ? '−' : '+'}</button></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="none">No areas match. Try another place, a second condition, or untick the luck test.</td></tr>';
    renderTray();
    try { history.replaceState(null, '', `#/investigate/survey?${new URLSearchParams({ rec, pat, rec2, pat2, at: picked.map((p) => p.label).join('|'), only: only ? 1 : 0 })}`); } catch { /* sandboxed */ }
  }

  // ------------------------------------------------------------- scatter
  function scatter(rec, hit, inPool, tone) {
    const svg = $('.scatter svg');
    const W = 520;
    const H = 360;
    const P = { l: 46, r: 14, t: 16, b: 40 };
    const c = checks.records[rec];
    const R = recordInfo(rec, manifest);
    const pts = regions.map((_, i) => ({ i, x: c.avg_slope[i], y: c.swing_pct[i] })).filter((p) => p.x !== null && p.y !== null && inPool.has(p.i));
    const xs = pts.map((p) => Math.abs(p.x)).sort((a, b) => a - b);
    const ys = pts.map((p) => Math.abs(p.y)).sort((a, b) => a - b);
    const xm = (xs[Math.floor(xs.length * 0.98)] || 1) * 1.1;
    const ym = Math.min(120, (ys[Math.floor(ys.length * 0.98)] || 10) * 1.1);
    const X = (v) => P.l + ((Math.max(-xm, Math.min(xm, v)) + xm) / (2 * xm)) * (W - P.l - P.r);
    const Y = (v) => P.t + (1 - (Math.max(-ym, Math.min(ym, v)) + ym) / (2 * ym)) * (H - P.t - P.b);
    const dots = pts.map((p) => {
      const on = hit.has(p.i);
      return `<circle class="${on ? 'on' : ''}${pinned.includes(p.i) ? ' pinned' : ''}" data-i="${p.i}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${on ? 5.5 : 2.6}" ${on ? `style="fill:${tone}"` : ''}><title>${esc(areaName(regions[p.i]))}</title></circle>`;
    }).sort((a, b) => (a.includes('class="on') ? 1 : 0) - (b.includes('class="on') ? 1 : 0)).join('');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `
      <rect x="${X(-xm * 0.18)}" y="${P.t}" width="${X(xm * 0.18) - X(-xm * 0.18)}" height="${Y(0) - P.t}" class="zone"/>
      <line x1="${P.l}" x2="${W - P.r}" y1="${Y(0)}" y2="${Y(0)}" class="ax"/><line x1="${X(0)}" x2="${X(0)}" y1="${P.t}" y2="${H - P.b}" class="ax"/>
      <text x="${X(0) + 6}" y="${P.t + 12}" class="zl">swings growing</text>
      <text x="${W - P.r}" y="${Y(0) - 6}" text-anchor="end" class="zl">${esc(words(rec).up)}</text>
      <text x="${P.l + 4}" y="${Y(0) - 6}" class="zl">${esc(words(rec).down)}</text>
      <text x="${(P.l + W - P.r) / 2}" y="${H - 8}" text-anchor="middle" class="axl">change in the average${R.unit ? ` (${esc(R.unit)}/decade)` : ''}</text>
      <text transform="translate(12 ${(P.t + H - P.b) / 2}) rotate(-90)" text-anchor="middle" class="axl">change in swings (%/decade)</text>
      <text x="${P.l - 6}" y="${P.t + 8}" text-anchor="end" class="tk">+${Math.round(ym)}%</text><text x="${P.l - 6}" y="${H - P.b}" text-anchor="end" class="tk">−${Math.round(ym)}%</text>
      ${dots}`;
  }

  // ------------------------------------------------------- comparison tray
  function spark(rec, i) {
    const c = checks.records[rec];
    const R = recordInfo(rec, manifest);
    return `<div class="tc"><p class="tc-n">${esc(areaName(regions[i]))}</p>
      <p class="tc-v"><span>Average</span><b>${c.avg_slope[i] === null ? '—' : `${signed(c.avg_slope[i], R.decimals)}`}</b><em>q ${num(c.avg_q[i], 3)}</em></p>
      <p class="tc-v"><span>Swings</span><b>${c.swing_pct[i] === null ? '—' : `${signed(c.swing_pct[i], 0)}%`}</b><em>q ${num(c.swing_q[i], 3)}</em></p>
      <div class="tc-bar"><i style="width:${Math.min(100, Math.abs(c.swing_pct[i] ?? 0))}%;background:${(c.swing_pct[i] ?? 0) > 0 ? '#ff48b0' : '#00a95c'}"></i></div>
      <button type="button" class="btn-line" data-open="${i}">Open place</button><button type="button" class="pin on" data-pin="${i}" aria-label="Remove">−</button></div>`;
  }
  function renderTray() {
    const t = $('.tray');
    t.hidden = !pinned.length;
    t.innerHTML = pinned.length ? `<p class="plate-k">Comparison tray · ${esc(recordInfo($('.f-rec').value, manifest).noun)}</p><div class="tray-row">${pinned.map((i) => spark($('.f-rec').value, i)).join('')}</div>` : '';
  }

  // ---------------------------------------------------- place picker (combo)
  const inp = $('.f-where');
  const sugg = $('.sugg');
  let active = -1;
  let matches = [];
  function suggest() {
    const q = inp.value.trim().toLowerCase();
    if (!q) { sugg.hidden = true; inp.setAttribute('aria-expanded', 'false'); return; }
    matches = places
      .filter((p) => !picked.includes(p) && p.label.toLowerCase().includes(q))
      .sort((a, b) => (b.label.toLowerCase().startsWith(q) - a.label.toLowerCase().startsWith(q)) || a.label.length - b.label.length)
      .slice(0, 8);
    active = matches.length ? 0 : -1;
    sugg.innerHTML = matches.length
      ? matches.map((p, k) => `<li role="option" id="sg-${k}" data-k="${k}" aria-selected="${k === active}"><span>${esc(p.label)}</span><em>${KIND[p.kind]} · ${p.ids.length} areas</em></li>`).join('')
      : '<li class="none">No place by that name in our 360 areas</li>';
    sugg.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
  }
  function pick(p) {
    if (!p || picked.includes(p)) return;
    picked.push(p);
    inp.value = '';
    sugg.hidden = true;
    chips();
    run();
  }
  function chips() {
    $('.chips').innerHTML = picked.map((p, k) => `<button type="button" class="pchip" data-un="${k}">${esc(p.label)} <span aria-hidden="true">×</span></button>`).join('');
    inp.placeholder = picked.length ? 'add a place' : 'anywhere';
  }
  inp.addEventListener('input', suggest);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!matches.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      sugg.querySelectorAll('li').forEach((li, k) => li.setAttribute('aria-selected', String(k === active)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) pick(matches[active]);
    } else if (e.key === 'Escape') sugg.hidden = true;
    else if (e.key === 'Backspace' && !inp.value && picked.length) { picked.pop(); chips(); run(); }
  });
  inp.addEventListener('blur', () => setTimeout(() => (sugg.hidden = true), 150));
  sugg.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('[data-k]');
    if (li) { e.preventDefault(); pick(matches[Number(li.dataset.k)]); }
  });

  // --------------------------------------------------------------- exports
  function csv() {
    const head = 'rank,area,country,lat,lon,condition,change,second_change,q';
    const cond = `${$('.f-rec').value}:${$('.f-pat').value}${$('.f-rec2').value ? ` + ${$('.f-rec2').value}:${$('.f-pat2').value}` : ''}`;
    return [head, ...rows.map((r, k) => {
      const g = regions[r.i];
      return [k + 1, areaName(g), g.country ?? '', g.lat, g.lon, cond, r.label, r.label2, r.q].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    })].join('\n');
  }
  function geojson() {
    return JSON.stringify({ type: 'FeatureCollection', features: rows.map((r, k) => {
      const g = regions[r.i];
      const [w, s, e, n] = g.bbox;
      return { type: 'Feature', properties: { rank: k + 1, area: areaName(g), country: g.country ?? '', change: r.label, second_change: r.label2, q: r.q }, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } };
    }) });
  }
  const download = (text, name, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  el.querySelectorAll('select, .f-only').forEach((x) => x.addEventListener('input', run));
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button, circle[data-i], tr[data-i]');
    if (!b) return;
    if (b.dataset.pin) {
      const i = Number(b.dataset.pin);
      pinned = pinned.includes(i) ? pinned.filter((x) => x !== i) : [...pinned, i].slice(-3);
      run();
    } else if (b.dataset.open) onOpen(Number(b.dataset.open), $('.f-rec').value);
    else if (b.dataset.un) { picked.splice(Number(b.dataset.un), 1); chips(); run(); }
    else if (b.dataset.pre) pick(places.find((p) => p.label === b.dataset.pre));
    else if (b.classList.contains('f-csv')) download(csv(), 'average-lies-survey.csv', 'text/csv');
    else if (b.classList.contains('f-geo')) download(geojson(), 'average-lies-survey.geojson', 'application/geo+json');
    else if (b.classList.contains('f-link')) {
      try { await navigator.clipboard.writeText(location.href); b.textContent = 'Copied'; } catch { b.textContent = 'Copy blocked'; }
      setTimeout(() => (b.textContent = 'Copy link'), 1600);
    } else if (b.matches('circle[data-i], tr[data-i]')) onOpen(Number(b.dataset.i), $('.f-rec').value);
  });
  $('tbody').addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (tr && e.key === 'Enter') onOpen(Number(tr.dataset.i), $('.f-rec').value);
  });

  // restore a shared query from the address
  try {
    const qs = new URLSearchParams(location.hash.split('?')[1] ?? '');
    if (qs.get('rec')) $('.f-rec').value = qs.get('rec');
    if (qs.get('pat')) $('.f-pat').value = qs.get('pat');
    if (qs.get('rec2') !== null) $('.f-rec2').value = qs.get('rec2');
    if (qs.get('pat2')) $('.f-pat2').value = qs.get('pat2');
    if (qs.get('only') === '0') $('.f-only').checked = false;
    (qs.get('at') ?? '').split('|').filter(Boolean).forEach((l) => { const p = places.find((x) => x.label === l); if (p) picked.push(p); });
    chips();
  } catch { /* ignore a malformed address */ }
  run();
  return { destroy: () => map.destroy() };
}
