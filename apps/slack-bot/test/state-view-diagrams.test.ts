import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NullDiagramRenderer, StateViewDiagramRenderer, createDiagramRenderer, parseSnapshot } from '../src/adapters/state-view-diagrams.js';

let dir = '';

const SNAPSHOT = `
import { appendFileSync, writeFileSync } from 'fs';
const args = process.argv.slice(2);
const arg = name => args[args.indexOf(name) + 1];
const out = arg('--out');
appendFileSync(process.env.CALLS_FILE ?? out + '.calls', arg('--layout') + ' ' + arg('--state') + '\\n');
writeFileSync(out, 'png');
console.log('rendering');
console.log(JSON.stringify({ path: out, layout: arg('--layout'), state: arg('--state'), title: 'T ' + arg('--layout'), caption: 'C', alt: 'A' }));
`;

const FAILING = `
console.error('Traceback\\nKeyError: layout not found');
process.exit(2);
`;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'state-view-'));
  writeFileSync(join(dir, 'snapshot.mjs'), SNAPSHOT);
  writeFileSync(join(dir, 'failing.mjs'), FAILING);
  writeFileSync(join(dir, 'slow.mjs'), 'setTimeout(() => {}, 5000);');
});

function renderer(script: string, log: string[] = [], timeoutMs?: number) {
  return new StateViewDiagramRenderer({ python: process.execPath, snapshot: join(dir, script), outDir: join(dir, 'out'), timeoutMs, log: line => log.push(line) });
}

describe('State view diagram renderer', () => {
  it('runs the snapshot with the layout, state and output path, and reads its JSON line', async () => {
    const diagram = await renderer('snapshot.mjs').render({ layout: 'consolidate', state: 'target' });
    expect(diagram).toEqual({ pngPath: join(dir, 'out', 'consolidate-target.png'), title: 'T consolidate', caption: 'C', alt: 'A' });
  });

  it('renders each layout and state once, even for concurrent requests', async () => {
    const view = renderer('snapshot.mjs');
    const [a, b] = await Promise.all([
      view.render({ layout: 'managed_services', state: 'target' }),
      view.render({ layout: 'managed_services', state: 'target' }),
    ]);
    await view.render({ layout: 'managed_services', state: 'target' });
    expect(a).toEqual(b);
    const calls = readFileSync(join(dir, 'out', 'managed_services-target.png.calls'), 'utf-8').trim().split('\n');
    expect(calls).toEqual(['managed_services target']);
  });

  it('returns null and logs once when the snapshot exits non-zero', async () => {
    const log: string[] = [];
    const view = renderer('failing.mjs', log);
    expect(await view.render({ layout: 'x', state: 'target' })).toBeNull();
    expect(await view.render({ layout: 'x', state: 'target' })).toBeNull();
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('KeyError: layout not found');
  });

  it('returns null when the snapshot is missing or too slow', async () => {
    const log: string[] = [];
    const missing = renderer('missing.mjs', log);
    expect(await missing.render({ layout: 'x', state: 'current' })).toBeNull();
    expect(await missing.render({ layout: 'y', state: 'target' })).toBeNull();
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('no state-view snapshot');
    expect(await renderer('slow.mjs', log, 200).render({ layout: 'x', state: 'current' })).toBeNull();
    expect(log[1]).toContain('timed out');
  });

  it('rejects output without a JSON line or a path', () => {
    expect(() => parseSnapshot('done\n')).toThrow('no JSON line');
    expect(() => parseSnapshot('{"title":"t"}')).toThrow('no path');
  });

  it('is replaced by the null renderer when diagrams are off', async () => {
    expect(createDiagramRenderer(false)).toBeInstanceOf(NullDiagramRenderer);
    expect(createDiagramRenderer(true, {})).toBeInstanceOf(StateViewDiagramRenderer);
    expect(await new NullDiagramRenderer().render()).toBeNull();
  });
});
