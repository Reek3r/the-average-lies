/**
 * Loads the static data the checker reads. Nothing is computed on a server:
 * the statistics come from the backend export (checks.json), the series from
 * monthly/<record>.json, fetched only when a chart needs them.
 */
const base = `${import.meta.env?.BASE_URL ?? './'}data/`;
const cache = new Map();

async function json(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(base + path).then((r) => {
        if (!r.ok) throw new Error(`${r.status} loading ${path}`);
        return r.json();
      }),
    );
  }
  return cache.get(path);
}

export async function loadCore() {
  const [regions, checks, manifest] = await Promise.all([json('regions.json'), json('checks.json'), json('manifest.json')]);
  return { regions, checks, manifest };
}

export const loadMonthly = (record) => json(`monthly/${record}.json`);
export const loadAnnual = (record) => json(`annual/${record}.json`);
