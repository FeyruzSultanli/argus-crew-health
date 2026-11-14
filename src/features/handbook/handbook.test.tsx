// Handbook: markdown subset renderer (inline tags → badges, no HTML injection), search + category filtering,
// entry page with the subject's current verdict, ErrorState + retry.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import indexJson from '../../../seed/handbook/index.json';
import { mkAssessment } from '../../domain/readiness/fixtures.test-utils';
import type { Assessment } from '../../domain/types';
import { useMissionStore } from '../../state/mission';
import { useSessionStore } from '../../state/session';
import { useUiStore } from '../../state/ui';
import { TestProviders, renderAt } from '../settings/providers.test-utils';
import { clearHandbookCache } from './content';
import type { HandbookIndexItem } from './content';
import { fsFetch } from './fsFetch.test-utils';
import { matchQuestion } from './askHandbook';
import { entryPath, filterHandbook, resolveHandbookParam } from './handbookFilter';
import { Markdown } from './Markdown';
import { parseInline, parseLinkTarget, parseMarkdown } from './markdownSubset';

const h = vi.hoisted(() => ({ byCrew: {} as Record<string, Assessment[] | undefined> }));
vi.mock('../../services/hooks', () => ({
  useAssessments: (id: string) => h.byCrew[id],
  useAllAssessments: () => h.byCrew,
}));

const { default: HandbookPage } = await import('./HandbookPage');

const INDEX = indexJson.entries as HandbookIndexItem[];
const fetchMock = vi.fn(fsFetch);

beforeEach(() => {
  clearHandbookCache();
  fetchMock.mockClear();
  fetchMock.mockImplementation(fsFetch);
  vi.stubGlobal('fetch', fetchMock);
  useMissionStore.setState({ profileId: 'mars-transit', missionDay: 143 });
  useSessionStore.setState({ role: 'crew', crewId: 'c2', signedIn: true });
  useUiStore.setState({ selectedCrewId: null });
  const sleep = mkAssessment('c2', 'sleep_duration', 'WATCH', {
    explanation: 'Your 3-night average is below your usual.',
    action: 'Re-measure. If it is still outside your usual range, tell the CMO.',
  });
  sleep.layers.space.sourceIds = ['SRC_DEMO_RULE_BANDS', 'SRC_SLEEP_BARGER'];
  h.byCrew = { c2: [sleep] };
});
afterEach(() => vi.unstubAllGlobals());

describe('markdown subset', () => {
  it('parses headings, paragraphs, bullet and numbered lists', () => {
    const blocks = parseMarkdown('### Sub\n\nOne\nline.\n\n- a\n- b\n\n1. x\n2. y');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'list']);
    expect(blocks[1]).toEqual({ kind: 'paragraph', children: [{ kind: 'text', text: 'One line.' }] });
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ text: 'a' }], [{ text: 'b' }]] });
    expect(blocks[3]).toMatchObject({ ordered: true });
  });
  it('parses bold, italic, source tags, demo wording and links', () => {
    expect(parseInline('**Earth:** 7 h [SRC_EARTH_SLEEP_7H] *note* [demo wording] [Sleep](sleep)')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'Earth:' }] },
      { kind: 'text', text: ' 7 h ' },
      { kind: 'source', id: 'SRC_EARTH_SLEEP_7H' },
      { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'note' }] },
      { kind: 'text', text: ' ' },
      { kind: 'demo-wording' },
      { kind: 'text', text: ' ' },
      { kind: 'link', href: { kind: 'entry', id: 'sleep' }, children: [{ kind: 'text', text: 'Sleep' }] },
    ]);
  });
  it('drops unsafe link targets', () => {
    expect(parseLinkTarget('javascript:alert(1)')).toBeNull();
    expect(parseLinkTarget('/handbook/heart-rate')).toEqual({ kind: 'entry', id: 'heart-rate' });
    expect(parseLinkTarget('https://example.org/x')).toEqual({
      kind: 'external',
      url: 'https://example.org/x',
    });
    const unsafe = parseInline('[x](javascript:alert(1))');
    expect(unsafe.some((p) => p.kind === 'link')).toBe(false);
    expect(unsafe[0]).toEqual({ kind: 'text', text: 'x' });
  });
  it('renders tags as SourceBadges / Demo wording and never injects HTML', () => {
    const { container } = render(
      <TestProviders>
        <Markdown
          markdown={
            'Text <script>alert(1)</script> <b>x</b> [SRC_SLEEP_BARGER] [demo wording]\n\n- [SRC_NASA_RISKS]'
          }
        />
      </TestProviders>,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container).toHaveTextContent('<script>alert(1)</script> <b>x</b>');
    expect(screen.getAllByRole('button', { name: /^Sources:/ })).toHaveLength(2);
    expect(screen.getByText('Demo wording')).toBeInTheDocument();
  });
});

