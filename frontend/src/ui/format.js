export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function num(x, d = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '–';
  const a = Math.abs(x);
  if (a > 0 && a < 10 ** -d) d = Math.min(5, Math.ceil(-Math.log10(a)) + 1);
  return a.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function signed(x, d = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '–';
  return `${x > 0 ? '+' : x < 0 ? '−' : ''}${num(Math.abs(x), d)}`;
}

/** "1 in 3" from a share like 0.32. */
export function oneIn(share) {
  if (!share) return 'never';
  const n = Math.round(1 / share);
  return n <= 1 ? 'almost every month' : `about 1 in ${n}`;
}

/** Plain words for a q value (false-discovery adjusted p). */
export function chanceWords(q) {
  if (q === null || q === undefined) return '';
  if (q < 0.001) return 'far past the bar';
  if (q < 0.01) return 'well past the bar';
  if (q < 0.05) return 'past the bar';
  if (q < 0.2) return 'close to the bar';
  return 'nowhere near the bar';
}

export function unitText(unit) {
  return unit ? ` ${unit}` : '';
}
