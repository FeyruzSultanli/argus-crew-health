// Safe renderer for the handbook Markdown subset: React elements and text nodes only (no dangerouslySetInnerHTML).
// [SRC_…] → SourceBadge (opens the SourceDrawer); [demo wording] → a visible "Demo wording" tag.
// Prose line height 1.85 (≈ 26 px): badges are 44 px targets, so badges on consecutive lines keep ≥ 24 px of
// unobscured target (axe target-size, WCAG 2.5.8).
import { Link } from 'react-router';
import { ExternalLink } from 'lucide-react';

import { SourceBadge, getSource } from '../../ui';
import { parseInline, parseMarkdown, soleSourceId } from './markdownSubset';
import type { Block, Inline } from './markdownSubset';

export function DemoWordingTag() {
  return (
    <span className="mx-0.5 inline-flex h-5 items-center rounded-[5px] border border-dashed border-border-strong px-1.5 align-middle font-mono text-[11px] tracking-wide text-text-2">
      Demo wording
    </span>
  );
}

export function InlineContent({ parts }: { parts: readonly Inline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        switch (p.kind) {
          case 'text':
            return <span key={i}>{p.text}</span>;
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-text">
                <InlineContent parts={p.children} />
              </strong>
            );
          case 'em':
            return (
              <em key={i}>
                <InlineContent parts={p.children} />
              </em>
            );
          case 'source':
            return (
              <span key={i} className="mx-0.5 inline-flex align-middle">
                <SourceBadge sourceIds={[p.id]} title={getSource(p.id)?.title} />
              </span>
            );
          case 'demo-wording':
            return <DemoWordingTag key={i} />;
          case 'link':
            return p.href.kind === 'entry' ? (
              <Link key={i} to={`/handbook/${p.href.id}`} className="text-brand underline underline-offset-2">
                <InlineContent parts={p.children} />
              </Link>
            ) : (
              <a
                key={i}
                href={p.href.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-brand underline underline-offset-2"
              >
                <InlineContent parts={p.children} />
                <ExternalLink size={12} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            );
        }
        return null;
      })}
    </>
  );
}

function SourceLine({ id }: { id: string }) {
  const src = getSource(id);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <SourceBadge sourceIds={[id]} title={src?.title} />
      <span className="text-text">{src?.title ?? id}</span>
    </span>
  );
}

function BlockView({ block, headingOffset }: { block: Block; headingOffset: number }) {
  if (block.kind === 'heading') {
    const level = Math.min(6, block.level + headingOffset);
    const H = `h${level}` as 'h3';
    return (
      <H className="mt-4 text-sm font-semibold text-text">
        <InlineContent parts={block.children} />
      </H>
    );
  }
  if (block.kind === 'paragraph') {
    return (
      <p className="leading-[1.85] text-text-2">
        <InlineContent parts={block.children} />
      </p>
    );
  }
  const L = block.ordered ? 'ol' : 'ul';
  return (
    <L className={block.ordered ? 'list-decimal space-y-1.5 pl-6' : 'list-disc space-y-1.5 pl-6'}>
      {block.items.map((item, i) => {
        const sole = soleSourceId(item);
        return (
          <li key={i} className="leading-[1.85] text-text-2">
            {sole ? <SourceLine id={sole} /> : <InlineContent parts={item} />}
          </li>
        );
      })}
    </L>
  );
}

export interface MarkdownProps {
  markdown: string;
  /** Added to `#` levels inside the body (section headings are h2, so `###` → h3 with offset 0). */
  headingOffset?: number;
  className?: string;
}

export function Markdown({ markdown, headingOffset = 0, className }: MarkdownProps) {
  const blocks = parseMarkdown(markdown);
  return (
    <div className={className ?? 'flex flex-col gap-3 text-sm'}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} headingOffset={headingOffset} />
      ))}
    </div>
  );
}

/** One line of text with inline tags (protocol trigger, summaries). */
export function TaggedText({ text }: { text: string }) {
  return <InlineContent parts={parseInline(text)} />;
}