describe('search and categories', () => {
  it('no query lists everything in category order; a category filters', () => {
    expect(filterHandbook(INDEX, '', 'all')).toHaveLength(INDEX.length);
    const protocolsOnly = filterHandbook(INDEX, '', 'protocols');
    expect(protocolsOnly).toHaveLength(5);
    expect(protocolsOnly.every((i) => i.category === 'protocols')).toBe(true);
    expect(filterHandbook(INDEX, '', 'all')[0]?.category).toBe('signals');
  });
  it('"sleep" finds the sleep entry first; with category protocols the sleep-debt protocol', () => {
    expect(filterHandbook(INDEX, 'sleep', 'all')[0]?.id).toBe('sleep');
    expect(filterHandbook(INDEX, 'sleep', 'protocols').map((i) => i.id)).toEqual(['protocol-sleep-debt']);
    expect(filterHandbook(INDEX, 'qwertyzzz', 'all')).toEqual([]);
  });
  it('protocol entries route to the runner; both URL forms resolve to the protocol', () => {
    const p = INDEX.find((i) => i.id === 'protocol-suspected-infection');
    expect(p && entryPath(p)).toBe('/handbook/suspected-infection');
    expect(resolveHandbookParam('suspected-infection')).toEqual({
      kind: 'protocol',
      id: 'suspected-infection',
    });
    expect(resolveHandbookParam('protocol-spe-shelter')).toEqual({ kind: 'protocol', id: 'spe-shelter' });
    expect(resolveHandbookParam('sleep')).toEqual({ kind: 'entry', id: 'sleep' });
  });
  it('index page: search box and category filter drive the list (and ?category=protocols)', async () => {
    renderAt(<HandbookPage />, '/handbook?category=protocols', '/handbook');
    const list = await screen.findByTestId('handbook-results');
    expect(within(list).getAllByRole('link')).toHaveLength(5);
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    fireEvent.change(screen.getByTestId('handbook-search'), { target: { value: 'sleep' } });
    const first = within(screen.getByTestId('handbook-results')).getAllByRole('link')[0];
    expect(first).toHaveAttribute('href', '/handbook/sleep');
  });
});

describe('entry page', () => {
  it('renders sections with badges and the current verdict of the signed-in crew member', async () => {
    renderAt(<HandbookPage />, '/handbook/sleep', '/handbook/:entry');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sleep duration' })).toBeInTheDocument();
    for (const heading of [
      'What it is',
      'Why it matters in space',
      'How ARGUS judges it',
      'What to do',
      'Sources',
    ])
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    const verdict = screen.getByTestId('entry-verdict');
    expect(within(verdict).getByText('Watch')).toBeInTheDocument();
    expect(within(verdict).getByTestId('verdict-action')).toHaveTextContent(
      'Re-measure. If it is still outside your usual range, tell the CMO.',
    );
    expect(within(verdict).getByRole('link', { name: /Open M. Ito on Body/ })).toHaveAttribute(
      'href',
      '/body/c2',
    );
    expect(screen.getAllByText('Demo wording').length).toBeGreaterThan(0);
  });
  it('shows an ErrorState with retry when the file cannot be fetched', async () => {
    fetchMock.mockImplementation(async () => new Response('offline', { status: 503 }));
    renderAt(<HandbookPage />, '/handbook/sleep', '/handbook/:entry');
    const retry = await screen.findByRole('button', { name: /Retry|Try again/ });
    fetchMock.mockImplementation(fsFetch);
    fireEvent.click(retry);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sleep duration' })).toBeInTheDocument();
  });
});

describe('Ask box', () => {
  it('matches by keywords only (pure)', () => {
    expect(matchQuestion(INDEX, 'What should I do about my sleep?').map((i) => i.id)).toEqual([
      'sleep',
      'protocol-sleep-debt',
    ]);
    expect(matchQuestion(INDEX, 'xyzzy blorp')).toEqual([]);
    expect(matchQuestion(INDEX, 'what should I do')).toEqual([]); // stopwords only
  });

  it('"What should I do about my sleep?" → the sleep entry and the current sleep verdict with sources', async () => {
    renderAt(<HandbookPage />, '/handbook', '/handbook');
    await screen.findByTestId('handbook-results');
    fireEvent.change(screen.getByTestId('ask-input'), {
      target: { value: 'What should I do about my sleep?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    const answer = screen.getByTestId('ask-answer');
    const sleep = within(answer).getByTestId('answer-entry-sleep');
    expect(sleep).toHaveTextContent('How many hours you slept, judged on the 3-night average');
    expect(await within(sleep).findByText(/Keep doing your countermeasures/)).toBeInTheDocument();
    expect(within(sleep).getAllByText('Demo wording').length).toBeGreaterThan(0);
    const verdict = within(answer).getByTestId('verdict-sleep_duration');
    expect(within(verdict).getByText('Watch')).toBeInTheDocument();
    expect(verdict).toHaveTextContent('Your 3-night average is below your usual.');
    expect(within(verdict).getByTestId('verdict-action')).toHaveTextContent(
      'Re-measure. If it is still outside your usual range, tell the CMO.',
    );
    expect(within(verdict).getByRole('button', { name: /^Sources:/ })).toBeInTheDocument();
    const used = within(answer).getByTestId('entries-used');
    expect(within(used).getByRole('link', { name: 'Sleep duration' })).toHaveAttribute(
      'href',
      '/handbook/sleep',
    );
  });

  it('a nonsense question → exactly "I don\'t have that."', async () => {
    renderAt(<HandbookPage />, '/handbook', '/handbook');
    await screen.findByTestId('handbook-results');
    fireEvent.change(screen.getByTestId('ask-input'), { target: { value: 'xyzzy blorp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(screen.getByTestId('ask-no-answer').textContent).toBe("I don't have that.");
    expect(screen.queryByTestId('ask-answer')).toBeNull();
  });
});
