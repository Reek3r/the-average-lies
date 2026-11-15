import { claimSentence } from '../claim/vocab.js';
import { checkClaim, VERDICTS } from '../claim/evaluate.js';
import { parseArticle } from '../claim/parse.js';
import { esc, signed } from '../ui/format.js';
import { areaName, words } from './briefing.js';

const OPP = { up: 'down', down: 'up', wilder: 'steadier', steadier: 'wilder' };
const typeWord = (record, type) => {
  const w = words(record);
  return type === 'up' ? w.up : type === 'down' ? w.down : type === 'wilder' ? 'more erratic' : 'steadier';
};

export const VERDICT_SHORT = {
  backed: 'Backed', partly: 'Partly backed', depends: 'Depends where', opposite: 'Opposite', partly_opposite: 'Partly opposite', not_shown: 'Not shown', no_data: 'Can’t check',
};

/** One sentence that answers the claim, using the counts. */
export function verdictSentence(result, record, type, label) {
  const c = result.counts;
  const n = c.checked;
  const opp = typeWord(record, OPP[type]);
  if (n === 1) {
    const a = result.areas[0];
    const main = a.test === 'average' ? a.average : a.swings;
    if (a.verdict === 'backed') return a.test === 'swings' ? `Swings grew ${Math.round(main.value)}% a decade${a.average.significant ? '.' : '. The average shows no significant change.'}` : `${signed(main.value, 2)} a decade, passing the luck test.`;
    if (a.verdict === 'opposite') return `The data shows the opposite: ${opp}.`;
    if (a.verdict === 'not_shown') return 'No change large or steady enough to pass the luck test in 25 years.';
    return 'No record for this here.';
  }
  const rest = c.not_shown ? ` ${c.not_shown} show no clear change.` : '';
  return {
    backed: `All ${n} areas in ${label} back it.`,
    partly: `${c.backed} of ${n} areas in ${label} back it.${rest}`,
    depends: `${c.backed} of ${n} areas back it. ${c.opposite} show the opposite.${rest}`,
    opposite: `All ${n} areas show the opposite: ${opp}.`,
    partly_opposite: `No area backs it. ${c.opposite} of ${n} show the opposite: ${opp}.${rest}`,
    not_shown: `None of the ${n} areas shows a change that passes the luck test.`,
    no_data: 'No record for this.',
  }[result.overall];
}

/** A claim: verdict, the source if it came from the news, every area. */
export function renderClaim(el, ctx, { parsed, text, news, onOpenArea }) {
  const { regions, checks } = ctx;
  const { place, record, type } = parsed;
  const result = checkClaim(checks, place.ids, record, type);
  const v = VERDICTS[result.overall];
  const rank = { backed: 0, opposite: 1, not_shown: 2, no_data: 3 };
  const q = (a) => (a.test === 'average' ? a.average.q : a.swings.q) ?? 1;
  const list = [...result.areas].sort((a, b) => rank[a.verdict] - rank[b.verdict] || q(a) - q(b));
  const val = (a) => (a.test === 'average' ? (a.average.value === null ? '' : `${signed(a.average.value, 2)}/decade`) : a.swings.value === null ? '' : `swings ${signed(a.swings.value, 0)}%/decade`);

  el.innerHTML = `
    ${news ? `<article class="src">
      <p class="src-meta">${esc(news.outlet)} · ${esc(news.date)}</p>
      <p class="src-said">${esc(news.said)}</p>
      <a class="src-link" href="${esc(news.url)}" target="_blank" rel="noopener">Read the source ↗</a>
    </article>` : ''}
    <header class="c-head">
      <p class="c-k">We tested</p>
      <h2>${esc(claimSentence(record, type, place.label))}</h2>
      ${text && !news && text.trim().toLowerCase() !== claimSentence(record, type, place.label).toLowerCase() ? `<p class="c-orig">From: “${esc(text.length > 140 ? `${text.slice(0, 140)}…` : text)}”</p>` : ''}
    </header>
    <section class="verdict v-${result.overall}">
      <span class="stamp" aria-hidden="true">${v.mark}</span>
      <div><b>${esc(v.label)}</b><p>${esc(verdictSentence(result, record, type, place.label))}</p></div>
    </section>
    ${news?.note ? `<section class="c-note"><h3>What the data adds</h3><p>${esc(news.note)}</p>${news.noteUrl ? `<a class="src-link" href="${esc(news.noteUrl)}" target="_blank" rel="noopener">Supporting source ↗</a>` : ''}</section>` : ''}
    <section class="c-areas">
      <h3>${list.length === 1 ? 'The area we checked' : `${list.length} areas we checked`}</h3>
      <ul>${list.slice(0, 40).map((a) => `
        <li><button type="button" data-area="${a.areaIndex}">
          <i class="dot d-${a.verdict}"></i><span class="a-n">${esc(areaName(regions[a.areaIndex]))}</span>
          <span class="a-v">${esc(val(a))}</span><span class="a-w">${{ backed: 'backs it', opposite: 'opposite', not_shown: 'unclear', no_data: 'no data' }[a.verdict]}</span>
        </button></li>`).join('')}</ul>
    </section>
    <p class="fine">Claims are read with a fixed word list and answered by the same tests as every briefing. No AI is involved. ${type === 'wilder' || type === 'steadier' ? 'A claim about extremes is tested on the swings.' : 'A claim about the level is tested on the seasonal trend.'}</p>`;
  el.querySelector('.c-areas ul').addEventListener('click', (e) => {
    const b = e.target.closest('[data-area]');
    if (b) onOpenArea(Number(b.dataset.area), record);
  });
  return result;
}

/** A pasted paragraph or article: every sentence, the checkable ones answered. */
export function renderArticle(el, ctx, { text, onClaim, onPlay }) {
  const parts = parseArticle(text, ctx.index);
  const checks = parts.filter((p) => p.checkable).map((p) => ({ ...p, result: checkClaim(ctx.checks, p.place.ids, p.record, p.type) }));
  const need = { place: 'a place we cover', record: 'something we measure', type: 'a direction' };
  let k = 0;
  el.innerHTML = `
    <header class="c-head">
      <p class="c-k">Article breakdown</p>
      <h2>${checks.length ? `${checks.length} checkable ${checks.length === 1 ? 'claim' : 'claims'} in ${parts.length} sentences` : 'Nothing here we can test yet'}</h2>
      ${checks.length ? '<button type="button" class="play-all">▶ Play the breakdown</button>' : '<p class="fine">A testable claim names a place, something we measure (rain, heat, soil, haze…) and a direction (wetter, hotter, more erratic…).</p>'}
    </header>
    <ol class="art">${parts.map((p) => {
      if (!p.checkable) return `<li class="art-s skip"><p>${esc(p.sentence)}</p><span class="why">Needs ${p.missing.map((m) => need[m]).join(', ')}</span></li>`;
      const c = checks[k];
      const idx = k++;
      return `<li class="art-s hit"><button type="button" data-k="${idx}"><p>${esc(p.sentence)}</p>
        <span class="chip v-${c.result.overall}">${VERDICT_SHORT[c.result.overall]}</span>
        <span class="why">${esc(claimSentence(p.record, p.type, p.place.label))}${p.place.inherited ? ' (place carried from earlier)' : ''}</span></button></li>`;
    }).join('')}</ol>`;
  el.querySelector('.art').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) onClaim(checks[Number(b.dataset.k)]);
  });
  el.querySelector('.play-all')?.addEventListener('click', () => onPlay(checks));
  return checks;
}
