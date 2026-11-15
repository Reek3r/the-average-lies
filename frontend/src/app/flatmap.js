import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';

const LAND = feature(land110, land110.objects.land);
const GRAT = geoGraticule10();

/**
 * A flat world map on canvas. Each study area is a true-size 2° box.
 * colors(i) -> {fill, ring} | null. Click returns the nearest area.
 */
export function createFlatMap(canvas, { regions, onPick = () => {} }) {
  const ctx = canvas.getContext('2d');
  const proj = geoNaturalEarth1();
  const path = geoPath(proj, ctx);
  let colorOf = () => null;
  let marked = new Set();
  let size = { w: 0, h: 0 };

  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    size = { w, h };
    proj.fitExtent([[6, 6], [w - 6, h - 6]], { type: 'Sphere' });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    path({ type: 'Sphere' });
    ctx.fillStyle = '#efe7d6';
    ctx.fill();
    ctx.beginPath();
    path(GRAT);
    ctx.strokeStyle = 'rgba(27,26,23,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    path(LAND);
    ctx.fillStyle = '#e2d6bd';
    ctx.fill();
    ctx.strokeStyle = 'rgba(27,26,23,0.6)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    const k = proj.scale() / 160;
    regions.forEach((r, i) => {
      const c = colorOf(i);
      const [x0, y1] = proj([r.bbox[0], r.bbox[1]]);
      const [x1, y0] = proj([r.bbox[2], r.bbox[3]]);
      const bw = Math.max(3, x1 - x0);
      const bh = Math.max(3, y1 - y0);
      const x = (x0 + x1) / 2 - bw / 2;
      const y = (y0 + y1) / 2 - bh / 2;
      const cx = x + bw / 2;
      const cy = y + bh / 2;
      if (c?.hit) {
        const rr = Math.max(3.5, bw * 0.55);
        ctx.globalCompositeOperation = 'multiply';
        ctx.beginPath();
        ctx.arc(cx + 0.7, cy + 0.5, rr, 0, Math.PI * 2);
        ctx.fillStyle = c.fill;
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(cx, cy, rr + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = marked.has(i) ? '#1b1a17' : 'rgba(27,26,23,0.55)';
        ctx.lineWidth = marked.has(i) ? 2 : 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = c?.fill ?? 'rgba(27,26,23,0.25)';
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
      }
    });
    void k;
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const ll = proj.invert([e.clientX - rect.left, e.clientY - rect.top]);
    if (!ll) return;
    let best = null;
    let bd = 9;
    regions.forEach((r, i) => {
      const d = Math.hypot(r.lon - ll[0], r.lat - ll[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best !== null) onPick(best);
  });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const ll = proj.invert([e.clientX - rect.left, e.clientY - rect.top]);
    const near = ll && regions.some((r) => Math.hypot(r.lon - ll[0], r.lat - ll[1]) < 2.5);
    canvas.style.cursor = near ? 'pointer' : 'default';
  });

  const ro = new ResizeObserver(draw);
  ro.observe(canvas);
  return {
    paint(fn, mark = []) {
      colorOf = fn;
      marked = new Set(mark);
      draw();
    },
    destroy: () => ro.disconnect(),
    get size() {
      return size;
    },
  };
}
