// PNG export of the current Trends view (doc 11 §5.3): the chart SVGs are cloned with their computed colours inlined
// (CSS variables do not survive serialisation), laid out in a grid with the title, SIMULATED label and source ids as
// text, drawn onto a canvas and downloaded. Same-origin only; no external resources (fonts fall back to system ones).
const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'fill-opacity',
  'opacity',
  'font-size',
  'font-weight',
  'text-anchor',
] as const;

/** Copy resolved presentation styles from the live element tree onto the clone. */
function inlineStyles(src: Element, dst: Element): void {
  const cs = getComputedStyle(src);
  for (const p of STYLE_PROPS) {
    const v = cs.getPropertyValue(p);
    if (v) dst.setAttribute(p, v);
  }
  if (src.tagName.toLowerCase() === 'text' || src.tagName.toLowerCase() === 'tspan')
    dst.setAttribute('font-family', 'monospace');
  const a = src.children;
  const b = dst.children;
  for (let i = 0; i < a.length && i < b.length; i++) {
    const s = a[i];
    const d = b[i];
    if (s && d) inlineStyles(s, d);
  }
}

function text(
  x: number,
  y: number,
  s: string,
  size: number,
  fill: string,
  weight = 'normal',
): SVGTextElement {
  const t = document.createElementNS(SVG_NS, 'text');
  t.setAttribute('x', String(x));
  t.setAttribute('y', String(y));
  t.setAttribute('font-family', 'sans-serif');
  t.setAttribute('font-size', String(size));
  t.setAttribute('font-weight', weight);
  t.setAttribute('fill', fill);
  t.textContent = s;
  return t;
}

export interface PngHeader {
  title: string;
  subtitle: string;
}

/** Build one SVG document of every chart card under `root`. Returns null when no chart is drawn. */
export function composeSvg(
  root: HTMLElement,
  header: PngHeader,
): { svg: SVGSVGElement; width: number; height: number } | null {
  const cards = [...root.querySelectorAll<HTMLElement>('[data-trend-card]')];
  const panels = cards
    .map((card) => ({
      card,
      svg: card.querySelector<SVGSVGElement>('[data-trend-svg] svg.recharts-surface'),
    }))
    .filter((p): p is { card: HTMLElement; svg: SVGSVGElement } => p.svg !== null);
  if (panels.length === 0) return null;
  const css = getComputedStyle(document.body);
  const bg = css.backgroundColor || '#0b0f14';
  const fg = css.color || '#e6e9ee';
  const cols = panels.length > 1 ? 2 : 1;
  const pw = Math.max(...panels.map((p) => p.svg.getBoundingClientRect().width));
  const ph = Math.max(...panels.map((p) => p.svg.getBoundingClientRect().height));
  const pad = 24;
  const head = 64;
  const cellH = ph + 56;
  const width = Math.ceil(cols * (pw + pad) + pad);
  const rows = Math.ceil(panels.length / cols);
  const height = Math.ceil(head + rows * cellH + pad);
  const out = document.createElementNS(SVG_NS, 'svg');
  out.setAttribute('xmlns', SVG_NS);
  out.setAttribute('width', String(width));
  out.setAttribute('height', String(height));
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', bg);
  out.appendChild(rect);
  out.appendChild(text(pad, 30, header.title, 18, fg, '600'));
  out.appendChild(text(pad, 50, header.subtitle, 12, fg));
  panels.forEach((p, i) => {
    const x = pad + (i % cols) * (pw + pad);
    const y = head + Math.floor(i / cols) * cellH;
    const title = p.card.querySelector('h2')?.textContent ?? '';
    out.appendChild(text(x, y + 14, title, 14, fg, '600'));
    const clone = p.svg.cloneNode(true) as SVGSVGElement;
    inlineStyles(p.svg, clone);
    clone.setAttribute('x', String(x));
    clone.setAttribute('y', String(y + 22));
    out.appendChild(clone);
    const ids = p.card.dataset.sourceIds ?? '';
    out.appendChild(text(x, y + 22 + ph + 22, `Sources: ${ids}`, 10, fg));
  });
  return { svg: out, width, height };
}

/** Rasterise the composed SVG to a PNG blob (2× scale). */
export async function svgToPng(svg: SVGSVGElement, width: number, height: number): Promise<Blob> {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The chart image could not be rendered.'));
      img.src = url;
    });
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
