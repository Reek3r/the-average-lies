/**
 * The three things averages hide, computed from checks.json in the browser.
 * Same rules as the design doc: significance after correction, records prone
 * to the 2013-15 satellite switch kept out of the headline lists.
 */
export const SWITCH_PRONE = ['T2M', 'aerosol', 'dust', 'gpm_rain'];
export const PAIRS = [['PRECTOTCORR', 'gpm_rain'], ['GWETTOP', 'soil_moisture']];

export const km = (a, b) => {
  const r = Math.PI / 180;
  const x = Math.sin(a.lat * r) * Math.sin(b.lat * r) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.cos((a.lon - b.lon) * r);
  return 6371 * Math.acos(Math.min(1, Math.max(-1, x)));
};

const sig = (q, alpha) => q !== null && q !== undefined && q < alpha;

/** Swings grew significantly while the average didn't move. One card per area, strongest record. */
export function hiddenExtremes(checks) {
  const best = new Map();
  for (const [record, c] of Object.entries(checks.records)) {
    if (SWITCH_PRONE.includes(record)) continue;
    c.swing_q.forEach((q, i) => {
      if (!sig(q, checks.alpha) || c.swing_pct[i] <= 0 || sig(c.avg_q[i], checks.alpha) || c.avg_q[i] === null) return;
      const item = { i, record, pct: c.swing_pct[i], q, early: c.swing_early[i], late: c.swing_late[i], rare: c.rare_late[i] };
      if (!best.has(i) || q < best.get(i).q) best.set(i, item);
    });
  }
  return [...best.values()].sort((a, b) => a.q - b.q);
}

/** Neighbours under maxKm apart whose averages move significantly in opposite directions. */
export function oppositePairs(checks, regions, maxKm = 700) {
  const out = [];
  for (const [record, c] of Object.entries(checks.records)) {
    if (['aerosol', 'dust', 'gpm_rain'].includes(record)) continue;
    const s = c.avg_q.map((q, i) => (sig(q, checks.alpha) ? i : -1)).filter((i) => i >= 0);
    for (let a = 0; a < s.length; a++) {
      for (let b = a + 1; b < s.length; b++) {
        const i = s[a];
        const j = s[b];
        if (c.avg_slope[i] * c.avg_slope[j] >= 0) continue;
        const d = km(regions[i], regions[j]);
        if (d < maxKm) out.push({ record, i, j, km: Math.round(d), q: Math.max(c.avg_q[i], c.avg_q[j]) });
      }
    }
  }
  return out.sort((x, y) => x.km - y.km);
}

/** Two independent NASA systems, both significant, pointing opposite ways. */
export function contested(checks) {
  const out = [];
  for (const [a, b] of PAIRS) {
    const A = checks.records[a];
    const B = checks.records[b];
    A.avg_q.forEach((qa, i) => {
      const qb = B.avg_q[i];
      if (sig(qa, checks.alpha) && sig(qb, checks.alpha) && A.avg_slope[i] * B.avg_slope[i] < 0) {
        out.push({ i, record: a, other: b, va: A.avg_slope[i], vb: B.avg_slope[i], q: Math.max(qa, qb) });
      }
    });
  }
  return out.sort((x, y) => x.q - y.q);
}
