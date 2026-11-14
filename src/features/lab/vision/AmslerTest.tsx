// One eye of the Amsler test: instruction (cover the other eye, usual near glasses, 30–35 cm), then the grid with
// three brushes (wavy / blurred / missing), erase, undo and clear. Reports the marked cells; no verdict here.
import { Eraser, EyeOff, Glasses, RotateCcw, Trash2, Undo2, Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { AMSLER_KINDS, countMarked, emptyCells, paintCell, type AmslerCells, type AmslerKind } from '../../../measurement/vision';
import { AMSLER_DISTANCE_MM, VISION_DEMO_SOURCE_IDS } from '../../../measurement/vision';
import { Button, Card, SegmentedControl, Value } from '../../../ui';
import { AmslerGrid } from './AmslerGrid';
import { KIND_STYLE } from './kinds';
import { eyeName, otherEye, type Eye } from './observations';
import type { VisionTestMode } from './testMode';
import { SCRIPTED_CELLS } from './testMode';

type Tool = AmslerKind | 'erase';

export interface AmslerTestProps {
  eye: Eye;
  pxPerMm: number;
  testMode: VisionTestMode | null;
  onDone: (cells: AmslerCells) => void;
  onSkip: () => void;
}

export function AmslerTest({ eye, pxPerMm, testMode, onDone, onSkip }: AmslerTestProps) {
  const [cells, setCellsState] = useState<AmslerCells>(emptyCells);
  const [tool, setTool] = useState<Tool>('wavy');
  const [undoDepth, setUndoDepth] = useState(0);
  // Mirrors of the state for event handlers that fire faster than renders (pointer moves) — no side effects in
  // state updaters (StrictMode runs them twice).
  const cellsRef = useRef<AmslerCells>(cells);
  const history = useRef<AmslerCells[]>([]);
  const strokeStart = useRef<AmslerCells | null>(null);
  const brush: AmslerKind | null = tool === 'erase' ? null : tool;

  const setCells = (next: AmslerCells) => {
    cellsRef.current = next;
    setCellsState(next);
  };
  const pushUndo = (before: AmslerCells) => {
    history.current = [...history.current.slice(-49), before];
    setUndoDepth(history.current.length);
  };
  const paint = (i: number, phase: 'start' | 'move') => {
    if (phase === 'start') strokeStart.current = cellsRef.current;
    const next = paintCell(cellsRef.current, i, brush);
    if (next !== cellsRef.current) setCells(next);
  };
  const strokeEnd = () => {
    if (strokeStart.current && strokeStart.current !== cellsRef.current) pushUndo(strokeStart.current);
    strokeStart.current = null;
  };
  const toggle = (i: number) => {
    const c = cellsRef.current;
    pushUndo(c);
    setCells(paintCell(c, i, tool === 'erase' || c[i] === tool ? null : tool));
  };
  const undo = () => {
    const prev = history.current.at(-1);
    if (!prev) return;
    history.current = history.current.slice(0, -1);
    setUndoDepth(history.current.length);
    setCells(prev);
  };
  const clear = () => {
    pushUndo(cellsRef.current);
    setCells(emptyCells());
  };
  const applyScript = () => {
    if (!testMode) return;
    pushUndo(cellsRef.current);
    setCells(SCRIPTED_CELLS[testMode.amslerScript].reduce<AmslerCells>((c, i) => paintCell(c, i, 'wavy'), emptyCells()));
  };
  const marked = countMarked(cells);

  return (
    <Card title={`${eyeName(eye)} — Amsler grid`} headingLevel={2}>
      <ul className="mb-4 flex flex-col gap-2 text-sm text-text-2">
        <li className="flex items-start gap-2">
          <EyeOff aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          Cover your {otherEye(eye)} eye. Look only at the black dot in the centre.
        </li>
        <li className="flex items-start gap-2">
          <Glasses aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>
            Wear your usual near glasses. Sit{' '}
            <Value value={AMSLER_DISTANCE_MM.max / 10} prefix={`${AMSLER_DISTANCE_MM.min / 10}–`} unit="cm" sourceIds={VISION_DEMO_SOURCE_IDS} size="sm" title="Amsler viewing distance" />{' '}
            from the screen.
          </span>
        </li>
        <li>While looking at the dot, mark any squares whose lines look wavy, blurred or missing. Drag to paint several.</li>
      </ul>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SegmentedControl<Tool>
          label="Brush"
          value={tool}
          onChange={setTool}
          options={[...AMSLER_KINDS.map((k) => ({ value: k as Tool, label: KIND_STYLE[k].label })), { value: 'erase', label: 'Erase', icon: Eraser }]}
        />
        <Button icon={Undo2} onClick={undo} disabled={undoDepth === 0}>
          Undo
        </Button>
        <Button icon={Trash2} onClick={clear} disabled={marked === 0}>
          Clear
        </Button>
        {testMode && (
          <Button icon={Wand2} onClick={applyScript} data-testid="vision-script-marks">
            Apply scripted marks ({testMode.amslerScript})
          </Button>
        )}
      </div>
      <AmslerGrid
        pxPerMm={pxPerMm}
        cells={cells}
        onPaint={paint}
        onToggle={toggle}
        onStrokeEnd={strokeEnd}
        label={`Amsler grid, ${eyeName(eye).toLowerCase()}. Arrow keys move the cursor, Space marks or clears the square with the selected brush.`}
      />
      <p className="mt-3 text-sm text-text" data-testid="amsler-marked-count" data-count={marked}>
        Marked squares: <Value value={marked} precision={0} sourceIds={['SRC_VISION_ISS']} label={testMode ? 'SIMULATED' : 'MEASURED'} size="sm" title="Marked squares" />
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => onDone(cells)}>
          {marked === 0 ? 'All lines look straight — next' : 'Done with this eye'}
        </Button>
        <Button icon={RotateCcw} variant="ghost" onClick={onSkip}>
          Skip this eye
        </Button>
      </div>
    </Card>
  );
}
