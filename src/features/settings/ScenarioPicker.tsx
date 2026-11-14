// Demo scenario picker (FR-SET-2): jump to a scenario's last day and select its crew member.
import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';

import { useMissionProfile, useMissionStore } from '../../state/mission';
import { DEFAULT_PROFILE_ID, getProfile, missionDayLabel } from '../../state/missionSelectors';
import { useUiStore } from '../../state/ui';
import { Badge, Button, LinkButton } from '../../ui';
import { crewName } from './crewNames';
import { DEMO_SCENARIOS, scenarioTarget } from './demoScenarios';
import type { DemoScenario, ScenarioTarget } from './demoScenarios';

interface Picked {
  scenario: DemoScenario;
  target: ScenarioTarget;
}

export function ScenarioPicker() {
  const profile = useMissionProfile();
  const setMissionDay = useMissionStore((s) => s.setMissionDay);
  const setProfile = useMissionStore((s) => s.setProfile);
  const setSelectedCrew = useUiStore((s) => s.setSelectedCrew);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [notHere, setNotHere] = useState<DemoScenario | null>(null);

  const apply = (scenario: DemoScenario, onMarsTransit = false) => {
    const p = onMarsTransit ? getProfile(DEFAULT_PROFILE_ID) : profile;
    const target = scenarioTarget(scenario, p);
    if (!target.occurs) {
      setNotHere(scenario);
      setPicked(null);
      return;
    }
    if (onMarsTransit) setProfile(DEFAULT_PROFILE_ID);
    setMissionDay(target.day);
    if (target.crewId) setSelectedCrew(target.crewId);
    setNotHere(null);
    setPicked({ scenario, target });
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2" aria-label="Demo scenarios">
        {DEMO_SCENARIOS.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-dashed border-border-strong bg-surface-2/40 px-4 py-3"
            data-scenario={s.id}
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                <Badge mono variant="outline">
                  Demo
                </Badge>
                {s.label}
              </p>
              <p className="mt-1 text-sm text-text-2">{s.demonstrates}</p>
            </div>
            <Button icon={Play} onClick={() => apply(s)} aria-label={`Jump to scenario: ${s.label}`}>
              Jump
            </Button>
          </li>
        ))}
      </ul>
      <div aria-live="polite" className="min-h-6">
        {picked && (
          <div
            className="flex flex-wrap items-center gap-3 rounded-control border border-border-strong px-4 py-3 text-sm text-text"
            data-testid="scenario-result"
          >
            <span>
              {picked.scenario.label}: jumped to {missionDayLabel(picked.target.day)}
              {picked.target.crewId ? `, ${crewName(picked.target.crewId)} selected.` : ', whole crew.'}
            </span>
            <LinkButton to={picked.target.link.to} icon={ArrowRight}>
              {picked.target.link.label}
            </LinkButton>
          </div>
        )}
        {notHere && (
          <div className="flex flex-wrap items-center gap-3 rounded-control border border-border-strong px-4 py-3 text-sm text-text">
            <span>
              {notHere.label} does not occur on the {profile.label} timeline: it ends at{' '}
              {missionDayLabel(profile.demoMissionDay)}. All scenarios live on the Mars-transit timeline.
            </span>
            <Button variant="primary" onClick={() => apply(notHere, true)}>
              Switch to Mars transit and jump
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
