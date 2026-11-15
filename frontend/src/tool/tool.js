import { parseClaim, searchPlaces } from '../claim/parse.js';
import { checkClaim, VERDICTS } from '../claim/evaluate.js';
import { claimSentence } from '../claim/vocab.js';
import { loadAnnual } from '../data.js';
import { esc, signed } from '../ui/format.js';
import { createEarth } from '../earth/earth.js';
import { NEWS } from '../content/news.js';
import { hiddenExtremes, oppositePairs, contested } from '../content/discovery.js';
import { renderBriefing, recordInfo, areaName, words, leadRecord } from './briefing.js';
import { renderClaim, renderArticle, VERDICT_SHORT, verdictSentence } from './check.js';
import { renderDesk } from '../app/desk.js';
import { renderFind } from '../app/find.js';

const WILD = '#ff48b0';
const STEADY = '#00a95c';
const CONTEST = '#765ba7';
const POLES = { T2M: ['#0078bf', '#ff6c2f'], aerosol: ['#7fd3ff', '#ffb511'], dust: ['#7fd3ff', '#ffb511'] };
const poles = (rec) => POLES[rec] ?? ['#ffb511', '#0078bf']; // [down, up]
const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const rgba = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
const mix = (h, t) => {
  const [r, g, b] = rgb(h);
  const m = [150, 160, 175];
  return `rgb(${Math.round(m[0] + (r - m[0]) * t)},${Math.round(m[1] + (g - m[1]) * t)},${Math.round(m[2] + (b - m[2]) * t)})`;
};
const LENSES = [
  ['hide', 'Findings'],
  ['average', 'Change in the level'],
  ['swings', 'Change in the swings'],
  ['year', 'Year by year'],
];
const TABS = [
  ['news', 'In the news'],
  ['extremes', 'Hidden extremes'],
  ['pairs', 'Opposite neighbours'],
  ['contested', 'NASA vs NASA'],
];
export const METHOD = (checks) => `<header class="c-head"><p class="c-k">Method</p><h2>How each answer is made</h2></header>
      <section class="how"><h3>Seasons removed</h3><p>Each month is compared only with the same month in other years, so a wet season and a dry season are never compared with each other.</p>
      <h3>Average and swings</h3><p>Every claim is tested on two things: the trend in the average, and the trend in how far months stray from normal. A place can see more floods and more droughts while its average stays steady.</p>
      <h3>The luck test</h3><p>${checks.n_tests_average.toLocaleString('en-GB')} trend tests are run together. The Benjamini–Hochberg correction raises the bar so that fewer than 1 in 20 passing results should be chance. Each trend also allows for runs of similar months (Newey–West).</p>
      <h3>A second opinion</h3><p>Rain is measured by MERRA-2 and by GPM satellites. Soil is measured by MERRA-2 and by the GLDAS land model. Where they disagree, both results are shown. Records sensitive to the 2013–15 satellite switch are kept out of the headline counts.</p>
      <h3>Tested, nothing found</h3><p>Early warnings of tipping points (rising memory in the data) and natural groupings of places were both tested. Neither survived correction, so neither is shown.</p>
      <h3>Limits</h3><p>The tool doesn’t explain causes or forecast. Each area is a 2° box, about 220 km across. 25 years is short for climate, and “not shown” means the data can’t separate the change from chance.</p>
      <h3>Data</h3><p>NASA POWER (MERRA-2): temperature, humidity, rain, topsoil wetness. MERRA-2 aerosol: haze, dust. GPM IMERG: satellite rain. GLDAS Noah: evaporation, runoff, soil moisture. Monthly, January 2000 to December 2024, 360 areas. Imagery: NASA Blue Marble and Black Marble.</p>
      <h3>Claim reading</h3><p>Claims are matched with a fixed vocabulary of places, measures and directions. No AI writes any answer.</p></section>`;
const EXAMPLES = ['Rain in Pakistan is getting more erratic', 'Northern Australia is getting wetter', 'Droughts in Somalia are getting worse', 'The Sahel is getting wetter'];

