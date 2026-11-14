import { execFile } from 'child_process';
import { access, mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Diagram, DiagramInputs, DiagramRenderer, DiagramRequest } from '../application/ports.js';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TIMEOUT_MS = 20_000;
const ARTIFACT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type FetchRunFile = (runId: string, path: string) => Promise<string>;

export interface StateViewOptions {
  python?: string;
  snapshot?: string;
  outDir?: string;
  timeoutMs?: number;
  log?: (line: string) => void;
  fetchFile?: FetchRunFile;
}

export function createDiagramRenderer(enabled: boolean, fetchFile: FetchRunFile, env: NodeJS.ProcessEnv = process.env): DiagramRenderer {
  return enabled ? StateViewDiagramRenderer.fromEnv(fetchFile, env) : new NullDiagramRenderer();
}

export class NullDiagramRenderer implements DiagramRenderer {
  async render(): Promise<Diagram | null> {
    return null;
  }
}

export class StateViewDiagramRenderer implements DiagramRenderer {
  private rendered = new Map<string, Promise<Diagram | null>>();
  private downloaded = new Map<string, Promise<string>>();
  private reported = new Set<string>();
  private python: string;
  private snapshot: string;
  private outDir: string;
  private timeoutMs: number;
  private log: (line: string) => void;
  private fetchFile?: FetchRunFile;

  constructor(options: StateViewOptions = {}) {
    this.python = options.python ?? 'python3';
    this.snapshot = resolve(PACKAGE_DIR, options.snapshot ?? '../state-view/snapshot.py');
    this.outDir = resolve(PACKAGE_DIR, options.outDir ?? 'out/diagrams');
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
    this.log = options.log ?? (line => console.error(line));
    this.fetchFile = options.fetchFile;
  }

  static fromEnv(fetchFile: FetchRunFile, env: NodeJS.ProcessEnv = process.env): StateViewDiagramRenderer {
    return new StateViewDiagramRenderer({
      fetchFile,
      python: env.PYTHON?.trim() || undefined,
      snapshot: env.STATE_VIEW_SNAPSHOT?.trim() || undefined,
    });
  }

  render(request: DiagramRequest): Promise<Diagram | null> {
    const { runId, infra, result } = request.inputs;
    const key = [runId, infra, result, request.layout, request.state].join('\u0000');
    let pending = this.rendered.get(key);
    if (!pending) {
      pending = this.run(request).catch(error => {
        if (!(error instanceof MissingSnapshot)) this.rendered.delete(key);
        this.report(error instanceof MissingSnapshot ? error.message : `Diagram for ${request.layout} (${request.state}) unavailable: ${(error as Error).message}`);
        return null;
      });
      this.rendered.set(key, pending);
    }
    return pending;
  }

  private report(line: string): void {
    if (this.reported.has(line)) return;
    this.reported.add(line);
    this.log(line);
  }

  private async run(request: DiagramRequest): Promise<Diagram> {
    await access(this.snapshot).catch(() => { throw new MissingSnapshot(this.snapshot); });
    const [result, infra] = await Promise.all([this.download(request.inputs, request.inputs.result), this.download(request.inputs, request.inputs.infra)]);
    const dir = resolve(this.outDir, fileSafe(request.inputs.runId));
    await mkdir(dir, { recursive: true });
    const out = resolve(dir, `${fileSafe(request.inputs.result.replace(/\.json$/, ''))}-${fileSafe(request.layout)}-${request.state}.png`);
    const args = [this.snapshot, '--layout', request.layout, '--state', request.state, '--result', result, '--infra', infra, '--out', out];
    const stdout = await spawnSnapshot(this.python, args, this.timeoutMs);
    const diagram = parseSnapshot(stdout);
    await access(diagram.pngPath);
    return diagram;
  }

  private download(inputs: DiagramInputs, name: string): Promise<string> {
    const key = `${inputs.runId}\u0000${name}`;
    let pending = this.downloaded.get(key);
    if (!pending) {
      pending = this.fetchTo(inputs.runId, name);
      pending.catch(() => this.downloaded.delete(key));
      this.downloaded.set(key, pending);
    }
    return pending;
  }

  private async fetchTo(runId: string, name: string): Promise<string> {
    if (!this.fetchFile) throw new Error('no source for the run files');
    if (!ARTIFACT_NAME.test(name)) throw new Error(`refusing run file name ${JSON.stringify(name)}`);
    const dir = resolve(this.outDir, fileSafe(runId), 'inputs');
    await mkdir(dir, { recursive: true });
    const path = resolve(dir, name);
    await writeFile(path, await this.fetchFile(runId, name), 'utf8');
    return path;
  }
}

class MissingSnapshot extends Error {
  constructor(path: string) {
    super(`Diagrams unavailable: no state-view snapshot at ${path}; cards show the diagram placeholder`);
  }
}

export function parseSnapshot(stdout: string): Diagram {
  const line = stdout.split('\n').map(item => item.trim()).filter(item => item.startsWith('{')).at(-1);
  if (!line) throw new Error('snapshot printed no JSON line');
  const raw = JSON.parse(line) as Record<string, unknown>;
  if (typeof raw.path !== 'string' || raw.path === '') throw new Error('snapshot JSON has no path');
  return {
    pngPath: resolve(raw.path),
    title: text(raw.title),
    caption: text(raw.caption),
    alt: text(raw.alt),
  };
}

function spawnSnapshot(python: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(python, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr).trim().split('\n').at(-1) || error.message;
        reject(new Error(error.killed ? `snapshot timed out after ${timeoutMs} ms` : `snapshot failed: ${detail}`));
        return;
      }
      resolvePromise(String(stdout));
    });
  });
}

function fileSafe(layout: string): string {
  return layout.replace(/[^A-Za-z0-9_-]/g, '_');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
