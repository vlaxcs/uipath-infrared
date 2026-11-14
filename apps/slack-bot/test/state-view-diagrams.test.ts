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
appendFileSync(process.env.CALLS_FILE ?? out + '.calls', [arg('--layout'), arg('--state'), arg('--result'), arg('--infra')].join(' ') + '\\n');
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

const INPUTS = { runId: 'run-1', result: 'result.1.json', infra: 'infra.json' };
const fetched: string[] = [];
const fetchFile = async (runId: string, path: string) => {
  fetched.push(`${runId}/${path}`);
  return `{"file": "${path}"}`;
};

function renderer(script: string, log: string[] = [], timeoutMs?: number, outDir = join(dir, 'out')) {
  return new StateViewDiagramRenderer({ python: process.execPath, snapshot: join(dir, script), outDir, timeoutMs, log: line => log.push(line), fetchFile });
}

const request = (layout: string, state: 'current' | 'target' = 'target', inputs = INPUTS) => ({ layout, state, inputs });

describe('State view diagram renderer', () => {
  it('runs the snapshot with the layout, state and output path, and reads its JSON line', async () => {
    const out = join(dir, 'first');
    const diagram = await renderer('snapshot.mjs', [], undefined, out).render(request('consolidate'));
    const png = join(out, 'run-1', 'result_1-consolidate-target.png');
    expect(diagram).toEqual({ pngPath: png, title: 'T consolidate', caption: 'C', alt: 'A' });
    const inputs = join(out, 'run-1', 'inputs');
    expect(readFileSync(`${png}.calls`, 'utf-8').trim()).toBe(`consolidate target ${join(inputs, 'result.1.json')} ${join(inputs, 'infra.json')}`);
    expect(readFileSync(join(inputs, 'result.1.json'), 'utf-8')).toBe('{"file": "result.1.json"}');
  });

  it('downloads each run file once and renders again for a new result', async () => {
    fetched.length = 0;
    const view = renderer('snapshot.mjs', [], undefined, join(dir, 'revisions'));
    await Promise.all([view.render(request('a')), view.render(request('b'))]);
    await view.render(request('a', 'target', { ...INPUTS, result: 'result.2.json' }));
    expect([...fetched].sort()).toEqual(['run-1/infra.json', 'run-1/result.1.json', 'run-1/result.2.json']);
  });

  it('refuses a run file name that is not a single file', async () => {
    const log: string[] = [];
    expect(await renderer('snapshot.mjs', log).render(request('x', 'target', { ...INPUTS, result: '../secrets.json' }))).toBeNull();
    expect(log[0]).toContain('refusing run file name');
  });

  it('renders each layout and state once, even for concurrent requests', async () => {
    const view = renderer('snapshot.mjs');
    const [a, b] = await Promise.all([
      view.render(request('managed_services')),
      view.render(request('managed_services')),
    ]);
    await view.render(request('managed_services'));
    expect(a).toEqual(b);
    const calls = readFileSync(join(dir, 'out', 'run-1', 'result_1-managed_services-target.png.calls'), 'utf-8').trim().split('\n');
    expect(calls).toHaveLength(1);
  });

  it('returns null and logs once when the snapshot exits non-zero', async () => {
    const log: string[] = [];
    const view = renderer('failing.mjs', log);
    expect(await view.render(request('x'))).toBeNull();
    expect(await view.render(request('x'))).toBeNull();
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('KeyError: layout not found');
  });

  it('tries again after a failure, so one orchestrator blip does not blank the diagram for good', async () => {
    let calls = 0;
    const flaky = async (runId: string, path: string) => {
      calls += 1;
      if (calls === 1) throw new Error('GET answered 503');
      return fetchFile(runId, path);
    };
    const view = new StateViewDiagramRenderer({ python: process.execPath, snapshot: join(dir, 'snapshot.mjs'), outDir: join(dir, 'flaky'), log: () => {}, fetchFile: flaky });
    expect(await view.render(request('consolidate'))).toBeNull();
    expect(await view.render(request('consolidate'))).not.toBeNull();
  });

  it('returns null when the snapshot is missing or too slow', async () => {
    const log: string[] = [];
    const missing = renderer('missing.mjs', log);
    expect(await missing.render(request('x', 'current'))).toBeNull();
    expect(await missing.render(request('y'))).toBeNull();
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('no state-view snapshot');
    expect(await renderer('slow.mjs', log, 200).render(request('x', 'current'))).toBeNull();
    expect(log[1]).toContain('timed out');
  });

  it('rejects output without a JSON line or a path', () => {
    expect(() => parseSnapshot('done\n')).toThrow('no JSON line');
    expect(() => parseSnapshot('{"title":"t"}')).toThrow('no path');
  });

  it('is replaced by the null renderer when diagrams are off', async () => {
    expect(createDiagramRenderer(false, fetchFile)).toBeInstanceOf(NullDiagramRenderer);
    expect(createDiagramRenderer(true, fetchFile, {})).toBeInstanceOf(StateViewDiagramRenderer);
    expect(await new NullDiagramRenderer().render()).toBeNull();
  });
});
