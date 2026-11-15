/**
 * Turn what the user pasted into plain text. A link is read through a public
 * reader service (r.jina.ai), which returns the article as text. Paywalled or
 * blocked sites return an error page instead; we detect that and say so.
 */
export const isUrl = (t) => /^https?:\/\/\S+$/i.test(t.trim());

export async function readInput(raw) {
  const t = raw.trim();
  if (!isUrl(t)) return { text: t, source: null };
  let body;
  try {
    const r = await fetch(`https://r.jina.ai/${t}`);
    body = await r.text();
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    throw new Error('The link couldn’t be opened from here. Copy the article text and paste it instead.');
  }
  const blocked = /Warning: Target URL returned error (4\d\d)|Access Issue|unusual activity|subscribe to continue|Payment Required/i.test(body);
  const title = body.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || '';
  const md = body.split(/^Markdown Content:\s*$/m)[1] ?? body;
  const text = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .split('\n')
    .map((l) => l.replace(/^[#>*\-\s]+/, '').trim())
    .filter((l) => l.length > 40 && !/^(Image|Share|Advertisement|Related|Sign up|Read more)/i.test(l))
    .join(' ');
  if (blocked || text.length < 200) {
    throw new Error(`${new URL(t).hostname.replace(/^www\./, '')} blocks automatic reading (paywall or bot check). Open the article, copy its text, and paste it here.`);
  }
  return { text, source: { url: t, title, outlet: new URL(t).hostname.replace(/^www\./, '') } };
}
