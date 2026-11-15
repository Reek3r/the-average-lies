import { num, signed } from './format.js';

/**
 * The flip chart. One SVG holds two views of the same 300 months:
 *   average  each month against its usual value, yearly dots, trend + range
 *   swings   how far each month strayed from normal, two-year running mean,
 *            typical swing in 2000-09 and 2015-24
 * Switching animates between them (CSS on .mode-average / .mode-swings).
 */
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
};

export function prepareSeries(values, startYear) {
  const n = values.length;
  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  values.forEach((v, i) => {
    if (v === null) return;
    sums[i % 12] += v;
    counts[i % 12] += 1;
  });
  const clim = sums.map((s, m) => (counts[m] ? s / counts[m] : 0));
  const anom = values.map((v, i) => (v === null ? null : v - clim[i % 12]));
  const t = anom.map((_, i) => startYear + (i + 0.5) / 12);
  const pts = anom.map((a, i) => [t[i], a]).filter((p) => p[1] !== null);
  const mt = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const ma = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const b = pts.reduce((s, p) => s + (p[0] - mt) * (p[1] - ma), 0) / pts.reduce((s, p) => s + (p[0] - mt) ** 2, 0);
  const dev = anom.map((a, i) => (a === null ? null : Math.abs(a - (ma + b * (t[i] - mt)))));
  const rolling = dev.map((_, i) => {
    if (i < 12 || i > n - 12) return null;
    const win = dev.slice(i - 12, i + 12).filter((x) => x !== null);
    return win.reduce((s, x) => s + x, 0) / win.length;
  });
  const years = [];
  for (let y = 0; y < n / 12; y++) {
    const slice = anom.slice(y * 12, y * 12 + 12).filter((x) => x !== null);
    years.push(slice.length ? slice.reduce((s, x) => s + x, 0) / slice.length : null);
  }
  return { t, anom, dev, rolling, years, startYear, endYear: startYear + n / 12, tMid: mt, values, clim };
}

function ticks(lo, hi, count = 4) {
  const raw = (hi - lo) / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step) out.push(Math.round(v / step) * step);
  return out;
}
const dec = (span) => (span >= 20 ? 0 : span >= 2 ? 1 : span >= 0.2 ? 2 : 3);

