import { Check, Send } from 'lucide-react';
import { useState } from 'react';

import type { CrewMember } from '../../domain/types';
import { healthService } from '../../services/healthService';
import { Button, Card, SegmentedControl, cx, useToast } from '../../ui';
import { composerProblems, toRequest, type ComposerState } from './composerState';
import { PacketPreview } from './PacketPreview';

export interface ComposerProps {
  crew: readonly CrewMember[];
  /** CMO may choose any subset; a crew member sends their own data only. */
  canChooseCrew: boolean;
  missionDay: number;
  state: ComposerState;
  onChange: (s: ComposerState) => void;
}

const fieldCls =
  'min-h-target rounded-control border border-border-strong bg-bg px-3 font-mono text-base text-text ' +
  'focus-visible:outline-2 focus-visible:outline-brand';

function DayField({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <span className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        type="number"
        className={cx(fieldCls, 'w-28')}
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isInteger(n)) onChange(n === 0 ? 1 : n);
        }}
      />
    </span>
  );
}

/** Left column of /earth (doc 11 §5.7): choose crew, period, flags only / all, note; preview; Send. */
export function Composer({ crew, canChooseCrew, missionDay, state, onChange }: ComposerProps) {
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const problems = composerProblems(state, missionDay);
  const set = (patch: Partial<ComposerState>) => onChange({ ...state, ...patch });
  const toggle = (id: string) =>
    set({ crewIds: state.crewIds.includes(id) ? state.crewIds.filter((x) => x !== id) : [...state.crewIds, id] });

  const send = async () => {
    setSending(true);
    try {
      await healthService.sendPacket(toRequest(state));
      toast.show({ title: 'Packet queued for Earth', body: 'It is now in transit to the flight surgeon.', tone: 'info' });
      set({ note: '' });
    } catch (err: unknown) {
      toast.show({ title: 'Packet not sent', body: err instanceof Error ? err.message : String(err), tone: 'act' });
    } finally {
      setSending(false);
    }
  };

  const shown = crew.filter((c) => canChooseCrew || state.crewIds.includes(c.id));
  return (
    <Card title="Compose packet" subtitle="FHIR bundle + human summary for the flight surgeon" data-testid="composer">
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-text">Crew</legend>
          <div className="flex flex-wrap gap-2">
            {shown.map((c) => {
              const on = state.crewIds.includes(c.id);
              return canChooseCrew ? (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  data-testid={`compose-crew-${c.id}`}
                  onClick={() => toggle(c.id)}
                  className={cx(
                    'inline-flex min-h-target items-center gap-2 rounded-control border px-3 text-sm',
                    on ? 'border-brand bg-surface-2 text-text' : 'border-border-strong text-text-2',
                  )}
                >
                  <Check size={16} aria-hidden="true" className={on ? 'text-brand' : 'invisible'} />
                  {c.displayName}
                </button>
              ) : (
                <span key={c.id} className="inline-flex min-h-target items-center rounded-control border border-border px-3 text-sm text-text">
                  {c.displayName} (your own data)
                </span>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <DayField id="compose-from" label="From mission day" value={state.fromDay} min={-180} max={state.toDay} onChange={(n) => set({ fromDay: n })} />
          <DayField id="compose-to" label="To mission day" value={state.toDay} min={state.fromDay} max={missionDay} onChange={(n) => set({ toDay: n })} />
          <SegmentedControl
            label="Include"
            value={state.flagsOnly ? 'flags' : 'all'}
            onChange={(v) => set({ flagsOnly: v === 'flags' })}
            options={[
              { value: 'flags', label: 'Flags only' },
              { value: 'all', label: 'All readings' },
            ]}
          />
        </div>
        <span className="flex flex-col gap-1">
          <label htmlFor="compose-note" className="text-sm font-medium text-text">
            Note to the flight surgeon (optional, sent as written)
          </label>
          <textarea
            id="compose-note"
            rows={2}
            className={cx(fieldCls, 'py-2 font-sans')}
            value={state.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        </span>
        <PacketPreview state={state} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={Send} disabled={sending || problems.length > 0} onClick={() => void send()} data-testid="send-packet">
            {sending ? 'Sending…' : 'Send to flight surgeon'}
          </Button>
          {problems.map((p) => (
            <span key={p} className="text-sm text-act-fg">
              {p}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
