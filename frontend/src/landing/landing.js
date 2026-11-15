import { parseClaim } from '../claim/parse.js';
import { checkClaim, VERDICTS } from '../claim/evaluate.js';
import { checkArea } from '../claim/evaluate.js';
import { loadAnnual, loadMonthly } from '../data.js';
import { esc } from '../ui/format.js';
import { createEarth } from '../earth/earth.js';
import { createFlipChart, prepareSeries } from '../ui/chart.js';
import { NEWS } from '../content/news.js';
import { hiddenExtremes, contested } from '../content/discovery.js';
import { VERDICT_SHORT } from '../tool/check.js';

const DEMO = [
  'Rain in Balochistan is getting more erratic.',
  'Droughts in Somalia are getting worse.',
  'Northern Australia is getting wetter.',
  'Locals say the summers feel longer.',
];

export function renderLanding(root, ctx) {
  const { regions, checks } = ctx;
  const ext = hiddenExtremes(checks);
  const con = contested(checks);
  const rain = checks.records.PRECTOTCORR;
  const sig = (q) => q !== null && q < checks.alpha;
  const wetter = rain.avg_slope.filter((v, i) => sig(rain.avg_q[i]) && v > 0).length;
  const drier = rain.avg_slope.filter((v, i) => sig(rain.avg_q[i]) && v < 0).length;
  const wilder = rain.swing_pct.filter((v, i) => sig(rain.swing_q[i]) && v > 0).length;
  const news = NEWS.slice(0, 4).map((n) => {
    const p = parseClaim(n.test, ctx.index);
    return { ...n, verdict: checkClaim(checks, p.place.ids, p.record, p.type).overall };
  });

  root.innerHTML = `
  <div class="land">
    <header class="l-top">
      <a class="t-brand" href="#/"><span class="logo" aria-hidden="true"></span><span class="t-name">The Average Lies</span></a>
      <a class="l-open" href="#/investigate">Open the investigator</a>
    </header>

    <section class="hero">
      <div class="hero-earth" aria-hidden="true"></div>
      <div class="hero-shade" aria-hidden="true"></div>
      <div class="hero-copy">
        <p class="eyebrow">NASA Space Apps 2026 · Earth System Trend Detective</p>
        <h1>Check a climate claim against 25 years of NASA data</h1>
        <p class="lede">Paste a headline or a whole article. Each claim is tested in 360 places with monthly NASA records from 2000 to 2024, and every answer says how confident it is.</p>
        <div class="ctas">
          <a class="btn-main" href="#/investigate">Open the investigator</a>
          <a class="btn-ghost" href="#/investigate/tour">Take the 60-second tour</a>
        </div>
      </div>
      <ul class="hero-claims" aria-label="Claims from recent reporting, checked">${news.map((n, k) => `
        <li style="--k:${k}"><a href="#/investigate/news/${n.id}">
          <span class="hc-meta">${esc(n.outlet)} · ${esc(n.date)}</span>
          <span class="hc-said">${esc(n.said)}</span>
          <span class="hc-v"><span class="chip v-${n.verdict}">${VERDICT_SHORT[n.verdict]}</span><span class="hc-t">${esc(n.test)}</span></span>
        </a></li>`).join('')}
      </ul>
    </section>

    <section class="unweave">
      <div class="uw-copy">
        <h2>The global rain average, split into 360 areas</h2>
        <p>Averaged across all 360 areas, rain has crept up since 2000. Split into its areas, the same line runs in many directions.</p>
        <ul class="uw-counts">
          <li class="wet"><b data-to="${wetter}">0</b> areas getting wetter</li>
          <li class="dry"><b data-to="${drier}">0</b> getting drier</li>
          <li class="wild"><b data-to="${wilder}">0</b> with bigger swings</li>
        </ul>
        <p class="fine">Each thread is one area’s yearly rain, 2000–2024, scaled to its own normal range. Coloured threads pass the luck test.</p>
      </div>
      <div class="uw-fig"><canvas class="uw-canvas" aria-label="An average rain line splitting into 360 separate threads"></canvas></div>
    </section>

    <section class="three">
      <h2>Three things an average hides</h2>
      <div class="three-grid">
        <article class="panel-a">
          <p class="k k-wild">Hidden extremes · ${ext.length} areas</p>
          <h3>Pasni, Pakistan</h3>
          <p>Average rain on the Makran coast shows no significant change since 2000. Month-to-month swings have grown 51% a decade. In July 2022 the area averaged 7.1 mm of rain a day, against a July normal of 0.8.</p>
          <div class="mini mini-flip"></div>
          <p class="mini-cap"><span class="mc-a">Average: no clear change</span><span class="mc-s">Swings: +51% a decade</span></p>
        </article>
        <article class="panel-b">
          <p class="k k-pair">Opposite neighbours</p>
          <h3>Iskushuban and Burao, Somalia</h3>
          <p>Two areas 530 km apart. Topsoil in Iskushuban is drying. Topsoil in Burao is getting wetter. A claim about all of Somalia has to account for both.</p>
          <svg class="mini mini-pair" viewBox="0 0 320 170" role="img" aria-label="Topsoil wetness in two Somali areas moving apart, 2000 to 2024"></svg>
        </article>
        <article class="panel-c">
          <p class="k k-con">NASA vs NASA · ${con.length} places</p>
          <h3>Western Sahel, Niger</h3>
          <p>MERRA-2 and GLDAS both measure the soil here. MERRA-2 shows it getting wetter and GLDAS shows it getting drier, and both trends pass the luck test. The tool reports both.</p>
          <svg class="mini mini-duel" viewBox="0 0 320 170" role="img" aria-label="Two NASA soil records for the western Sahel moving in opposite directions"></svg>
        </article>
      </div>
    </section>

    <section class="paste">
      <div class="paste-copy">
        <h2>Check every sentence in an article</h2>
        <p>Paste a claim, a paragraph or a full article. Each sentence that names a place, a measure and a direction is tested. Sentences that can’t be tested are listed with the reason.</p>
        <a class="btn-main" href="#/investigate">Check your own text</a>
      </div>
      <ol class="demo" aria-label="Example sentences, checked">${DEMO.map((s) => {
        const p = parseClaim(s, ctx.index);
        const ok = p.place && p.record && p.type;
        const v = ok ? checkClaim(checks, p.place.ids, p.record, p.type).overall : null;
        return `<li class="${ok ? 'hit' : 'skip'}"><span class="d-s">${esc(s)}</span>${ok ? `<span class="chip v-${v}">${VERDICT_SHORT[v]}</span>` : '<span class="d-why">No place named, so nothing to test</span>'}</li>`;
      }).join('')}</ol>
    </section>

    <section class="trust">
      <h2>How the answers are made</h2>
      <ul>
        <li><b>Seasons out.</b> Each month is compared only with the same month in other years.</li>
        <li><b>Two tests.</b> One looks for a change in the average. The other looks for a change in the size of the swings.</li>
        <li><b>A bar for luck.</b> ${checks.n_tests_average.toLocaleString('en-GB')} tests corrected together, so fewer than 1 in 20 passes should be flukes.</li>
        <li><b>A second opinion.</b> Rain and soil are each measured by two NASA systems. Where they disagree, both results are shown.</li>
      </ul>
      <a class="btn-main" href="#/investigate">Open the investigator</a>
    </section>

    <footer class="l-foot">
      <p>Built by Active Future Labs for NASA Space Apps 2026.</p>
      <p>Data: NASA POWER (MERRA-2), MERRA-2 aerosol, GPM IMERG, GLDAS Noah · monthly, Jan 2000 to Dec 2024 · 360 areas of 2° × 2°. Imagery: NASA Blue Marble and Black Marble.</p>
    </footer>
  </div>`;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const earth = createEarth(root.querySelector('.hero-earth'), { regions, mode: 'hero' });
  earth.view(18, 55, window.innerWidth < 760 ? 2.1 : 1.9, 0);
  // a quiet constellation of the findings on the night side
  earth.setCells(ext.map((h) => ({ i: h.i, cap: 'rgba(255,72,176,0.95)', glow: true, alt: 0.01 + 0.05 * Math.min(1, h.pct / 80) })));
  earth.setRings(ext.slice(0, 8).map((h) => ({ i: h.i, rgb: '255,72,176', radius: 2.4 })));

  const cleanups = [() => earth.destroy()];
  const onView = (el, fn, threshold = 0.35) => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (fn(), io.disconnect())), { threshold });
    io.observe(el);
    cleanups.push(() => io.disconnect());
  };

  // --- counters
  onView(root.querySelector('.uw-counts'), () => {
    root.querySelectorAll('.uw-counts b').forEach((b) => {
      const to = Number(b.dataset.to);
      const t0 = performance.now();
      const step = (now) => {
        const t = reduced ? 1 : Math.min(1, (now - t0) / 1600);
        b.textContent = Math.round(to * (1 - (1 - t) ** 3));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  // --- the unweaving
  loadAnnual('PRECTOTCORR').then((annual) => {
    const canvas = root.querySelector('.uw-canvas');
    if (!canvas) return;
    const series = annual.values.map((row) => {
      const v = row.filter((x) => x !== null);
      const m = v.reduce((s, x) => s + x, 0) / v.length;
      const sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) || 1;
      return row.map((x) => (x === null ? 0 : (x - m) / sd));
    });
    const n = series[0].length;
    const mean = Array.from({ length: n }, (_, k) => series.reduce((s, r) => s + r[k], 0) / series.length);
    const cat = series.map((_, i) => (sig(rain.swing_q[i]) && rain.swing_pct[i] > 0 ? 'wild' : sig(rain.avg_q[i]) ? (rain.avg_slope[i] > 0 ? 'wet' : 'dry') : 'none'));
    const COL = { wet: '0,120,191', dry: '245,161,66', wild: '255,72,176', none: '200,210,225' };
    const order = series.map((_, i) => i).sort((a, b) => (cat[a] === 'none') - (cat[b] === 'none'));
    let p = 0;
    let started = false;
    const draw = () => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(W * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const x = (k) => 12 + (k / (n - 1)) * (W - 24);
      const y = (v) => H / 2 - v * (H / 7);
      const e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
      for (const i of [...order].reverse()) {
        const c = cat[i];
        g.strokeStyle = `rgba(${COL[c]},${c === 'none' ? 0.05 + 0.1 * e : 0.18 + 0.55 * e})`;
        g.lineWidth = c === 'none' ? 0.7 : 1.1;
        g.beginPath();
        for (let k = 0; k < n; k++) {
          const v = mean[k] + (series[i][k] - mean[k]) * e;
          if (k) g.lineTo(x(k), y(v));
          else g.moveTo(x(k), y(v));
        }
        g.stroke();
      }
      g.strokeStyle = `rgba(27,26,23,${1 - 0.55 * e})`;
      g.lineWidth = 3.5;
      g.beginPath();
      mean.forEach((v, k) => (k ? g.lineTo(x(k), y(v)) : g.moveTo(x(k), y(v))));
      g.stroke();
      g.fillStyle = 'rgba(27,26,23,0.55)';
      g.font = '500 12px "Inter Tight Variable", system-ui, sans-serif';
      g.fillText('2000', 12, H - 8);
      g.textAlign = 'right';
      g.fillText('2024', W - 12, H - 8);
      g.textAlign = 'left';
      g.fillStyle = 'rgba(27,26,23,0.85)';
      g.fillText(e < 0.15 ? 'The average' : 'Each area', 12, 18);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    cleanups.push(() => ro.disconnect());
    onView(canvas, () => {
      if (started) return;
      started = true;
      if (reduced) {
        p = 1;
        draw();
        return;
      }
      setTimeout(() => {
        const t0 = performance.now();
        const step = (now) => {
          p = Math.min(1, (now - t0) / 2600);
          draw();
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, 500);
    }, 0.5);
  });

  // --- panel a: the flip, on its own
  const pasni = regions.findIndex((r) => r.name.startsWith('Pasni'));
  loadMonthly('PRECTOTCORR').then((m) => {
    const box = root.querySelector('.mini-flip');
    if (!box) return;
    const a = checkArea(checks, pasni, 'PRECTOTCORR', 'up');
    const chart = createFlipChart(box, { series: prepareSeries(m.values[pasni], 2000), record: { noun: 'Rain', unit: 'mm/day', decimals: 1 }, area: a, event: { date: '2022-07', label: 'Jul 2022' } });
    const panelA = root.querySelector('.panel-a');
    let mode = 'average';
    const flip = () => {
      mode = mode === 'average' ? 'swings' : 'average';
      chart.setMode(mode);
      panelA.dataset.mode = mode;
    };
    panelA.dataset.mode = mode;
    let timer = null;
    onView(box, () => {
      if (reduced) return;
      flip();
      timer = setInterval(flip, 3600);
    }, 0.6);
    cleanups.push(() => {
      clearInterval(timer);
      chart.destroy();
    });
  });

  // --- panels b and c: two lines pulling apart
  const pair = (svg, a, b, labels, colors) => {
    const n = a.length;
    const all = [...a, ...b];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const X = (k) => 16 + (k / (n - 1)) * 288;
    const Y = (v) => 150 - ((v - lo) / (hi - lo || 1)) * 100;
    const d = (s) => s.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    svg.innerHTML = `<line x1="16" x2="304" y1="${Y(0)}" y2="${Y(0)}" class="mp-zero"/>
      <path d="${d(a)}" class="mp-line" style="stroke:${colors[0]}"/>
      <path d="${d(b)}" class="mp-line" style="stroke:${colors[1]}"/>
      <g class="mp-key"><rect x="16" y="6" width="10" height="10" rx="2" style="fill:${colors[0]}"/><text x="32" y="15" style="fill:${colors[0]}">${esc(labels[0])}</text>
      <rect x="16" y="24" width="10" height="10" rx="2" style="fill:${colors[1]}"/><text x="32" y="33" style="fill:${colors[1]}">${esc(labels[1])}</text></g>
      <text x="16" y="166" class="mp-yr">2000</text><text x="304" y="166" text-anchor="end" class="mp-yr">2024</text>`;
    const lines = [...svg.querySelectorAll('.mp-line')];
    lines.forEach((l) => {
      const len = l.getTotalLength();
      l.style.strokeDasharray = `${len}`;
      l.style.strokeDashoffset = reduced ? '0' : `${len}`;
    });
    onView(svg, () => {
      svg.classList.add('drawn');
      lines.forEach((l) => (l.style.strokeDashoffset = '0'));
    }, 0.5);
  };
  const smooth = (row) => {
    const v = row.map((x) => x ?? 0);
    const base = v.slice(0, 5).reduce((s, x) => s + x, 0) / 5;
    return v.map((_, k) => {
      const w = v.slice(Math.max(0, k - 2), k + 3);
      return w.reduce((s, x) => s + x, 0) / w.length - base;
    });
  };
  const z = (row) => {
    const s = smooth(row);
    const sd = Math.sqrt(s.reduce((t, x) => t + x * x, 0) / s.length) || 1;
    return s.map((x) => x / sd);
  };
  loadAnnual('GWETTOP').then((g) => {
    const i = regions.findIndex((r) => r.name.startsWith('Iskushuban'));
    const j = regions.findIndex((r) => r.name.startsWith('Burao'));
    const svg = root.querySelector('.mini-pair');
    if (svg) pair(svg, smooth(g.values[i]), smooth(g.values[j]), [`${regions[i].name.split(',')[0]}: drying`, `${regions[j].name.split(',')[0]}: wetter`], ['#ffb511', '#0078bf']);
    loadAnnual('soil_moisture').then((s) => {
      const k = regions.findIndex((r) => r.name === 'Western Sahel');
      const svg2 = root.querySelector('.mini-duel');
      if (svg2) pair(svg2, z(g.values[k]), z(s.values[k]), ['MERRA-2: wetter', 'GLDAS: drier'], ['#765ba7', '#e6dcff']);
    });
  });

  // --- the demo article
  onView(root.querySelector('.demo'), () => root.querySelector('.demo').classList.add('run'), 0.5);

  return () => cleanups.forEach((f) => f());
}
