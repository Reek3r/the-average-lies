import { parseArticle } from '../claim/parse.js';
import { readInput, isUrl } from '../claim/read.js';
import { checkClaim, VERDICTS } from '../claim/evaluate.js';
import { claimSentence } from '../claim/vocab.js';
import { esc } from '../ui/format.js';
import { NEWS } from '../content/news.js';
import { VERDICT_SHORT, verdictSentence } from '../tool/check.js';

const KEY = 'average-lies-desk-v2';
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
};
const save = (cards) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(cards));
  } catch {
    /* private mode: the board still works for this visit */
  }
};

/**
 * The fact-check desk: paste claims or a whole article, keep a board of
 * checked claims with notes, export the lot as a report.
 */
export function renderDesk(el, ctx, { onShow }) {
  let cards = load();
  let skipped = [];
  const newsV = NEWS.map((n) => {
    const p = parseArticle(n.test, ctx.index).find((x) => x.checkable);
    return p ? checkClaim(ctx.checks, p.place.ids, p.record, p.type).overall : 'not_shown';
  });
  el.innerHTML = `
    <div class="desk2">
      <header class="plate-head"><p class="plate-k">Plate 02 · Claims desk</p><h2>Test what the news says</h2>
        <p class="sub">Paste an article link, a whole article, or one sentence. The desk finds every sentence that claims a place is getting wetter, drier, hotter or more extreme, and tests it against 25 years of NASA measurements.</p>
        <p class="mvp">MVP · Claims are read with a fixed word list, so loosely worded or opinion sentences may not be picked up. Some news sites block link reading; paste the text instead.</p></header>
      <section class="intake">
        <div class="slip">
          <p class="slip-k"><span>Claim slip</span><span class="slip-n">No sentences yet</span></p>
          <label class="sr-only" for="desk-text">Text to check</label>
          <textarea id="desk-text" rows="6" placeholder="Paste a link to an article, or its text. Try: Rain in Balochistan is getting more erratic. Droughts in Somalia are getting worse."></textarea>
          <ol class="slip-preview" aria-live="polite"></ol>
          <div class="desk-actions"><button type="button" class="btn-solid desk-go">Check claims</button><button type="button" class="btn-line desk-clear-in">Clear</button></div>
          <div class="slip-result" aria-live="polite" hidden></div>
        </div>
        <div class="clips">
          <p class="slip-k"><span>Or try a real news claim</span><span>Tap to check it</span></p>
          <ul class="desk-news">${NEWS.map((n, k) => `<li style="--r:${[-1.2, 0.8, -0.5, 1.1, -0.9, 0.6][k % 6]}deg"><button type="button" data-n="${k}"><span class="cl-meta">${esc(n.outlet)} · ${esc(n.date)}</span><span class="cl-said">${esc(n.said)}</span><span class="cl-foot"><span class="chip v-${newsV[k]}">${VERDICT_SHORT[newsV[k]]}</span><span>${esc(n.test)}</span></span></button></li>`).join('')}</ul>
        </div>
      </section>
      <section class="desk-board" aria-live="polite">
        <div class="board-bar">
          <h2>Evidence board <span class="count"></span></h2>
          <div class="board-tools">
            <button type="button" class="btn-line" data-x="copy">Copy report</button>
            <button type="button" class="btn-line" data-x="download">Download .md</button>
            <button type="button" class="btn-line" data-x="clear">Clear board</button>
          </div>
        </div>
        <div class="tally" aria-label="Verdicts on the board"></div>
        <ol class="howto"><li><b>1 · Claim</b>The sentence, as written.</li><li><b>2 · Tested as</b>The place, the measure and which test we ran.</li><li><b>3 · Study areas</b>Every 220 km area inside that place, grouped by what its data shows. Thicker lines mean more areas.</li><li><b>4 · Verdict</b>What the areas add up to.</li></ol>
        <div class="flow-head" aria-hidden="true"><span>Claim</span><span>Tested as</span><span>Study areas</span><span>Verdict</span></div>
        <p class="board-msg" hidden></p>
        <ol class="cards"></ol>
        <details class="skipped" hidden><summary></summary><ul></ul></details>
      </section>
    </div>`;
  const textarea = el.querySelector('#desk-text');
  const list = el.querySelector('.cards');
  const msg = el.querySelector('.board-msg');

  function check(text, source = null) {
    const parts = parseArticle(text, ctx.index);
    el.dataset.fresh = String(Math.max(1, parts.filter((x) => x.checkable).length));
    const added = [];
    skipped = parts.filter((p) => !p.checkable);
    for (const p of parts.filter((x) => x.checkable)) {
      const r = checkClaim(ctx.checks, p.place.ids, p.record, p.type);
      added.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sentence: p.sentence,
        tested: claimSentence(p.record, p.type, p.place.label),
        place: { label: p.place.label, kind: p.place.kind, ids: p.place.ids },
        record: p.record,
        type: p.type,
        verdict: r.overall,
        answer: verdictSentence(r, p.record, p.type, p.place.label),
        areas: r.areas.length,
        test: r.areas[0]?.test ?? (p.type === 'wilder' || p.type === 'steadier' ? 'swings' : 'average'),
        groups: ['backed', 'opposite', 'not_shown'].map((v) => ({ v, names: r.areas.filter((a) => a.verdict === v).map((a) => ctx.regions[a.areaIndex].name.split(',')[0]) })).filter((g) => g.names.length),
        source,
        note: '',
      });
    }
    cards = [...added, ...cards];
    save(cards);
    render(added.length, parts.length);
    const res = el.querySelector('.slip-result');
    const n = (v) => added.filter((c) => c.verdict === v).length;
    const vs = [...new Set(added.map((c) => c.verdict))].map((v) => `<span class="chip v-${v}">${VERDICT_SHORT[v]} ${n(v)}</span>`).join(' ');
    res.hidden = false;
    res.className = `slip-result ${added.length ? 'ok' : 'none'}`;
    res.innerHTML = added.length
      ? `<p><b>${added.length} testable ${added.length === 1 ? 'claim' : 'claims'}</b> found in ${parts.length} ${parts.length === 1 ? 'sentence' : 'sentences'}${source?.title ? ` of “${esc(source.title)}”` : ''}.</p><p class="sr-v">${vs}</p><button type="button" class="btn-solid" data-x="jump">See the evidence ↓</button>`
      : `<p><b>No testable claims</b> in ${parts.length} ${parts.length === 1 ? 'sentence' : 'sentences'}${source?.title ? ` of “${esc(source.title)}”` : ''}.</p><p>A claim is testable when it names a place we cover, a measure (rain, heat, soil, floods, drought, dust…) and a direction (getting wetter, hotter, more extreme…). Opinion and policy sentences can’t be checked against measurements. The reasons for each sentence are listed under the board.</p>`;
    if (added.length) setTimeout(jump, 350);
  }
  function jump() {
    const first = list.querySelector('.flow');
    if (!first) return;
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    list.querySelectorAll('.flow').forEach((f, k) => k < (Number(el.dataset.fresh) || 1) && f.classList.add('fresh'));
    setTimeout(() => list.querySelectorAll('.fresh').forEach((f) => f.classList.remove('fresh')), 2600);
  }
  async function run(raw, source = null) {
    const t = raw.trim();
    if (!t) return;
    const res = el.querySelector('.slip-result');
    if (isUrl(t)) {
      res.hidden = false;
      res.className = 'slip-result busy';
      res.innerHTML = '<p><b>Reading the article…</b></p>';
      try {
        const r = await readInput(t);
        el.dataset.fresh = '99';
        check(r.text, { outlet: r.source.outlet, date: 'linked article', url: r.source.url, title: r.source.title });
      } catch (e) {
        res.className = 'slip-result none';
        res.innerHTML = `<p><b>Couldn’t read that link.</b></p><p>${esc(e.message)}</p>`;
      }
      return;
    }
    check(t, source);
  }

  function render(added = null, total = null) {
    el.querySelector('.count').textContent = cards.length ? `· ${cards.length}` : '';
    msg.hidden = added === null;
    if (added !== null) msg.textContent = added ? `Added ${added} of ${total} sentences.` : `None of the ${total} sentences could be tested. See the reasons below.`;
    const GL = { backed: 'Back it', opposite: 'Show the opposite', not_shown: 'No clear change' };
    list.innerHTML = cards.length ? cards.map((c, k) => `
      <li class="flow" data-id="${c.id}">
        <div class="fn f-claim"><span class="fn-k"><b class="idx">${cards.length - k}</b>${c.source ? esc(c.source.outlet) : 'Your text'}</span>
          <p class="cx-s"><mark class="m-${c.verdict}">${esc(c.sentence)}</mark></p>
          ${c.source ? `<a class="cx-src" href="${esc(c.source.url)}" target="_blank" rel="noopener">${esc(c.source.date)} ↗</a>` : ''}</div>
        <div class="fn f-test"><span class="fn-k">Tested as</span>
          <dl><dt>Place</dt><dd>${esc(c.place.label)}</dd><dt>Measure</dt><dd>${esc(c.tested.split(' in ')[0] || c.tested)}</dd><dt>Test</dt><dd>${c.test === 'swings' ? 'Swings' : 'Average'} · ${c.areas} ${c.areas === 1 ? 'area' : 'areas'}</dd></dl></div>
        <div class="f-areas">${(c.groups ?? []).map((g) => `<div class="fn gnode g-${g.v}" data-g="${g.v}" style="--w:${g.names.length}"><span class="fn-k">${GL[g.v]} · ${g.names.length}</span><p>${esc(g.names.slice(0, 4).join(', '))}${g.names.length > 4 ? ` +${g.names.length - 4} more` : ''}</p></div>`).join('')}</div>
        <div class="fn f-verdict"><span class="stamp-x v-${c.verdict}">${VERDICT_SHORT[c.verdict]}</span><p class="cx-a">${esc(c.answer)}</p>
          <div class="fv-act"><button type="button" class="btn-line" data-show="${c.id}">Open on globe</button><button type="button" class="cx-del" data-del="${c.id}" aria-label="Remove">×</button></div>
          <label class="cx-note"><span>Notes</span><textarea data-note="${c.id}" rows="1" placeholder="Context, a source, a follow-up">${esc(c.note)}</textarea></label></div>
        <svg class="wires" aria-hidden="true"></svg>
      </li>`).join('') : '<li class="empty">The board is empty. Paste text above or tap a clipping, and each claim will be traced here.</li>';
    tally();
    requestAnimationFrame(wire);
    const sk = el.querySelector('.skipped');
    sk.hidden = !skipped.length;
    sk.querySelector('summary').textContent = `${skipped.length} ${skipped.length === 1 ? 'sentence' : 'sentences'} set aside`;
    const need = { place: 'a place we cover', record: 'a measure', type: 'a direction' };
    sk.querySelector('ul').innerHTML = skipped.map((p) => `<li><span>${esc(p.sentence)}</span><em>Missing ${p.missing.map((m) => need[m]).join(', ')}</em></li>`).join('');
  }

  const INK = { backed: '#1b1a17', opposite: '#ff6c2f', not_shown: '#9a917f' };
  function wire() {
    const wide = el.clientWidth >= 900;
    list.querySelectorAll('.flow').forEach((f) => {
      const svg = f.querySelector('.wires');
      if (!wide) { svg.innerHTML = ''; return; }
      const R = f.getBoundingClientRect();
      const box = (n) => { const b = n.getBoundingClientRect(); return { l: b.left - R.left, r: b.right - R.left, m: b.top - R.top + b.height / 2 }; };
      const A = box(f.querySelector('.f-claim'));
      const T = box(f.querySelector('.f-test'));
      const V = box(f.querySelector('.f-verdict'));
      const curve = (x1, y1, x2, y2, col, w, dash) => `<path d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}" stroke="${col}" stroke-width="${w}" fill="none" ${dash ? 'stroke-dasharray="4 4"' : ''}/>`;
      let d = curve(A.r, A.m, T.l, T.m, '#1b1a17', 2);
      f.querySelectorAll('.gnode').forEach((g) => {
        const G = box(g);
        const w = Math.min(10, 1.5 + Number(g.style.getPropertyValue('--w')) * 1.2);
        const col = INK[g.dataset.g];
        d += curve(T.r, T.m, G.l, G.m, col, w, g.dataset.g === 'not_shown');
        d += curve(G.r, G.m, V.l, V.m, col, Math.max(1.5, w * 0.6), g.dataset.g === 'not_shown');
        d += `<circle cx="${G.l}" cy="${G.m}" r="4" fill="${col}"/>`;
      });
      d += `<circle cx="${T.l}" cy="${T.m}" r="4" fill="#1b1a17"/><circle cx="${V.l}" cy="${V.m}" r="4" fill="#1b1a17"/>`;
      svg.setAttribute('width', R.width);
      svg.setAttribute('height', R.height);
      svg.innerHTML = d;
    });
  }
  const ro = new ResizeObserver(() => wire());
  ro.observe(el);
  function tally() {
    const t = el.querySelector('.tally');
    if (!cards.length) { t.innerHTML = ''; return; }
    const order = ['backed', 'partly', 'depends', 'partly_opposite', 'opposite', 'not_shown', 'no_data'];
    const n = (v) => cards.filter((c) => c.verdict === v).length;
    t.innerHTML = `<div class="tally-bar">${order.filter(n).map((v) => `<span class="tb v-${v}" style="flex:${n(v)}" title="${VERDICT_SHORT[v]}: ${n(v)}">${n(v)}</span>`).join('')}</div>
      <div class="tally-key">${order.filter(n).map((v) => `<span><i class="tb v-${v}"></i>${VERDICT_SHORT[v]} ${n(v)}</span>`).join('')}</div>`;
  }
  const need = { place: 'no place we cover', record: 'no measure', type: 'no direction' };
  let pt = 0;
  function preview() {
    clearTimeout(pt);
    pt = setTimeout(() => {
      const text = textarea.value.trim();
      if (isUrl(text)) {
        el.querySelector('.slip-n').textContent = 'Link';
        el.querySelector('.slip-preview').innerHTML = '<li class="ok"><em>Article link · press Check claims to read it</em></li>';
        return;
      }
      const parts = text ? parseArticle(text, ctx.index) : [];
      const ok = parts.filter((p) => p.checkable).length;
      el.querySelector('.slip-n').textContent = parts.length ? `${ok} of ${parts.length} testable` : 'No sentences yet';
      el.querySelector('.slip-preview').innerHTML = parts.map((p) => `<li class="${p.checkable ? 'ok' : 'no'}"><span>${esc(p.sentence)}</span><em>${p.checkable ? `${esc(p.place.label)}${p.place.inherited ? ' (from earlier)' : ''}` : esc(p.missing.map((m) => need[m]).join(', '))}</em></li>`).join('');
    }, 180);
  }

  function report() {
    const lines = ['# Fact-check report', '', `Checked against NASA data, monthly 2000–2024, 360 study areas. Generated by The Average Lies.`, ''];
    cards.forEach((c, k) => {
      lines.push(`## ${k + 1}. ${c.sentence}`, '', `- Tested as: ${c.tested} (${c.areas} ${c.areas === 1 ? 'area' : 'areas'})`, `- Verdict: ${VERDICTS[c.verdict].label}`, `- ${c.answer}`);
      if (c.source) lines.push(`- Source: ${c.source.outlet}, ${c.source.date}, ${c.source.url}`);
      if (c.note) lines.push(`- Notes: ${c.note}`);
      lines.push('');
    });
    lines.push('Method: seasonal trend with Newey–West errors; swings = trend in the size of monthly departures; Benjamini–Hochberg correction across all tests (fewer than 1 in 20 passes expected to be chance).');
    return lines.join('\n');
  }

  el.querySelector('.desk-go').addEventListener('click', () => run(textarea.value));
  textarea.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(textarea.value); });
  textarea.addEventListener('input', preview);
  el.querySelector('.desk-clear-in').addEventListener('click', () => {
    textarea.value = '';
    preview();
    textarea.focus();
  });
  el.querySelector('.desk-news').addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    const n = NEWS[Number(b.dataset.n)];
    textarea.value = n.said;
    preview();
    check(n.test, { outlet: n.outlet, date: n.date, url: n.url });
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.del) {
      cards = cards.filter((c) => c.id !== b.dataset.del);
      save(cards);
      render();
    } else if (b.dataset.show) {
      const c = cards.find((x) => x.id === b.dataset.show);
      onShow({ place: c.place, record: c.record, type: c.type }, c.sentence);
    } else if (b.dataset.x === 'jump') jump();
    else if (b.dataset.x === 'clear') {
      cards = [];
      skipped = [];
      save(cards);
      render();
    } else if (b.dataset.x === 'copy') {
      try {
        await navigator.clipboard.writeText(report());
        b.textContent = 'Copied';
      } catch {
        b.textContent = 'Copy blocked';
      }
      setTimeout(() => (b.textContent = 'Copy report'), 1800);
    } else if (b.dataset.x === 'download') {
      const url = URL.createObjectURL(new Blob([report()], { type: 'text/markdown' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fact-check-report.md';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  el.addEventListener('input', (e) => {
    const t = e.target.closest('[data-note]');
    if (!t) return;
    const c = cards.find((x) => x.id === t.dataset.note);
    if (c) {
      c.note = t.value;
      save(cards);
    }
  });
  render();
  return { check: (text) => { textarea.value = text; preview(); run(text); }, destroy: () => ro.disconnect() };
}
