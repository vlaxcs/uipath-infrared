import { execFile } from 'child_process';
import { access, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { Diagram, DiagramRenderer, DiagramRequest } from '../application/ports.js';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TIMEOUT_MS = 20_000;

export interface StateViewOptions {
  python?: string;
  snapshot?: string;
  outDir?: string;
  timeoutMs?: number;
  log?: (line: string) => void;
}

export function createDiagramRenderer(enabled: boolean, env: NodeJS.ProcessEnv = process.env): DiagramRenderer {
  return enabled ? StateViewDiagramRenderer.fromEnv(env) : new NullDiagramRenderer();
}

export class NullDiagramRenderer implements DiagramRenderer {
  async render(): Promise<Diagram | null> {
    return null;
  }
}

export class StateViewDiagramRenderer implements DiagramRenderer {
  private rendered = new Map<string, Promise<Diagram | null>>();
  private reported = new Set<string>();
  private python: string;
  private snapshot: string;
  private outDir: string;
  private timeoutMs: number;
  private log: (line: string) => void;

  constructor(options: StateViewOptions = {}) {
    this.python = options.python ?? 'python3';
    this.snapshot = resolve(PACKAGE_DIR, options.snapshot ?? '../state-view/snapshot.py');
    this.outDir = resolve(PACKAGE_DIR, options.outDir ?? 'out/diagrams');
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
    this.log = options.log ?? (line => console.error(line));
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): StateViewDiagramRenderer {
    return new StateViewDiagramRenderer({
      python: env.PYTHON?.trim() || undefined,
      snapshot: env.STATE_VIEW_SNAPSHOT?.trim() || undefined,
    });
  }

  render(request: DiagramRequest): Promise<Diagram | null> {
    const key = `${request.layout}\u0000${request.state}`;
    let pending = this.rendered.get(key);
    if (!pending) {
      pending = this.run(request).catch(error => {
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
    await mkdir(this.outDir, { recursive: true });
    const out = resolve(this.outDir, `${fileSafe(request.layout)}-${request.state}.png`);
    const args = [this.snapshot, '--layout', request.layout, '--state', request.state, '--out', out];
    const stdout = await spawnSnapshot(this.python, args, this.timeoutMs);
    const diagram = parseSnapshot(stdout);
    await access(diagram.pngPath);
    return diagram;
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
