import { CLAIM_TYPES } from './vocab.js';

/**
 * Check a claim in one study area. Returns the verdict for the test the claim
 * is about, and the other test too: the lesson is often in the number the
 * claim didn't mention.
 */
export function checkArea(checks, areaIndex, record, type) {
  const c = checks.records[record];
  const alpha = checks.alpha;
  const claim = CLAIM_TYPES[type];
  const average = { ...testResult(c.avg_slope[areaIndex], c.avg_q[areaIndex], alpha, c.avg_p[areaIndex]), lo: c.avg_lo[areaIndex], hi: c.avg_hi[areaIndex] };
  const swings = testResult(c.swing_pct[areaIndex], c.swing_q[areaIndex], alpha);
  const main = claim.test === 'average' ? average : swings;
  let verdict = 'no_data';
  if (main.value !== null) {
    if (!main.significant) verdict = 'not_shown';
    else verdict = Math.sign(main.value) === claim.sign ? 'backed' : 'opposite';
  }
  const second = checks.second_system[record];
  let secondOpinion = null;
  if (second) {
    const s = checks.records[second];
    const v = claim.test === 'average' ? s.avg_slope[areaIndex] : s.swing_pct[areaIndex];
    const q = claim.test === 'average' ? s.avg_q[areaIndex] : s.swing_q[areaIndex];
    if (v !== null) {
      const sameDirection = Math.sign(v) === Math.sign(main.value ?? 0);
      secondOpinion = { record: second, value: v, q, significant: q < alpha, sameDirection };
    }
  }
  return {
    areaIndex,
    verdict,
    test: claim.test,
    average,
    swings,
    typicalSwing: { early: c.swing_early[areaIndex], late: c.swing_late[areaIndex] },
    rareLate: c.rare_late[areaIndex],
    switchFlag: Boolean(c.switch_flag[areaIndex]) && claim.test === 'swings',
    secondOpinion,
  };
}

function testResult(value, q, alpha, pRaw = null) {
  if (value === null || value === undefined) return { value: null, q: null, significant: false };
  return { value, q, significant: q < alpha, leaning: pRaw !== null && pRaw < alpha && q >= alpha };
}

/**
 * Check a claim across every area a place covers (one area, or all areas in a
 * country or province), and say what the whole picture adds up to.
 */
export function checkClaim(checks, ids, record, type) {
  const areas = ids.map((i) => checkArea(checks, i, record, type));
  const n = areas.filter((a) => a.verdict !== 'no_data').length;
  const count = (v) => areas.filter((a) => a.verdict === v).length;
  const backed = count('backed');
  const opposite = count('opposite');
  let overall;
  if (n === 0) overall = 'no_data';
  else if (backed === n) overall = 'backed';
  else if (opposite === n) overall = 'opposite';
  else if (backed && opposite) overall = 'depends';
  else if (backed) overall = 'partly';
  else if (opposite) overall = 'partly_opposite';
  else overall = 'not_shown';
  return { record, type, areas, overall, counts: { backed, opposite, not_shown: count('not_shown'), no_data: count('no_data'), checked: n } };
}

/** Same claim at every study area on Earth, for the "elsewhere" map. */
export function checkEverywhere(checks, nAreas, record, type) {
  return Array.from({ length: nAreas }, (_, i) => checkArea(checks, i, record, type).verdict);
}

export const VERDICTS = {
  backed: { label: 'Backed by the data', mark: '✓' },
  partly: { label: 'Backed in some places', mark: '✓' },
  depends: { label: 'Depends where you look', mark: '⇅' },
  opposite: { label: 'The data says the opposite', mark: '↯' },
  partly_opposite: { label: 'The opposite in some places', mark: '↯' },
  not_shown: { label: 'Not shown by the data', mark: '?' },
  no_data: { label: "We can't check this here", mark: '–' },
};
