// Static "Coming next" cards for the Lab flows not built yet (vision, device import, face scan). The vision work
// package may replace the vision card with the real flow. Texts paraphrase docs/09 §2, §3, §6.
import { ArrowLeft, FlaskConical } from 'lucide-react';

import { Badge } from '../../../ui/Badge';
import { LinkButton } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { SourceBadge } from '../../../ui/SourceBadge';
import type { ComingFlow } from './tiles';


function Body({ flow }: { flow: ComingFlow }) {
  if (flow === 'vision') {
    return (
      <div className="flex flex-col gap-3 text-sm text-text-2">
        <p>
          On the ISS, the in-flight vision exam includes acuity software and an Amsler grid run on a laptop{' '}
          <SourceBadge sourceIds={['SRC_VISION_ISS']} title="ISS vision exam" />. Spaceflight-associated neuro-ocular
          syndrome (SANS) affects a majority of long-duration crew <SourceBadge sourceIds={['SRC_SANS_CAMBRIDGE']} title="SANS" />.
        </p>
        <p>ARGUS will offer the same two checks on this screen — an Amsler grid per eye and a near-acuity test — for screening only.</p>
      </div>
    );
  }
  if (flow === 'import') {
    return (
      <p className="text-sm text-text-2">
        Import readings from CSV or JSON files and map their columns to ARGUS signals. Formats like CSA&apos;s Bio-Monitor
        smart shirt <SourceBadge sourceIds={['SRC_BIOMONITOR']} title="Bio-Monitor" /> or the ARCHeR actigraph{' '}
        <SourceBadge sourceIds={['SRC_ARCHER_NASA']} title="ARCHeR" /> would plug in here via an adapter.
      </p>
    );
  }
  return (
    <p className="text-sm text-text-2">
      Weightlessness shifts fluid toward the head <SourceBadge sourceIds={['SRC_NASA_RISKS']} title="NASA human research risks" />. This
      scan will track facial geometry against your own pre-flight scans. No validated threshold exists, so it is a trend
      only and never drives a Watch or Act verdict.
    </p>
  );
}

const TITLE: Record<ComingFlow, string> = { vision: 'Vision check', import: 'Device import', face: 'Face fluid-shift scan' };

export function ComingNextPage({ flow }: { flow: ComingFlow }) {
  return (
    <section aria-labelledby="lab-title" className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <h1 id="lab-title" className="text-2xl font-semibold text-text">
        Measurement Lab
      </h1>
      <Card
        title={`${TITLE[flow]} — coming next`}
        actions={flow === 'face' ? <Badge tone="watch" icon={FlaskConical}>Experimental — not validated</Badge> : <Badge>Coming next</Badge>}
      >
        <Body flow={flow} />
        <div className="mt-5">
          <LinkButton to="/lab" icon={ArrowLeft}>
            Back to the Lab
          </LinkButton>
        </div>
      </Card>
    </section>
  );
}
