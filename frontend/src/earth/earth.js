import { geoOrthographic, geoPath, geoGraticule10, geoDistance, geoInterpolate, geoCircle } from 'd3-geo';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';

/** Any css colour (hex, rgb, rgba) at a new opacity. */
function alpha(col, a) {
  if (!col) return col;
  if (col.startsWith('#')) {
    const n = [1, 3, 5].map((k) => parseInt(col.slice(k, k + 2), 16));
    return `rgba(${n.join(',')},${a})`;
  }
  const m = col.match(/rgba?\(([^)]+)\)/);
  if (!m) return col;
  const [r, g, b] = m[1].split(',').map((x) => x.trim());
  return `rgba(${r},${g},${b},${a})`;
}

const PAPER = '#1b1a17'; // the line ink (black), printed on paper stock
const GROUND = '#ddd0b4';
const LAND = feature(land110, land110.objects.land);
const GRAT = geoGraticule10();
const SPHERE = { type: 'Sphere' };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** A diagonal hatch, like a screen-printed tint. */
function hatch(color, gap, width, angle = 45) {
  const s = gap * 4;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d');
  x.strokeStyle = color;
  x.lineWidth = width;
  x.translate(s / 2, s / 2);
  x.rotate((angle * Math.PI) / 180);
  for (let k = -s; k <= s; k += gap) {
    x.beginPath();
    x.moveTo(-s, k);
    x.lineTo(s, k);
    x.stroke();
  }
  return c;
}

/**
 * The atlas globe: a printed, line-drawn Earth on canvas (d3 orthographic).
 * Land is hatched, the graticule is a hairline, and every finding is drawn as
 * a printed map symbol: a solid ink dot inside a registration ring, sized by
 * the size of the change. Drag to turn, scroll or pinch to zoom.
 */
