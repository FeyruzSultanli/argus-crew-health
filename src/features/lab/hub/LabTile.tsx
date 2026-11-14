// One Lab hub tile: what it measures, priority, duration estimate, last measured (<Value> with freshness), due status.
import { ArrowRight, FlaskConical } from 'lucide-react';

import type { Observation, Task } from '../../../domain/types';
import { getSignal } from '../../../domain/signals';
import { Badge } from '../../../ui/Badge';
import type { BadgeTone } from '../../../ui/Badge';
import { LinkButton } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { Value } from '../../../ui/Value';
import { freshnessOf } from '../freshness';
import { SIGNAL_NAMES } from '../manual/saveAll';
import { readingSourceIds } from '../provenance';
import type { TileDef } from './tiles';

const DUE: Record<Task['status'], { word: string; tone: BadgeTone }> = {
  due: { word: 'Due today', tone: 'info' },
  overdue: { word: 'Overdue', tone: 'watch' },
  done: { word: 'Done today', tone: 'ok' },
  skipped: { word: 'Skipped', tone: 'neutral' },
};

function LastMeasured({ o, missionDay }: { o: Observation; missionDay: number }) {
  const common = { sourceIds: readingSourceIds(o), label: o.source.label, freshness: freshnessOf(o, missionDay), title: getSignal(o.signalId).label };
  const name = SIGNAL_NAMES[o.signalId] ?? o.signalId;
  if (o.signalId === 'symptoms') {
    const n = Object.values(o.components ?? {}).filter((v) => v === 1).length;
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-text-2">symptoms ticked</span>
        <Value value={n} precision={0} {...common} />
      </span>
    );
  }
  if (o.signalId === 'blood_pressure') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-text-2">{name}</span>
        <Value value={o.components?.diastolic ?? null} prefix={`${o.components?.systolic ?? '—'}/`} unit="mm[Hg]" precision={0} {...common} />
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {o.signalId !== 'reaction_test' && <span className="text-text-2">{name}</span>}
      <Value value={o.value} unit={o.unit} precision={o.signalId === 'reaction_test' ? 2 : undefined} {...common} />
    </span>
  );
}

export interface LabTileProps {
  tile: TileDef;
  last: Observation | undefined;
  /** Plan tasks for this tile's signals; undefined → plan not available. */
  tasks: readonly Task[] | undefined;
  missionDay: number;
  /** CMO has not picked who is being measured yet. */
  noSubject?: boolean;
}

export function LabTile({ tile, last, tasks, missionDay, noSubject = false }: LabTileProps) {
  const Icon = tile.icon;
  const status = tasks?.find((t) => t.status === 'overdue')?.status ?? tasks?.find((t) => t.status === 'due')?.status ?? tasks?.[0]?.status;
  return (
    <Card as="article" headingLevel={2} title={
      <span className="inline-flex items-center gap-2">
        <Icon size={20} aria-hidden="true" className="text-brand" />
        {tile.title}
      </span>
    } actions={<Badge mono>{tile.priority}</Badge>} className="flex flex-col" data-testid={`lab-tile-${tile.id}`}>
      <p className="text-sm text-text-2">{tile.what}</p>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        {tile.live && (
          <div className="flex flex-wrap items-center gap-2">
            <dt className="text-text-3">Takes</dt>
            <dd>{tile.duration ? <Value value={tile.duration.value} unit={tile.duration.unit} precision={0} sourceIds={tile.duration.sourceIds} size="sm" title="Duration estimate" /> : 'self-paced'}</dd>
          </div>
        )}
        {tile.live && (
          <div className="flex flex-wrap items-center gap-2" data-testid={`lab-tile-${tile.id}-last`}>
            <dt className="text-text-3">Last measured</dt>
            <dd>
              {last ? (
                <LastMeasured o={last} missionDay={missionDay} />
              ) : (
                <span className="text-text-2">{noSubject ? 'Choose who is being measured first' : 'Not measured yet'}</span>
              )}
            </dd>
          </div>
        )}
        {status && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Plan</dt>
            <dd>
              <Badge tone={DUE[status].tone}>{DUE[status].word}</Badge>
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {tile.experimental && (
          <Badge tone="watch" icon={FlaskConical}>
            Experimental — not validated
          </Badge>
        )}
        {!tile.live && <Badge>Coming next</Badge>}
        <LinkButton to={`/lab/${tile.id}`} variant={tile.live ? 'primary' : 'secondary'} icon={ArrowRight} aria-label={tile.live ? `Start ${tile.title}` : `Learn more about ${tile.title}`}>
          {tile.live ? 'Start' : 'Learn more'}
        </LinkButton>
      </div>
    </Card>
  );
}