export function startTool(root, ctx) {
  const { regions, checks, manifest } = ctx;
  const found = {
    extremes: hiddenExtremes(checks),
    pairs: oppositePairs(checks, regions),
    contested: contested(checks),
  };
  const newsChecked = NEWS.map((n) => {
    const parsed = parseClaim(n.test, ctx.index);
    return { ...n, parsed, result: checkClaim(checks, parsed.place.ids, parsed.record, parsed.type) };
  });

  const S = { lens: 'hide', record: 'PRECTOTCORR', year: 2024, tab: 'news', panel: null, history: [], focus: [], selected: null, playing: false };

  root.innerHTML = `
  <div class="tool" data-panel="closed">
    <header class="t-top">
      <a class="t-brand" href="#/" aria-label="The Average Lies, home"><span class="logo" aria-hidden="true"></span><span class="t-name">The Average Lies</span></a>
      <form class="cmd" autocomplete="off">
        <label class="sr-only" for="cmd-in">Paste a claim, an article or a place</label>
        <textarea id="cmd-in" rows="1" placeholder="Paste a claim, article or place"></textarea>
        <button type="submit" class="cmd-go">Check</button>
        <ul class="cmd-sugg" hidden></ul>
      </form>
      <nav class="t-nav"><button type="button" data-act="tour">Guided tour</button></nav>
    </header>
    <nav class="t-tabs" aria-label="Tools">
      <button type="button" data-page="globe" aria-current="page">Globe</button>
      <button type="button" data-page="desk">Claims desk</button>
      <button type="button" data-page="find">Survey</button>
      <button type="button" data-page="method">Method</button>
    </nav>
    <section class="t-page" hidden></section>

    <aside class="t-feed" aria-label="Findings">
      <div class="tabs" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}">${label}<span class="n"></span></button>`).join('')}</div>
      <p class="feed-lede"></p>
      <ol class="feed-list"></ol>
    </aside>

    <section class="t-stage">
      <div class="earth" aria-label="3D globe of the 360 study areas. Drag to turn, scroll or pinch to zoom, tap an area to open its briefing."></div>
      <div class="legend"></div>
      <div class="stage-bar">
        <div class="lenses" role="radiogroup" aria-label="What the globe shows">${LENSES.map(([id, l]) => `<button type="button" role="radio" data-lens="${id}">${l}</button>`).join('')}</div>
        <div class="rec-pick"><label for="rec-sel">Measure</label><select id="rec-sel">${manifest.variables.map((v) => `<option value="${v.id}">${esc(v.label)}</option>`).join('')}</select></div>
        <div class="years"><button type="button" class="yplay" aria-label="Play 2000 to 2024">▶</button><input type="range" min="2000" max="2024" step="1" aria-label="Year"><output></output></div>
      </div>
      <div class="seq" hidden>
        <p class="seq-k"></p>
        <h3 class="seq-h"></h3>
        <p class="seq-p"></p>
        <div class="seq-bar"><span class="seq-dots"></span><button type="button" class="seq-open">Open briefing</button><button type="button" class="seq-next">Next</button><button type="button" class="seq-exit" aria-label="Exit">×</button></div>
      </div>
    </section>

    <aside class="t-panel" aria-live="polite" hidden>
      <div class="p-bar"><button type="button" class="p-close" aria-label="Close">×</button></div>
      <div class="p-body"></div>
    </aside>
  </div>`;

  const $ = (s) => root.querySelector(s);
  const tool = $('.tool');
  const panel = $('.t-panel');
  const body = $('.p-body');
  const input = $('#cmd-in');
  const sugg = $('.cmd-sugg');
  const earth = createEarth($('.earth'), {
    regions,
    onPick: (i) => {
      if (i === null) return;
      openArea(i, S.lens === 'hide' ? null : S.record);
    },
  });
  earth.view(18, 30, window.innerWidth < 760 ? 2.6 : 2.2, 0);

  // ------------------------------------------------------------- globe layers
  let annual = null;
  async function paint() {
    const cells = [];
    const rings = [];
    let arcs = [];
    const focus = new Set(S.focus);
    const sel = S.selected;
    if (S.lens === 'hide') {
      const seen = new Set();
      found.extremes.forEach((h, k) => {
        seen.add(h.i);
        cells.push({ i: h.i, cap: rgba(WILD, 0.92), glow: true, num: S.tab === 'extremes' ? k + 1 : null, alt: 0.015 + 0.09 * Math.min(1, h.pct / 80) });
        if (k < 6) rings.push({ i: h.i, rgb: rgb(WILD).join(','), radius: 2.6 });
      });
      found.contested.forEach((c, kk) => {
        if (seen.has(c.i)) return;
        seen.add(c.i);
        cells.push({ i: c.i, cap: rgba(CONTEST, 0.92), glow: true, num: S.tab === 'contested' ? kk + 1 : null, alt: 0.05 });
      });
      found.pairs.forEach((p, kp) => {
        const c = checks.records[p.record];
        const [down, up] = poles(p.record);
        for (const k of [p.i, p.j]) {
          if (seen.has(k)) continue;
          seen.add(k);
          const col = c.avg_slope[k] > 0 ? up : down;
          cells.push({ i: k, cap: rgba(col, 0.9), glow: true, num: S.tab === 'pairs' ? kp + 1 : null, alt: 0.035 });
        }
        arcs.push({ i: p.i, j: p.j, colors: [c.avg_slope[p.i] > 0 ? up : down, c.avg_slope[p.j] > 0 ? up : down], stroke: 0.22 });
      });
      regions.forEach((_, i) => !seen.has(i) && cells.push({ i, cap: 'rgba(255,255,255,0.13)', alt: 0.003 }));
    } else {
      const c = checks.records[S.record];
      const [down, up] = S.lens === 'swings' ? [STEADY, WILD] : poles(S.record);
      let vals;
      let sigs;
      if (S.lens === 'average') {
        vals = c.avg_slope;
        sigs = c.avg_q.map((q) => q !== null && q < checks.alpha);
      } else if (S.lens === 'swings') {
        vals = c.swing_pct;
        sigs = c.swing_q.map((q) => q !== null && q < checks.alpha);
      } else {
        annual = await loadAnnual(S.record);
        vals = annual.values.map((row) => row?.[S.year - annual.years[0]] ?? null);
        sigs = vals.map(() => true);
      }
      const mags = vals.filter((v, k) => v !== null && sigs[k]).map(Math.abs).sort((a, b) => a - b);
      const dom = mags[Math.floor(mags.length * 0.95)] || mags.at(-1) || 1;
      vals.forEach((v, i) => {
        if (v === null) return;
        const t = Math.min(1, Math.abs(v) / dom);
        const col = v >= 0 ? up : down;
        if (sigs[i]) cells.push({ i, cap: rgba(col, 0.3 + 0.6 * t), alt: 0.006 + 0.13 * t });
        else cells.push({ i, cap: 'rgba(0,0,0,0)', alt: 0.003 });
      });
      legend(down, up, dom);
    }
    if (S.lens === 'hide') legendHide();
    for (const cell of cells) {
      if (focus.has(cell.i)) {
        cell.stroke = 'rgba(27,26,23,0.9)';
      }
      if (sel === cell.i) {
        cell.stroke = '#ffffff';
      }
    }
    if (sel !== null && S.oppositeOf !== undefined && S.oppositeOf !== null) arcs = [{ i: sel, j: S.oppositeOf, colors: ['rgba(27,26,23,0.9)', 'rgba(27,26,23,0.35)'], stroke: 0.2 }, ...arcs];
    earth.setCells(cells);
    earth.setRings(S.lens === 'hide' ? rings : sel !== null ? [{ i: sel, rgb: '255,255,255', radius: 3.4, speed: 2, period: 1100 }] : []);
    earth.setArcs(S.lens === 'hide' || S.oppositeOf != null ? arcs : []);
    earth.setLabels(sel !== null ? [{ i: sel, text: regions[sel].name, alt: 0.08 }] : []);
  }

  function legendHide() {
    $('.legend').innerHTML = `
      <p class="lg-h">Findings</p>
      <ul>
        <li><i style="background:${WILD}"></i>Swings growing, average steady <b>${found.extremes.length}</b></li>
        <li><i class="split" style="--a:${poles('PRECTOTCORR')[1]};--b:${poles('PRECTOTCORR')[0]}"></i>Neighbours trending in opposite directions <b>${new Set(found.pairs.flatMap((p) => [p.i, p.j])).size}</b></li>
        <li><i style="background:${CONTEST}"></i>NASA systems disagree <b>${found.contested.length}</b></li>
      </ul>`;
  }
  function legend(down, up, dom) {
    const R = recordInfo(S.record, manifest);
    const w = words(S.record);
    const unit = R.unit ? ` ${R.unit}` : '';
    const [lo, hi, title] = S.lens === 'average'
      ? [`${signed(-dom, R.decimals)}${unit} ${w.down}`, `${signed(dom, R.decimals)}${unit} ${w.up}`, `${R.noun}: change a decade`]
      : S.lens === 'swings'
        ? [`${Math.round(-dom)}% steadier`, `+${Math.round(dom)}% wilder`, `${R.noun}: swings a decade`]
        : [`${signed(-dom, R.decimals)}${unit}`, `${signed(dom, R.decimals)}${unit}`, `${R.noun}: ${S.year} against normal`];
    $('.legend').innerHTML = `<p class="lg-h">${esc(title)}</p>
      <div class="lg-bar" style="background:linear-gradient(90deg,${down},rgb(150,160,175) 50%,${up})"></div>
      <div class="lg-ends"><span>${esc(lo)}</span><span>${esc(hi)}</span></div>
      ${S.lens === 'year' ? '' : '<p class="lg-note">Tinted areas pass the luck test. Small dots show no significant change.</p>'}`;
  }

  function syncControls() {
    root.querySelectorAll('[data-lens]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === S.lens)));
    $('#rec-sel').value = S.record;
    $('.rec-pick').hidden = S.lens === 'hide';
    $('.years').hidden = S.lens !== 'year';
    $('.years input').value = S.year;
    $('.years output').textContent = S.year;
    $('.yplay').textContent = S.playing ? '❚❚' : '▶';
  }

  function setLens(lens, record = S.record) {
    S.lens = lens;
    S.record = record;
    if (lens !== 'year') stopPlay();
    syncControls();
    paint();
  }

  // --------------------------------------------------------------------- feed
  function renderFeed() {
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
    const counts = { news: newsChecked.length, extremes: found.extremes.length, pairs: found.pairs.length, contested: found.contested.length };
    root.querySelectorAll('[data-tab] .n').forEach((n) => (n.textContent = counts[n.parentElement.dataset.tab]));
    const lede = {
      news: 'Real claims from published reporting, tested against 25 years of NASA data.',
      extremes: 'Areas where the swings have grown and the average shows no significant trend. Ranked by confidence.',
      pairs: 'Areas under 700 km apart where the same measure moves in opposite directions, both confidently.',
      contested: 'Two NASA systems measure the same thing here and report significant trends in opposite directions.',
    }[S.tab];
    $('.feed-lede').textContent = lede;
    const list = $('.feed-list');
    if (S.tab === 'news') {
      list.innerHTML = newsChecked.map((n, k) => `<li><button type="button" class="card news" data-news="${k}">
        <span class="c-meta">${esc(n.outlet)} · ${esc(n.date)}</span>
        <span class="c-said">${esc(n.said)}</span>
        <span class="c-test"><span class="chip v-${n.result.overall}">${VERDICT_SHORT[n.result.overall]}</span>${esc(claimSentence(n.parsed.record, n.parsed.type, n.parsed.place.label))}</span>
      </button></li>`).join('');
    } else if (S.tab === 'extremes') {
      list.innerHTML = found.extremes.map((h, k) => {
        const R = recordInfo(h.record, manifest);
        const max = Math.max(h.early, h.late);
        return `<li><button type="button" class="card" data-ext="${k}">
          <span class="c-meta"><b class="idx">${k + 1}</b>${esc(R.noun)}</span>
          <span class="c-name">${esc(areaName(regions[h.i]))}</span>
          <span class="c-row"><span class="c-big" style="color:${WILD}">+${Math.round(h.pct)}%</span><span class="c-small">swings a decade<br>average: no clear change</span>
          <span class="thennow" aria-label="Typical swing then and now"><i style="height:${(h.early / max) * 100}%"></i><i style="height:${(h.late / max) * 100}%"></i></span></span>
        </button></li>`;
      }).join('');
    } else if (S.tab === 'pairs') {
      list.innerHTML = found.pairs.map((p, k) => {
        const R = recordInfo(p.record, manifest);
        const w = words(p.record);
        const c = checks.records[p.record];
        const [down, up] = poles(p.record);
        const side = (i) => `<span class="pp"><i style="background:${c.avg_slope[i] > 0 ? up : down}"></i>${esc(regions[i].name)}<em>${c.avg_slope[i] > 0 ? w.up : w.down}</em></span>`;
        return `<li><button type="button" class="card" data-pair="${k}">
          <span class="c-meta"><b class="idx">${k + 1}</b>${esc(R.noun)} · ${p.km} km apart</span>
          ${side(p.i)}${side(p.j)}
        </button></li>`;
      }).join('');
    } else {
      list.innerHTML = found.contested.map((x, k) => {
        const A = recordInfo(x.record, manifest);
        const B = recordInfo(x.other, manifest);
        const w = words(x.record);
        return `<li><button type="button" class="card" data-con="${k}">
          <span class="c-meta"><b class="idx">${k + 1}</b>${esc(A.noun)} against ${esc(B.noun)}</span>
          <span class="c-name">${esc(areaName(regions[x.i]))}</span>
          <span class="duel"><span><b style="color:${CONTEST}">${x.va > 0 ? w.up : w.down}</b> says ${esc(A.source.split('·')[0].trim() || 'MERRA-2')}</span><span><b style="color:${CONTEST}">${x.vb > 0 ? w.up : w.down}</b> says ${esc(B.source.split('·')[0].trim() || 'GLDAS')}</span></span>
        </button></li>`;
      }).join('');
    }
  }

  // -------------------------------------------------------------------- panel
  function showPanel(render, { focus = [], selected = null, push = true } = {}) {
    if (push && S.panel) S.history.push(S.panel);
    S.panel = render;
    S.focus = focus;
    S.selected = selected;
    panel.hidden = false;
    tool.dataset.panel = 'open';
    render();
    body.scrollTop = 0;
    paint();
  }
  function closePanel() {
    S.panel = null;
    S.history = [];
    S.focus = [];
    S.selected = null;
    S.oppositeOf = null;
    panel.hidden = true;
    tool.dataset.panel = 'closed';
    paint();
  }

  function openArea(i, record = null, fromOpposite = null, event = null) {
    const back = S.panel ? { label: 'Back', go: () => goBack() } : null;
    const render = () => {
      const out = renderBriefing(body, ctx, {
        i, record, event, back,
        onOpenArea: (j, rec, from) => openArea(j, rec, from),
        onRecord: (rec) => openArea(i, rec, fromOpposite, event),
        onMode: (m) => S.lens !== 'hide' && S.lens !== 'year' && setLens(m === 'swings' ? 'swings' : 'average', out.record),
      });
      S.oppositeOf = fromOpposite ?? out.opposite;
      if (S.lens !== 'hide' && S.lens !== 'year') setLens(out.lens === 'swings' ? 'swings' : 'average', out.record);
    };
    showPanel(render, { selected: i });
    earth.flyTo(i, window.innerWidth < 760 ? 1.4 : 1.0);
  }

  function goBack() {
    const prev = S.history.pop();
    if (!prev) return closePanel();
    S.panel = prev;
    prev();
    paint();
  }

  function centroid(ids) {
    const lat = ids.reduce((s, i) => s + regions[i].lat, 0) / ids.length;
    const lon = ids.reduce((s, i) => s + regions[i].lon, 0) / ids.length;
    const spread = Math.max(...ids.map((i) => Math.hypot(regions[i].lat - lat, regions[i].lon - lon)), 5);
    return { lat, lon, alt: Math.min(2.6, Math.max(0.9, spread / 14)) };
  }

  function openClaim(parsed, text, news = null) {
    const lens = parsed.type === 'wilder' || parsed.type === 'steadier' ? 'swings' : 'average';
    S.lens = lens;
    S.record = parsed.record;
    syncControls();
    const render = () => renderClaim(body, ctx, {
      parsed, text, news,
      onOpenArea: (i, rec) => openArea(i, rec, null, news?.event ?? null),
    });
    showPanel(render, { focus: parsed.place.ids });
    const c = centroid(parsed.place.ids);
    earth.view(c.lat - 3, c.lon, window.innerWidth < 760 ? c.alt + 0.6 : c.alt);
  }

  function openPlace(place) {
    if (place.ids.length === 1) return openArea(place.ids[0]);
    const render = () => {
      body.innerHTML = `<header class="c-head"><p class="c-k">${esc(place.kind)}</p><h2>${esc(place.label)}</h2><p class="fine">${place.ids.length} study areas. Each leads with its most telling finding.</p></header>
        <section class="c-areas"><ul>${place.ids.map((i) => {
          const rec = leadRecord(checks, i);
          const R = recordInfo(rec, manifest);
          const c = checks.records[rec];
          const hidden = c.swing_q[i] < checks.alpha && c.swing_pct[i] > 0 && !(c.avg_q[i] < checks.alpha);
          const txt = hidden ? `${R.noun}: wilder, ${signed(c.swing_pct[i], 0)}% a decade` : c.avg_q[i] < checks.alpha ? `${R.noun}: ${c.avg_slope[i] > 0 ? words(rec).up : words(rec).down}` : 'No clear change';
          return `<li><button type="button" data-area="${i}"><i class="dot ${hidden ? 'd-wild' : c.avg_q[i] < checks.alpha ? 'd-backed' : ''}"></i><span class="a-n">${esc(regions[i].name)}</span><span class="a-v">${esc(txt)}</span></button></li>`;
        }).join('')}</ul></section>`;
      body.querySelector('ul').addEventListener('click', (e) => {
        const b = e.target.closest('[data-area]');
        if (b) openArea(Number(b.dataset.area));
      });
    };
    showPanel(render, { focus: place.ids });
    const c = centroid(place.ids);
    earth.view(c.lat - 3, c.lon, c.alt);
  }

  function openArticle(text) {
    const render = () => renderArticle(body, ctx, {
      text,
      onClaim: (p) => openClaim(p, p.sentence),
      onPlay: (list) => playSequence(list.map((p) => ({
        kind: 'claim',
        k: VERDICTS[p.result.overall].label,
        h: p.sentence,
        p: verdictSentence(p.result, p.record, p.type, p.place.label),
        go: () => {
          setLens(p.type === 'wilder' || p.type === 'steadier' ? 'swings' : 'average', p.record);
          S.focus = p.place.ids;
          paint();
          const c = centroid(p.place.ids);
          earth.view(c.lat - 3, c.lon, c.alt);
        },
        open: () => openClaim(p, p.sentence),
      }))),
    });
    showPanel(render);
  }

  function openHow() {
    const render = () => {
      body.innerHTML = METHOD(checks);
    };
    showPanel(render);
  }

  // ------------------------------------------------------- tour and playback
  let seq = null;
  let seqTimer = null;
  const seqEl = $('.seq');
  function playSequence(steps) {
    seq = { steps, k: 0 };
    closePanel();
    seqEl.hidden = false;
    tool.classList.add('seq-on');
    showStep();
  }
  function showStep() {
    clearTimeout(seqTimer);
    const s = seq.steps[seq.k];
    seqEl.querySelector('.seq-k').textContent = s.k;
    seqEl.querySelector('.seq-h').textContent = s.h;
    seqEl.querySelector('.seq-p').textContent = s.p;
    seqEl.querySelector('.seq-dots').innerHTML = seq.steps.map((_, k) => `<i class="${k === seq.k ? 'on' : ''}"></i>`).join('');
    seqEl.querySelector('.seq-next').textContent = seq.k === seq.steps.length - 1 ? 'Done' : 'Next';
    seqEl.querySelector('.seq-open').hidden = !s.open;
    seqEl.classList.remove('in');
    void seqEl.offsetWidth;
    seqEl.classList.add('in');
    s.go();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) seqTimer = setTimeout(nextStep, 9000);
  }
  function nextStep() {
    if (!seq) return;
    if (seq.k >= seq.steps.length - 1) return endSequence();
    seq.k += 1;
    showStep();
  }
  function endSequence() {
    clearTimeout(seqTimer);
    if (seq) {
      S.selected = null;
      S.oppositeOf = null;
    }
    seq = null;
    seqEl.hidden = true;
    tool.classList.remove('seq-on');
  }
  seqEl.querySelector('.seq-next').addEventListener('click', nextStep);
  seqEl.querySelector('.seq-exit').addEventListener('click', () => {
    endSequence();
    S.focus = [];
    paint();
  });
  seqEl.querySelector('.seq-open').addEventListener('click', () => {
    const s = seq.steps[seq.k];
    endSequence();
    s.open();
  });

  function tour() {
    const pasni = regions.findIndex((r) => r.name.startsWith('Pasni'));
    const iskus = regions.findIndex((r) => r.name.startsWith('Iskushuban'));
    const burao = regions.findIndex((r) => r.name.startsWith('Burao'));
    const sahel = regions.findIndex((r) => r.name === 'Western Sahel');
    playSequence([
      {
        k: 'Hidden extremes', h: 'Pasni, Pakistan',
        p: 'Average rain: no significant change since 2000. Month-to-month swings: up 51% a decade. A month that was a 1-in-10 event now comes about 1 in 3.',
        go: () => { S.selected = pasni; S.oppositeOf = null; S.focus = []; setLens('swings', 'PRECTOTCORR'); earth.flyTo(pasni, 1.1); },
        open: () => openArea(pasni, 'PRECTOTCORR', null, NEWS[0].event),
      },
      {
        k: 'Opposite neighbours', h: 'Iskushuban and Burao, Somalia',
        p: 'Two areas about 530 km apart. Topsoil is significantly drier in one and significantly wetter in the other.',
        go: () => { S.focus = [iskus, burao]; S.selected = iskus; S.oppositeOf = burao; setLens('average', 'GWETTOP'); const c = centroid([iskus, burao]); earth.view(c.lat - 2, c.lon, 1.1); },
        open: () => openArea(iskus, 'GWETTOP'),
      },
      {
        k: 'NASA systems disagree', h: 'Western Sahel, Niger',
        p: 'MERRA-2 shows the topsoil getting wetter. GLDAS shows the soil getting drier. Both pass the luck test, so both are shown.',
        go: () => { S.selected = sahel; S.oppositeOf = null; S.focus = []; setLens('hide'); earth.flyTo(sahel, 1.2); },
        open: () => openArea(sahel, 'GWETTOP'),
      },
      {
        k: 'Next', h: 'Check claims or search for patterns',
        p: 'Paste text in the bar above, trace claims on the Claims desk, or search all 360 areas in the Survey.',
        go: () => { S.selected = null; S.oppositeOf = null; S.focus = []; setLens('hide'); earth.view(15, 40, window.innerWidth < 760 ? 2.6 : 2.2); },
      },
    ]);
  }

  // ----------------------------------------------------------------- command
  function submit(text) {
    const t = text.trim();
    if (!t) return;
    if (current === 'desk' && pageApi?.check) return pageApi.check(t);
    if (current !== 'globe') setPage('globe');
    sugg.hidden = true;
    endSequence();
    const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.length > 12);
    if (sentences.length > 1 || t.length > 180) return openArticle(t);
    const p = parseClaim(t, ctx.index);
    if (p.record && p.type) {
      const place = p.place ?? { label: 'the world', kind: 'world', ids: regions.map((_, i) => i) };
      return openClaim({ ...p, place }, t);
    }
    if (p.place) return openPlace(p.place);
    showPanel(() => {
      body.innerHTML = `<header class="c-head"><p class="c-k">Not sure what to test</p><h2>Try naming a place, a measure and a direction</h2></header>
        <section class="c-areas"><ul>${EXAMPLES.map((e) => `<li><button type="button" data-ex="${esc(e)}"><span class="a-n">${esc(e)}</span></button></li>`).join('')}</ul></section>`;
      body.querySelector('ul').addEventListener('click', (e) => {
        const b = e.target.closest('[data-ex]');
        if (b) {
          input.value = b.dataset.ex;
          submit(b.dataset.ex);
        }
      });
    });
  }
  $('.cmd').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    if (text.length > 120) input.value = '';
    input.style.height = '';
    submit(text);
    input.blur();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('.cmd').requestSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(140, input.scrollHeight)}px`;
    const q = input.value.trim();
    if (q.length < 2 || q.length > 40 || /\s.*\s.*\s/.test(q)) {
      sugg.hidden = true;
      return;
    }
    const hits = searchPlaces(ctx.index, q, 6);
    sugg.innerHTML = hits.map((h, k) => `<li><button type="button" data-hit="${k}"><span>${esc(h.label)}</span><small>${h.kind}${h.ids.length > 1 ? ` · ${h.ids.length} areas` : ''}</small></button></li>`).join('');
    sugg.hidden = !hits.length;
    sugg.onclick = (e) => {
      const b = e.target.closest('[data-hit]');
      if (!b) return;
      sugg.hidden = true;
      input.value = '';
      openPlace(hits[Number(b.dataset.hit)]);
    };
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.cmd')) sugg.hidden = true;
  });

  // ------------------------------------------------------------------- pages
  const page = $('.t-page');
  let pageApi = null;
  let current = 'globe';
  function setPage(p) {
    current = p;
    root.querySelectorAll('[data-page]').forEach((b) => b.setAttribute('aria-current', b.dataset.page === p ? 'page' : 'false'));
    pageApi?.destroy?.();
    pageApi = null;
    tool.dataset.page = p;
    if (p === 'globe') {
      page.hidden = true;
      earth.resume();
      return;
    }
    endSequence();
    earth.pause();
    page.hidden = false;
    page.scrollTop = 0;
    if (p === 'desk') pageApi = renderDesk(page, ctx, { onShow: (parsed, text) => { setPage('globe'); openClaim(parsed, text); } });
    else if (p === 'find') pageApi = renderFind(page, ctx, { onOpen: (i, rec) => { setPage('globe'); openArea(i, rec); } });
    else page.innerHTML = `<div class="method">${METHOD(checks)}</div>`;
  }

  // ---------------------------------------------------------------- controls
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.page) setPage(b.dataset.page);
    else if (b.dataset.tab) {
      S.tab = b.dataset.tab;
      renderFeed();
      if (S.lens !== 'hide') setLens('hide');
      else paint();
    } else if (b.dataset.lens) setLens(b.dataset.lens);
    else if (b.dataset.news) {
      const n = newsChecked[Number(b.dataset.news)];
      openClaim(n.parsed, n.test, n);
    } else if (b.dataset.ext) {
      const h = found.extremes[Number(b.dataset.ext)];
      openArea(h.i, h.record);
    } else if (b.dataset.pair) {
      const p = found.pairs[Number(b.dataset.pair)];
      openArea(p.i, p.record, p.j);
    } else if (b.dataset.con) {
      const x = found.contested[Number(b.dataset.con)];
      openArea(x.i, x.record);
    } else if (b.dataset.act === 'tour') {
      setPage('globe');
      tour();
    }
    else if (b.dataset.act === 'how') openHow();
    else if (b.classList.contains('p-close')) closePanel();
    else if (b.classList.contains('yplay')) (S.playing ? stopPlay() : startPlay());
  });
  $('#rec-sel').addEventListener('change', (e) => setLens(S.lens, e.target.value));
  $('.years input').addEventListener('input', (e) => {
    S.year = Number(e.target.value);
    stopPlay();
    syncControls();
    paint();
  });
  let playTimer = null;
  function startPlay() {
    if (S.year >= 2024) S.year = 2000;
    S.playing = true;
    syncControls();
    paint();
    playTimer = setInterval(() => {
      if (S.year >= 2024) return stopPlay();
      S.year += 1;
      syncControls();
      paint();
    }, 700);
  }
  function stopPlay() {
    clearInterval(playTimer);
    S.playing = false;
    if ($('.yplay')) $('.yplay').textContent = '▶';
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (seq) endSequence();
      else if (S.panel) closePanel();
    }
  });

  syncControls();
  renderFeed();
  paint();
  const start = ctx.startWith;
  if (start?.page) setPage(start.page);
  if (start?.page === 'desk' && start.text) pageApi.check(start.text);
  else if (start?.tour) setTimeout(tour, 600);
  else if (start?.news) {
    const n = newsChecked.find((x) => x.id === start.news.id);
    if (n) openClaim(n.parsed, n.test, n);
  } else if (start?.text) {
    input.value = start.text;
    submit(start.text);
  }
  return () => {
    stopPlay();
    endSequence();
    earth.destroy();
  };
}
