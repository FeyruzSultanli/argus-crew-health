import { useState } from 'react';

import { mockOseiHeartRateSeries, mockSleepSeries } from '../../../test/fixtures';
import { BandChart } from '../../../ui/BandChart';
import { Button } from '../../../ui/Button';
import { Countdown } from '../../../ui/Countdown';
import { Gauge } from '../../../ui/Gauge';
import { Sparkline } from '../../../ui/Sparkline';
import { StatusPill } from '../../../ui/StatusPill';
import { Demo, GallerySection } from './GallerySection';

export function ChartsSection() {
  const [countdown, setCountdown] = useState(() => ({ start: Date.now(), end: Date.now() + 11_000 }));
  return (
    <GallerySection id="charts" title="Charts & gauges">
      <Demo
        name="BandChart"
        note="Personal band (ref ± 2σ), pre-flight dashed band, space-expected band, reference lines with source badges, event markers, View data table. TV-4 sleep numbers."
      >
        <BandChart
          title="Sleep vs personal band"
          series={mockSleepSeries}
          unit="h"
          precision={1}
          sourceIds={['SRC_DEMO_BASELINE_ENGINE']}
          preflightBand={{ lo: 6.5, hi: 7.7, sourceIds: ['SRC_DEMO_BASELINE_ENGINE'], toDay: -1 }}
          spaceBand={{
            lo: 5.6,
            hi: 6.8,
            sourceIds: ['SRC_DEMO_BASELINE_ENGINE', 'SRC_SLEEP_BARGER'],
            fromDay: 1,
          }}
          referenceLines={[
            { y: 7, label: 'Earth: adults ≥ 7 h', sourceIds: ['SRC_EARTH_SLEEP_7H'], tone: 'watch' },
            { y: 5.5, label: 'Space WATCH below', sourceIds: ['SRC_DEMO_RULE_BANDS'], tone: 'act' },
          ]}
          events={[{ missionDay: 1, label: 'Launch', tone: 'info' }]}
        />
      </Demo>
      <Demo name="Sparkline" note="Last point coloured by verdict; band shaded.">
        <div className="flex flex-wrap items-center gap-6">
          <Sparkline points={mockOseiHeartRateSeries} ariaLabel="Resting heart rate trend, K. Osei" />
          <Sparkline points={mockSleepSeries} ariaLabel="Sleep trend" />
          <Sparkline points={[]} ariaLabel="Glucose trend" />
        </div>
      </Demo>
      <Demo
        name="Gauge"
        note="Ring gauge; thresholds come from the caller's sourced rules (here NASA-STD-3001 CO₂ 3 mmHg and the 600 mSv career limit)."
      >
        <div className="flex flex-wrap gap-8">
          <Gauge
            label="Cabin CO₂ 1-h"
            value={3.4}
            max={6}
            unit="mm[Hg]"
            precision={1}
            sourceIds={['SRC_STD3001_CO2']}
            thresholds={[
              { from: 0, tone: 'ok' },
              { from: 3, tone: 'watch' },
            ]}
            footer={<StatusPill verdict="WATCH" size="sm" />}
            freshness="12 min"
          />
          <Gauge
            label="Career dose"
            value={180}
            max={600}
            unit="mSv"
            sourceIds={['SRC_STD3001_RAD', 'SRC_DEMO_SIMULATION']}
          />
          <Gauge
            label="Readiness"
            value={null}
            max={100}
            sourceIds={['SRC_DEMO_READINESS']}
            footer={<StatusPill verdict="NO_DATA" size="sm" />}
          />
        </div>
      </Demo>
      <Demo name="Countdown" note="Earth-link delivery: 11 min shown as 11 s (demo compression).">
        <div className="flex flex-wrap items-end gap-6">
          <Countdown
            label="Packet delivery"
            startedAt={countdown.start}
            endsAt={countdown.end}
            note="11 min (shown as 11 s)"
            size="lg"
          />
          <Button onClick={() => setCountdown({ start: Date.now(), end: Date.now() + 11_000 })}>
            Restart
          </Button>
        </div>
      </Demo>
    </GallerySection>
  );
}