export function createEarth(el, { regions, mode = 'tool', onPick = () => {}, onHover = null } = {}) {
  const hero = mode === 'hero';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'atlas-globe';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Globe of the 360 study areas');
  el.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const proj = geoOrthographic().clipAngle(90).precision(0.4);
  const path = geoPath(proj, ctx);
  let W = 0;
  let H = 0;
  let dpr = 1;
  let rot = [-40, -15];
  let alt = 2.2;
  let landPat = null;
  let spinning = hero && !reduced;
  let running = true;
  let anim = null;

  let cells = [];
  let rings = [];
  let arcs = [];
  let labels = [];
  let hover = null;

  const boxes = regions.map((r) => {
    const [w, s, e, n] = r.bbox;
    return { type: 'Polygon', coordinates: [[[w, s], [w, n], [e, n], [e, s], [w, s]]] };
  });

  const scaleFor = (a) => Math.min(W, H) * 0.44 * (2.6 / (a + 0.4));
  function fit() {
    const r = el.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    landPat = ctx.createPattern(hatch('rgba(27,26,23,0.2)', 5 * dpr, 1 * dpr), 'repeat');
    landPat.setTransform?.(new DOMMatrix().scale(1 / dpr));
  }
  const ro = new ResizeObserver(fit);
  ro.observe(el);
  fit();

  const visible = (lon, lat) => geoDistance([lon, lat], [-rot[0], -rot[1]]) < Math.PI / 2 - 0.02;

  function draw(now) {
    proj.translate([W / 2, H / 2]).scale(scaleFor(alt)).rotate(rot);
    const R = proj.scale();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // ground disc with a soft printed vignette
    const g = ctx.createRadialGradient(W / 2 - R * 0.3, H / 2 - R * 0.35, R * 0.1, W / 2, H / 2, R);
    g.addColorStop(0, '#f3ecdc');
    g.addColorStop(1, GROUND);
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.beginPath();
    path(GRAT);
    ctx.strokeStyle = 'rgba(27,26,23,0.07)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    ctx.beginPath();
    path(LAND);
    ctx.fillStyle = 'rgba(27,26,23,0.06)';
    ctx.fill();
    ctx.fillStyle = landPat;
    ctx.fill();
    ctx.strokeStyle = 'rgba(27,26,23,0.62)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // tinted areas (heat map lenses): overprint
    ctx.globalCompositeOperation = 'multiply';
    for (const c of cells) {
      if (c.glow || c.quiet || !c.cap) continue;
      ctx.beginPath();
      path(boxes[c.i]);
      ctx.fillStyle = c.cap;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // quiet network dots
    ctx.fillStyle = 'rgba(27,26,23,0.32)';
    for (const c of cells) {
      if (!c.quiet) continue;
      const r = regions[c.i];
      if (!visible(r.lon, r.lat)) continue;
      const [x, y] = proj([r.lon, r.lat]);
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }

    // arcs: dashed great circles, marching
    const t = now / 1000;
    for (const a of arcs) {
      const A = [regions[a.i].lon, regions[a.i].lat];
      const B = [regions[a.j].lon, regions[a.j].lat];
      const ip = geoInterpolate(A, B);
      const line = { type: 'LineString', coordinates: Array.from({ length: 33 }, (_, k) => ip(k / 32)) };
      ctx.beginPath();
      path(line);
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = reduced ? 0 : -t * 14;
      ctx.strokeStyle = a.colors?.[0] ?? PAPER;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // rings: printed ripples (geodesic circles, so they hug the sphere)
    for (const r of rings) {
      const reg = regions[r.i];
      if (!visible(reg.lon, reg.lat)) continue;
      const period = (r.period ?? 1600) / 1000;
      const p = reduced ? 0.6 : ((t + (r.i % 7) * 0.13) % period) / period;
      const circ = geoCircle().center([reg.lon, reg.lat]).radius(0.4 + (r.radius ?? 3) * p)();
      ctx.beginPath();
      path(circ);
      ctx.strokeStyle = `rgba(${r.rgb},${0.85 * (1 - p)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // finding symbols: footprint outline, registration ring, ink dot
    const zoom = Math.min(1.8, Math.max(0.8, R / (Math.min(W, H) * 0.44)));
    const marks = cells.filter((c) => c.glow).sort((a, b) => (a.sel ? 1 : 0) - (b.sel ? 1 : 0));
    for (const c of marks) {
      const r = regions[c.i];
      if (!visible(r.lon, r.lat)) continue;
      const [x, y] = proj([r.lon, r.lat]);
      const size = (c.num != null ? 7.5 : 3) + 26 * Math.min(0.12, c.alt ?? 0.03) * zoom;
      if (zoom > 1.25) {
        ctx.beginPath();
        path(boxes[c.i]);
        ctx.strokeStyle = alpha(c.cap, 0.55);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // slight mis-registration: the ink dot sits a hair off its ring, as in print
      ctx.globalCompositeOperation = 'multiply';
      ctx.beginPath();
      ctx.arc(x + 0.8, y + 0.6, size, 0, Math.PI * 2);
      ctx.fillStyle = alpha(c.cap, 0.9);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      if (c.num != null && size >= 6) {
        ctx.font = `500 ${Math.round(Math.min(13, size * 1.15))}px 'DM Mono', ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = PAPER;
        ctx.fillText(String(c.num), x + 0.5, y + 1);
        ctx.textAlign = 'start';
      }
      ctx.beginPath();
      ctx.arc(x, y, size + 3, 0, Math.PI * 2);
      ctx.strokeStyle = c.sel ? PAPER : alpha(PAPER, c.focus || hover === c.i ? 0.95 : 0.4);
      ctx.lineWidth = c.sel ? 1.6 : 1;
      ctx.stroke();
      if (c.sel || c.focus) {
        ctx.beginPath();
        const k = size + 8;
        ctx.moveTo(x - k - 6, y); ctx.lineTo(x - k, y);
        ctx.moveTo(x + k, y); ctx.lineTo(x + k + 6, y);
        ctx.moveTo(x, y - k - 6); ctx.lineTo(x, y - k);
        ctx.moveTo(x, y + k); ctx.lineTo(x, y + k + 6);
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    // selected outline for tinted lenses
    for (const c of cells) {
      if (c.glow || !c.stroke) continue;
      ctx.beginPath();
      path(boxes[c.i]);
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = c.sel ? 2 : 1.2;
      ctx.stroke();
    }

    // labels: a printed tag with a leader line
    ctx.font = `500 11px 'DM Mono', ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    for (const l of labels) {
      const r = regions[l.i];
      if (!visible(r.lon, r.lat)) continue;
      const [x, y] = proj([r.lon, r.lat]);
      const text = l.text.toUpperCase();
      const tw = ctx.measureText(text).width;
      let lx = x + 22;
      const ly = y - 26;
      if (lx + tw + 14 > W - 6) lx = x - 22 - tw - 14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(lx + (lx > x ? 0 : tw + 14), ly);
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = PAPER;
      ctx.fillRect(lx, ly - 10, tw + 14, 20);
      ctx.fillStyle = '#f1e9d8';
      ctx.fillText(text, lx + 7, ly + 1);
    }

    // outline of the sphere
    ctx.beginPath();
    path(SPHERE);
    ctx.strokeStyle = 'rgba(27,26,23,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(64, now - last);
    last = now;
    if (anim) {
      const p = Math.min(1, (now - anim.t0) / anim.ms);
      const e = ease(p);
      const at = anim.ip(e);
      rot = [-at[0], -at[1]];
      alt = anim.a0 + (anim.a1 - anim.a0) * e;
      if (p >= 1) anim = null;
    } else if (spinning && !dragging) rot = [rot[0] + dt * 0.006, rot[1]];
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  let raf = requestAnimationFrame(frame);

  function goTo(lon, lat, a, ms) {
    const from = [-rot[0], -rot[1]];
    if (reduced || !ms) {
      rot = [-lon, -lat];
      alt = a;
      anim = null;
      return;
    }
    anim = { ip: geoInterpolate(from, [lon, lat]), a0: alt, a1: a, t0: performance.now(), ms };
  }

  // ------------------------------------------------------------- interaction
  const pts = new Map();
  let dragging = false;
  let moved = 0;
  let pinch0 = null;
  const pick = (ev) => {
    const b = canvas.getBoundingClientRect();
    const xy = [ev.clientX - b.left, ev.clientY - b.top];
    const ll = proj.invert(xy);
    if (!ll || !visible(ll[0], ll[1])) return null;
    // nearest finding symbol first, then the area that contains the point
    let best = null;
    let bd = 14;
    for (const c of cells) {
      if (!c.glow) continue;
      const r = regions[c.i];
      if (!visible(r.lon, r.lat)) continue;
      const p = proj([r.lon, r.lat]);
      const d = Math.hypot(p[0] - xy[0], p[1] - xy[1]);
      if (d < bd) { bd = d; best = c.i; }
    }
    if (best !== null) return best;
    const [lon, lat] = ll;
    const k = regions.findIndex((r) => lon >= r.bbox[0] && lon <= r.bbox[2] && lat >= r.bbox[1] && lat <= r.bbox[3]);
    return k < 0 ? null : k;
  };
  if (!hero) {
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      dragging = true;
      moved = 0;
      anim = null;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), alt };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) {
        if (onHover) {
          const h = pick(e);
          if (h !== hover) { hover = h; onHover(h); canvas.style.cursor = h === null ? 'grab' : 'pointer'; }
        }
        return;
      }
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch0) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        alt = Math.min(3.2, Math.max(0.35, pinch0.alt * (pinch0.d / d)));
        moved += 10;
        return;
      }
      const dx = e.clientX - prev[0];
      const dy = e.clientY - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      const k = 70 / proj.scale();
      rot = [rot[0] + dx * k, Math.max(-85, Math.min(85, rot[1] - dy * k))];
    });
    const up = (e) => {
      const wasTap = pts.size === 1 && moved < 6;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = null;
      if (!pts.size) dragging = false;
      if (wasTap && e.type === 'pointerup') onPick(pick(e));
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', () => { if (hover !== null && onHover) { hover = null; onHover(null); } });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      anim = null;
      alt = Math.min(3.2, Math.max(0.35, alt * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });
  } else canvas.style.pointerEvents = 'none';

  return {
    setCells(list) {
      cells = list.map((c) => ({
        ...c,
        quiet: !c.glow && (c.alt ?? 0) <= 0.003 && !c.stroke,
        sel: c.stroke === '#ffffff',
        focus: !!c.stroke && c.stroke !== '#ffffff',
        stroke: c.stroke === '#ffffff' ? PAPER : c.stroke ? alpha(PAPER, 0.85) : null,
      }));
    },
    setRings(list) {
      rings = list;
    },
    setArcs(list) {
      arcs = list;
    },
    setLabels(list) {
      labels = list;
    },
    flyTo(i, altitude = 1.1, ms = 1400) {
      const r = regions[i];
      goTo(r.lon, r.lat - 4, altitude, ms);
    },
    view(lat, lng, altitude, ms = 1400) {
      goTo(lng, lat, altitude, ms);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    resume() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    spin(on) {
      spinning = on && !reduced;
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.remove();
    },
  };
}
