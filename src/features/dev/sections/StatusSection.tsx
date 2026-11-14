import { FlaskConical } from 'lucide-react';

import { mockAssessments, mockOseiHeartRateAct } from '../../../test/fixtures';
import { Badge } from '../../../ui/Badge';
import { LayerTriad } from '../../../ui/LayerTriad';
import { StatusPill } from '../../../ui/StatusPill';
import { VERDICTS } from '../../../ui/tone';
import { Value } from '../../../ui/Value';
import { Demo, GallerySection } from './GallerySection';

export function StatusSection() {
  return (
    <GallerySection id="status" title="Status & values">
      <Demo name="StatusPill" note="Icon + exact word for every verdict (doc 11 §7). Sizes sm and md.">
        <div className="flex flex-col gap-3">
          {(['md', 'sm'] as const).map((size) => (
            <div key={size} className="flex flex-wrap gap-2">
              {VERDICTS.map((v) => (
                <StatusPill key={v} verdict={v} size={size} />
              ))}
            </div>
          ))}
          <StatusPill verdict="EXPECTED" showMeaning />
        </div>
      </Demo>
      <Demo
        name="LayerTriad"
        note="Compact P · S · E pills (hover, focus or tap explains each) and the expanded panels."
      >
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-1">
            {mockAssessments.map((a) => (
              <li key={`${a.crewId}-${a.signalId}`} className="flex flex-wrap items-center gap-3">
                <span className="w-52 font-mono text-xs text-text-2">
                  {a.crewId} · {a.signalId}
                </span>
                <StatusPill verdict={a.verdict} size="sm" />
                <LayerTriad layers={a.layers} drivenBy={a.drivenBy} />
              </li>
            ))}
          </ul>
          <LayerTriad
            variant="expanded"
            layers={mockOseiHeartRateAct.layers}
            drivenBy={mockOseiHeartRateAct.drivenBy}
            caughtOnlyByPersonal={mockOseiHeartRateAct.caughtOnlyByPersonal}
          />
        </div>
      </Demo>
      <Demo
        name="Value"
        note="Number + unit + source badge (✓ verified, ~ partial, D demo) + freshness + data label. Badge opens the source drawer."
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <Value
            value={69}
            unit="/min"
            sourceIds={['SRC_DEMO_BASELINE_ENGINE']}
            freshness="3 h"
            label="SIMULATED"
            size="xl"
            title="Resting heart rate"
          />
          <Value
            value={3}
            unit="mm[Hg]"
            sourceIds={['SRC_STD3001_CO2']}
            size="lg"
            title="NASA-STD-3001 CO₂ 1-h limit"
          />
          <Value
            value={3.8}
            unit="mm[Hg]"
            sourceIds={['SRC_CO2_ICES_LIMITS']}
            size="lg"
            title="Earth workplace CO₂"
          />
          <Value value={600} unit="mSv" sourceIds={['SRC_STD3001_RAD']} title="Career limit" />
          <Value
            value={36.6}
            unit="Cel"
            sourceIds={['SRC_DEMO_SIMULATION']}
            label="SIMULATED"
            title="Body temperature (°C/°F by setting)"
          />
          <Value value={null} unit="mg/dL" sourceIds={['SRC_EARTH_GLUCOSE_ADA']} title="Glucose" />
          <Value
            value={1.8}
            unit="mSv/d"
            sourceIds={['SRC_RAD_CURIOSITY']}
            title="GCR dose rate, Mars cruise"
          />
          <Value
            value={62}
            unit="/min"
            sourceIds={['SRC_POS_WANG2017']}
            label="MEASURED"
            freshness="now"
            title="Camera pulse"
          />
          <Value
            value={250}
            unit="mSv"
            sourceIds={['SRC_STD3001_RAD']}
            label="REPLAY"
            title="SPE design limit"
          />
        </div>
      </Demo>
      <Demo name="Badge" note="Non-interactive labels. Colour always comes with a word.">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="ok">OK</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="watch">Watch</Badge>
          <Badge tone="act">Act</Badge>
          <Badge tone="muted">Muted</Badge>
          <Badge variant="outline" mono icon={FlaskConical}>
            Outline mono
          </Badge>
        </div>
      </Demo>
    </GallerySection>
  );
}
