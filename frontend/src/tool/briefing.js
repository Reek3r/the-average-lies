import { RECORDS } from '../claim/vocab.js';
import { checkArea } from '../claim/evaluate.js';
import { loadMonthly } from '../data.js';
import { esc, num, signed, oneIn } from '../ui/format.js';
import { createFlipChart, prepareSeries } from '../ui/chart.js';
import { SWITCH_PRONE, km } from '../content/discovery.js';

const SECOND = { PRECTOTCORR: 'gpm_rain', gpm_rain: 'PRECTOTCORR', GWETTOP: 'soil_moisture', soil_moisture: 'GWETTOP' };
const EXTRA = { gpm_rain: ['wetter', 'drier'], soil_moisture: ['wetter', 'drier'] };

export function words(record) {
  const R = RECORDS[record];
  const [up, down] = R ? [R.up, R.down] : EXTRA[record] ?? ['higher', 'lower'];
  return { up, down };
}
export function recordInfo(record, manifest) {
  const m = manifest.variables.find((v) => v.id === record);
  return { noun: m?.label ?? record, unit: m?.unit ?? '', decimals: m?.decimals ?? 2, source: m?.source ?? '', what: m?.definition ?? '' };
}
const per = (v, R) => `${signed(v, R.decimals)}${R.unit ? ` ${R.unit}` : ''}`;
export const areaName = (r) => (r.country && !r.name.includes(r.country) ? `${r.name}, ${r.country}` : r.name);
const coords = (r) => `${Math.abs(r.lat).toFixed(1)}°${r.lat >= 0 ? 'N' : 'S'} ${Math.abs(r.lon).toFixed(1)}°${r.lon >= 0 ? 'E' : 'W'}`;

/** Which record should lead this area's briefing: hidden extreme, then contested, then strongest trend. */
export function leadRecord(checks, i) {
  const a = checks.alpha;
  const R = checks.records;
  let hidden = null;
  let trend = null;
  for (const [rec, c] of Object.entries(R)) {
    if (SWITCH_PRONE.includes(rec)) continue;
    if (c.swing_q[i] < a && c.swing_pct[i] > 0 && !(c.avg_q[i] < a) && (!hidden || c.swing_q[i] < R[hidden].swing_q[i])) hidden = rec;
    if (c.avg_q[i] < a && (!trend || c.avg_q[i] < R[trend].avg_q[i])) trend = rec;
  }
  if (hidden) return hidden;
  for (const [x, y] of [['PRECTOTCORR', 'gpm_rain'], ['GWETTOP', 'soil_moisture']]) {
    if (R[x].avg_q[i] < a && R[y].avg_q[i] < a && R[x].avg_slope[i] * R[y].avg_slope[i] < 0) return x;
  }
  return trend ?? 'PRECTOTCORR';
}

/** The plain-words answer at the top. Rule-written, never generated. */
function bottomLine(a, R, w) {
  if (a.average.value === null) return { head: 'No record here', body: 'This area has no data for this measure.' };
  const avgSig = a.average.significant;
  const swSig = a.swings.significant;
  const dir = a.average.value > 0 ? w.up : w.down;
  const name = R.noun.toLowerCase();
  const swings = `${Math.abs(Math.round(a.swings.value))}%`;
  if (swSig && a.swings.value > 0 && !avgSig) {
    return {
      head: `Swings up ${swings} a decade`,
      body: `Month-to-month swings in ${name} have grown ${swings} a decade since 2000. The average shows no significant change. A month that counted as a 1-in-10 event in the 2000s now comes ${oneIn(a.rareLate)}.`,
    };
  }
  if (avgSig && swSig) {
    return {
      head: `Getting ${dir}, swings ${a.swings.value > 0 ? 'growing' : 'shrinking'}`,
      body: `${R.noun} is changing by ${per(a.average.value, R)} a decade. Month-to-month swings have ${a.swings.value > 0 ? 'grown' : 'shrunk'} ${swings} a decade. Both pass the luck test.`,
    };
  }
  if (avgSig) {
    return {
      head: `Getting ${dir}`,
      body: `${R.noun} is changing by ${per(a.average.value, R)} a decade, which passes the luck test. The swings show no significant change.`,
    };
  }
  if (swSig) {
    return { head: `Swings down ${swings} a decade`, body: `Month-to-month swings have shrunk ${swings} a decade. The average shows no significant change.` };
  }
  return {
    head: 'No significant change',
    body: `Over 2000 to 2024, neither the average nor the swings in ${name} moved further than chance would explain.`,
  };
}

function mark(state) {
  return `<span class="mk mk-${state}" aria-hidden="true"></span>`;
}

let chart = null;

/**
 * Render an area briefing into `el`.
 * ctx: { regions, checks, manifest }, opts: { i, record, event, onOpenArea, onRecord, onMode, back }
 */
