// Parser for the small Markdown subset the handbook entries use (FR-HELP-1): headings, paragraphs, bullet and
// numbered lists, **bold**, *italic*, [links](target) and the inline tags [SRC_…] / [demo wording].
// It produces plain data; the renderer turns it into React elements (text nodes only — never HTML), so markup or a
// <script> inside content shows up as literal text.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'link'; href: LinkTarget; children: Inline[] }
  | { kind: 'source'; id: string }
  | { kind: 'demo-wording' };

/** Where a link may go: another handbook entry, or an external http(s) page. Anything else is dropped. */
export type LinkTarget = { kind: 'entry'; id: string } | { kind: 'external'; url: string };

export type Block =
  | { kind: 'heading'; level: number; children: Inline[] }
  | { kind: 'paragraph'; children: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] };

const INLINE_RE =
  /\[(SRC_[A-Z0-9_]+)\]|\[demo wording\]|\*\*(.+?)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Accepts `/handbook/<id>`, `handbook/<id>`, `<id>` (kebab-case) and http(s) URLs. */
export function parseLinkTarget(href: string): LinkTarget | null {
  if (/^https?:\/\/[^\s]+$/i.test(href)) return { kind: 'external', url: href };
  const m = /^(?:\/?handbook\/)?([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(href);
  return m?.[1] ? { kind: 'entry', id: m[1] } : null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const at = m.index;
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) });
    const [whole, src, strong, em, linkText, href] = m;
    if (src !== undefined) out.push({ kind: 'source', id: src });
    else if (strong !== undefined) out.push({ kind: 'strong', children: parseInline(strong) });
    else if (em !== undefined) out.push({ kind: 'em', children: parseInline(em) });
    else if (linkText !== undefined && href !== undefined) {
      const target = parseLinkTarget(href);
      out.push(
        target
          ? { kind: 'link', href: target, children: parseInline(linkText) }
          : { kind: 'text', text: linkText },
      );
    } else if (whole === '[demo wording]') out.push({ kind: 'demo-wording' });
    last = at + whole.length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;

export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'paragraph', children: parseInline(para.join(' ')) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };

  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') {
      flushPara();
      flushList();
      continue;
    }
    const h = HEADING.exec(line);
    if (h?.[1] && h[2] !== undefined) {
      flushPara();
      flushList();
      blocks.push({ kind: 'heading', level: h[1].length, children: parseInline(h[2]) });
      continue;
    }
    const b = BULLET.exec(line);
    const o = b ? null : ORDERED.exec(line);
    const item = b?.[1] ?? o?.[1];
    if (item !== undefined) {
      flushPara();
      const ordered = o !== null;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(item);
      continue;
    }
    if (list && /^\s+/.test(raw)) {
      // indented continuation of the last list item
      const items = list.items;
      items[items.length - 1] = `${items[items.length - 1] ?? ''} ${line}`;
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/** A list item that is only a source tag (the `## Sources` lists): rendered as badge + source title. */
export function soleSourceId(item: readonly Inline[]): string | null {
  const parts = item.filter((p) => !(p.kind === 'text' && p.text.trim() === ''));
  const only = parts[0];
  return parts.length === 1 && only?.kind === 'source' ? only.id : null;
}