function path(t, v, x, y) {
  let d = '';
  let pen = false;
  v.forEach((val, i) => {
    if (val === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(t[i]).toFixed(1)},${y(val).toFixed(1)}`;
    pen = true;
  });
  return d;
}

/**
 * area: {average:{value, lo, hi, significant}, typicalSwing:{early, late}}
 * event: optional {date:'YYYY-MM', label}
 */
export function createFlipChart(container, { series, record, area, event = null, mode = 'average' }) {
  const wrap = document.createElement('div');
  wrap.className = 'flip';
  const svg = el('svg', { class: 'flip-svg', role: 'img' });
  const tip = document.createElement('div');
  tip.className = 'flip-tip';
  tip.hidden = true;
  wrap.append(svg, tip);
  container.replaceChildren(wrap);
  let current = mode;

  function draw() {
    const W = Math.max(280, container.clientWidth);
    const H = Math.round(Math.min(280, Math.max(190, W * 0.52)));
    const narrow = W < 420;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.replaceChildren();
    svg.setAttribute('class', `flip-svg mode-${current}`);
    const pad = { l: narrow ? 38 : 46, r: 10, t: 14, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const { t, anom, dev, rolling, years, startYear, endYear, tMid } = series;
    const x = (v) => pad.l + ((v - startYear) / (endYear - startYear)) * iw;
    const d = record.decimals;

    // --- scales
    const av = anom.filter((v) => v !== null);
    const span = Math.max(...av) - Math.min(...av);
    const aLo = Math.min(0, ...av) - span * 0.04;
    const aHi = Math.max(0, ...av) + span * 0.04;
    const ya = (v) => pad.t + ih - ((v - aLo) / (aHi - aLo)) * ih;
    const sorted = dev.filter((v) => v !== null).sort((p, q) => p - q);
    const rmax = Math.max(...rolling.filter((v) => v !== null));
    const sHi = Math.min(sorted.at(-1), Math.max(sorted[Math.floor(sorted.length * 0.96)], rmax * 2.2)) * 1.08;
    const ys = (v) => pad.t + ih - (Math.min(v, sHi) / sHi) * ih;

    // --- years axis (shared)
    const axis = el('g', { class: 'f-axis' }, svg);
    for (let yr = Math.ceil(startYear / 5) * 5; yr < endYear; yr += 5) {
      el('text', { x: x(yr), y: H - 6, 'text-anchor': 'middle', class: 'f-tick' }, axis).textContent = yr;
    }

    // --- average view
    const gA = el('g', { class: 'f-avg' }, svg);
    for (const v of ticks(aLo, aHi, narrow ? 3 : 4)) {
      el('line', { x1: pad.l, x2: W - pad.r, y1: ya(v), y2: ya(v), class: v === 0 ? 'f-zero' : 'f-grid' }, gA);
      el('text', { x: pad.l - 6, y: ya(v) + 4, 'text-anchor': 'end', class: 'f-tick' }, gA).textContent = v === 0 ? '0' : signed(v, dec(aHi - aLo));
    }
    if (area.average.value !== null) {
      const lo = area.average.lo / 10;
      const hi = area.average.hi / 10;
      const sl = area.average.value / 10;
      el('path', { d: `M${x(startYear)},${ya(lo * (startYear - tMid))}L${x(endYear)},${ya(lo * (endYear - tMid))}L${x(endYear)},${ya(hi * (endYear - tMid))}L${x(startYear)},${ya(hi * (startYear - tMid))}Z`, class: 'f-fan' }, gA);
      el('path', { d: path(t, anom, x, ya), class: 'f-month' }, gA);
      years.forEach((v, i) => v !== null && el('circle', { cx: x(startYear + i + 0.5), cy: ya(v), r: 3.2, class: 'f-year', style: `--i:${i}` }, gA));
      el('line', { x1: x(startYear), y1: ya(sl * (startYear - tMid)), x2: x(endYear), y2: ya(sl * (endYear - tMid)), class: area.average.significant ? 'f-trend sig' : 'f-trend' }, gA);
    }

    // --- swings view
    const gS = el('g', { class: 'f-sw' }, svg);
    for (const v of ticks(0, sHi, narrow ? 3 : 4)) {
      el('line', { x1: pad.l, x2: W - pad.r, y1: ys(v), y2: ys(v), class: v === 0 ? 'f-zero' : 'f-grid' }, gS);
      el('text', { x: pad.l - 6, y: ys(v) + 4, 'text-anchor': 'end', class: 'f-tick' }, gS).textContent = num(v, dec(sHi));
    }
    const bw = Math.max(1, iw / dev.length - 0.6);
    const bars = el('g', { class: 'f-bars' }, gS);
    dev.forEach((v, i) => {
      if (v === null) return;
      el('rect', { x: x(t[i]) - bw / 2, y: ys(v), width: bw, height: ys(0) - ys(v), class: v > sHi ? 'f-bar off' : 'f-bar', style: `--i:${i}` }, bars);
    });
    el('path', { d: path(t, rolling, x, ys), class: 'f-roll', pathLength: 1 }, gS);
    const e = area.typicalSwing?.early;
    const l = area.typicalSwing?.late;
    if (e != null && l != null) {
      el('line', { x1: x(startYear), x2: x(startYear + 10), y1: ys(e), y2: ys(e), class: 'f-era' }, gS);
      el('line', { x1: x(endYear - 10), x2: x(endYear), y1: ys(l), y2: ys(l), class: 'f-era' }, gS);
    }

    // --- event marker (both views)
    if (event?.date) {
      const [yy, mm] = event.date.split('-').map(Number);
      const ex = x(yy + (mm - 0.5) / 12);
      const gE = el('g', { class: 'f-event' }, svg);
      el('line', { x1: ex, x2: ex, y1: pad.t, y2: pad.t + ih }, gE);
      el('text', { x: ex - 5, y: pad.t + 10, 'text-anchor': 'end' }, gE).textContent = event.label;
    }

    svg.setAttribute('aria-label', `${record.noun}, ${startYear} to ${endYear - 1}: ${current === 'average' ? 'monthly departures from normal and the trend' : 'size of each month’s swing from normal'}`);

    // --- readout on hover/touch
    const hit = el('rect', { x: pad.l, y: pad.t, width: iw, height: ih, class: 'f-hit' }, svg);
    const cursor = el('line', { y1: pad.t, y2: pad.t + ih, class: 'f-cursor', visibility: 'hidden' }, svg);
    const show = (cx) => {
      const box = svg.getBoundingClientRect();
      const tt = startYear + (((cx - box.left) / box.width) * W - pad.l) / iw * (endYear - startYear);
      const i = Math.max(0, Math.min(anom.length - 1, Math.floor((tt - startYear) * 12)));
      const month = new Date(2000, i % 12, 1).toLocaleString('en-GB', { month: 'short' });
      cursor.setAttribute('x1', x(t[i]));
      cursor.setAttribute('x2', x(t[i]));
      cursor.setAttribute('visibility', 'visible');
      const unit = record.unit ? ` ${record.unit}` : '';
      tip.textContent = current === 'average'
        ? `${month} ${Math.floor(t[i])}  ${signed(anom[i], d)}${unit} vs a usual ${month}`
        : `${month} ${Math.floor(t[i])}  ${num(dev[i], d)}${unit} away from normal`;
      tip.hidden = false;
      const px = (x(t[i]) / W) * box.width;
      tip.style.left = `${Math.max(0, Math.min(box.width - 200, px - 100))}px`;
    };
    hit.addEventListener('pointermove', (ev) => show(ev.clientX));
    hit.addEventListener('pointerdown', (ev) => show(ev.clientX));
    hit.addEventListener('pointerleave', () => {
      cursor.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    });
  }

  const ro = new ResizeObserver(() => draw());
  ro.observe(container);
  draw();
  return {
    setMode(m) {
      current = m;
      svg.setAttribute('class', `flip-svg mode-${m}`);
    },
    destroy: () => ro.disconnect(),
  };
}
