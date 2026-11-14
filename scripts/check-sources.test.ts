import { describe, expect, it } from 'vitest';

import { checkSources, extractSourceIds, findMissing } from './check-sources';

describe('check-sources', () => {
  it('extracts ids with the SRC_[A-Z0-9_]+ pattern', () => {
    // Built at run time so this test file never contains a literal unknown id.
    const fake = ['SRC', 'NOT', 'REGISTERED', '9'].join('_');
    expect(extractSourceIds(`a ${fake} b [${fake}], SRC_lower`)).toEqual([fake, fake]);
  });

  it('reports ids that are missing from the registry', () => {
    const usage = new Map([
      ['A', ['x.ts']],
      ['B', ['y.md', 'z.ts']],
    ]);
    expect(findMissing(usage, new Set(['A']))).toEqual([{ id: 'B', files: ['y.md', 'z.ts'] }]);
  });

  it('every SRC_* id used under src/ and docs/ exists in seed/sources.json', () => {
    const result = checkSources();
    expect(result.used).toBeGreaterThan(0);
    expect(result.missing).toEqual([]);
  });
});