export function renderBriefing(el, ctx, opts) {
  const { regions, checks, manifest } = ctx;
  const { i } = opts;
  const rec = opts.record ?? leadRecord(checks, i);
  const r = regions[i];
  const R = recordInfo(rec, manifest);
  const w = words(rec);
  const a = checkArea(checks, i, rec, 'up');
  const c = checks.records[rec];
  const bl = bottomLine(a, R, w);
  const alpha = checks.alpha;

  // trust checks
  const luckState = a.average.significant || a.swings.significant ? 'pass' : 'fail';
  const second = SECOND[rec];
  let secondHtml = '';
  if (second) {
    const o = checks.records[second];
    const S = recordInfo(second, manifest);
    const oSig = o.avg_q[i] < alpha;
    const same = Math.sign(o.avg_slope[i]) === Math.sign(c.avg_slope[i]);
    const both = a.average.significant && oSig;
    const state = both ? (same ? 'pass' : 'fail') : same ? 'mixed' : 'mixed';
    const line = both
      ? same ? `${S.noun} agrees, and passes the luck test on its own.` : `${S.noun} disagrees, and both are confident. Treat this one with care.`
      : same ? `${S.noun} points the same way, too weakly to confirm it.` : `${S.noun} leans the other way. Neither result is firm.`;
    secondHtml = `<li>${mark(state)}<div><b>Second opinion</b><p>${esc(line)}</p>
      <div class="duel"><span>${esc(R.noun)} <em>${per(c.avg_slope[i], R)}</em></span><span>${esc(S.noun)} <em>${per(o.avg_slope[i], S)}</em></span></div></div></li>`;
  } else {
    secondHtml = `<li>${mark('none')}<div><b>Second opinion</b><p>No independent second record of ${esc(R.noun.toLowerCase())} in our data, so this rests on one record.</p></div></li>`;
  }
  const flagged = SWITCH_PRONE.includes(rec) && c.switch_flag?.[i];
  const instrument = SWITCH_PRONE.includes(rec)
    ? flagged
      ? `<li>${mark('fail')}<div><b>Instruments</b><p>The swings jump around 2013–15, when the satellites feeding this record changed. Part of the change may be the instruments.</p></div></li>`
      : `<li>${mark('mixed')}<div><b>Instruments</b><p>This record is sensitive to the 2013–15 satellite switch. No jump shows here. Read swings with care.</p></div></li>`
    : `<li>${mark('pass')}<div><b>Instruments</b><p>No sign that a change of satellite or model input drives this.</p></div></li>`;

  // opposite: nearest area moving the other way, same record
  const lens = a.swings.significant && !a.average.significant ? 'swings' : 'average';
  const myV = lens === 'swings' ? c.swing_pct[i] : c.avg_slope[i];
  let opp = null;
  if (myV !== null) {
    regions.forEach((o, j) => {
      if (j === i) return;
      const v = lens === 'swings' ? c.swing_pct[j] : c.avg_slope[j];
      const q = lens === 'swings' ? c.swing_q[j] : c.avg_q[j];
      if (v === null || !(q < alpha) || Math.sign(v) === Math.sign(myV)) return;
      const d = km(r, o);
      if (!opp || d < opp.d) opp = { j, d, v };
    });
  }
  const oppWord = lens === 'swings' ? (opp?.v > 0 ? 'getting wilder' : 'getting steadier') : opp?.v > 0 ? `getting ${w.up}` : `getting ${w.down}`;

  // every record here
  const all = manifest.variables.map((v) => {
    const x = checkArea(checks, i, v.id, 'up');
    const xw = words(v.id);
    const arrow = x.average.significant ? (x.average.value > 0 ? '↑' : '↓') : '·';
    const wild = x.swings.significant ? (x.swings.value > 0 ? 'wilder' : 'steadier') : '';
    return `<button type="button" class="rec ${v.id === rec ? 'on' : ''} ${x.average.significant ? 'sig' : ''}" data-rec="${v.id}">
      <span class="rec-n">${esc(v.label)}</span>
      <span class="rec-v"><i>${arrow}</i>${x.average.significant ? esc(x.average.value > 0 ? xw.up : xw.down) : 'no clear trend'}${wild ? `<em class="${wild}">${wild}</em>` : ''}</span>
    </button>`;
  }).join('');

  el.innerHTML = `
    ${opts.back ? `<button type="button" class="p-back">← ${esc(opts.back.label)}</button>` : ''}
    <header class="b-head">
      <p class="b-where">${esc(r.country ?? '')}${r.climate?.label ? ` · ${esc(r.climate.label)}` : ''} · ${coords(r)}</p>
      <h2>${esc(r.name)}</h2>
      <p class="b-prov">${esc(R.noun)} · 300 months, Jan 2000 to Dec 2024 · ${esc(R.source)}</p>
    </header>

    <section class="b-bl">
      <h3>${esc(bl.head)}</h3>
      <p>${esc(bl.body)}</p>
    </section>

    <section class="b-chart">
      <div class="seg" role="tablist" aria-label="View">
        <button type="button" role="tab" data-mode="average">Average</button>
        <button type="button" role="tab" data-mode="swings">Swings</button>
      </div>
      <div class="chart"><p class="loading">Loading 300 months</p></div>
      <div class="nums">
        <div data-for="average"><span>Trend</span><b>${a.average.value === null ? '–' : per(a.average.value, R)}</b><small>a decade, range ${a.average.lo == null ? '–' : `${signed(a.average.lo, R.decimals)} to ${signed(a.average.hi, R.decimals)}`}</small></div>
        <div data-for="swings"><span>Swings</span><b>${a.swings.value === null ? '–' : `${signed(a.swings.value, 0)}%`}</b><small>a decade · typical ${num(a.typicalSwing.early, R.decimals)} → ${num(a.typicalSwing.late, R.decimals)}</small></div>
        <div data-for="swings"><span>A 1-in-10 month</span><b>${a.rareLate == null ? '–' : oneIn(a.rareLate).replace('about ', '')}</b><small>since 2015</small></div>
      </div>
      <p class="caption"></p>
    </section>

    <section class="b-trust">
      <h3>Checks</h3>
      <ul class="checks">
        <li>${mark(luckState)}<div><b>Luck</b><p>${luckState === 'pass'
          ? `Passes a bar set across all ${checks.n_tests_average.toLocaleString('en-GB')} tests at once: fewer than 1 in 20 results that pass it should be flukes. Average q ${num(a.average.q, 3)}, swings q ${num(a.swings.q, 3)}.`
          : `Doesn’t pass the bar, so the result is “not shown”. Average q ${num(a.average.q, 3)}, swings q ${num(a.swings.q, 3)}.`}</p></div></li>
        ${secondHtml}
        ${instrument}
      </ul>
    </section>

    ${opp ? `<section class="b-opp">
      <h3>Nearest area moving the other way · ${Math.round(opp.d / 10) * 10} km</h3>
      <button type="button" class="opp" data-area="${opp.j}">
        <span class="opp-n">${esc(areaName(regions[opp.j]))}</span>
        <span class="opp-v">${esc(R.noun)} ${esc(oppWord)}</span>
        <span class="opp-go">Open briefing →</span>
      </button>
      <p class="caption">The same measure in a nearby area, moving in the opposite direction.</p>
    </section>` : ''}

    <section class="b-all">
      <h3>All 10 measures here</h3>
      <div class="recs">${all}</div>
    </section>

    <details class="b-method">
      <summary>How this was worked out</summary>
      <ol>
        <li><b>Seasons out.</b> Each month is compared only with the same month in other years.</li>
        <li><b>The level.</b> A straight-line trend with Newey–West errors, so a run of wet or hot months can’t pass for a trend.</li>
        <li><b>The swings.</b> How far each month strays from normal, trend removed, tested for growth.</li>
        <li><b>The luck bar.</b> Benjamini–Hochberg across every area and measure at once.</li>
        <li><b>Data.</b> ${esc(R.what)}. ${esc(R.source)}.</li>
      </ol>
    </details>`;

  // chart
  const box = el.querySelector('.chart');
  const cap = el.querySelector('.b-chart .caption');
  let mode = opts.mode ?? lens;
  const setMode = (m, user = false) => {
    mode = m;
    el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    el.querySelectorAll('.nums [data-for]').forEach((n) => n.classList.toggle('dim', n.dataset.for !== m));
    cap.textContent = m === 'average'
      ? 'Grey line: each month against a usual month. Dots: yearly averages. Straight line: the trend, solid when it passes the luck test. Band: its plausible range.'
      : 'Bars: how far each month strayed from normal, trend removed. Dark line: two-year running average. Orange: the typical swing in 2000–09 and 2015–24.';
    chart?.setMode(m);
    if (user) opts.onMode?.(m);
  };
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode, true)));
  setMode(mode);
  chart?.destroy();
  chart = null;
  loadMonthly(rec).then((m) => {
    if (!box.isConnected) return;
    const values = m.values[i];
    if (!values || values.every((x) => x === null)) {
      box.innerHTML = '<p class="loading">No monthly record here</p>';
      return;
    }
    const ev = opts.event && opts.event.area === i && opts.event.record === rec ? opts.event : null;
    chart = createFlipChart(box, { series: prepareSeries(values, Number(m.start.slice(0, 4))), record: R, area: a, event: ev, mode });
  });

  el.querySelector('.b-opp .opp')?.addEventListener('click', () => opts.onOpenArea?.(opp.j, rec, i));
  el.querySelector('.recs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rec]');
    if (b) opts.onRecord?.(b.dataset.rec);
  });
  el.querySelector('.p-back')?.addEventListener('click', () => opts.back.go());
  return { record: rec, lens: mode, opposite: opp?.j ?? null };
}
