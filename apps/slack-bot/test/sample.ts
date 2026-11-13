import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import type { Run, RunEvent } from '../src/domain/run.js';

function read<T>(path: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf-8')) as T;
}

export function sampleRun(): Run {
  return read<Run>('../sample/run.json');
}

export function sampleEvent(seq: number): RunEvent {
  return sampleRun().events.find(event => event.seq === seq)!;
}

export function afterLayoutEvents(): RunEvent[] {
  return read<RunEvent[]>('../sample/after-layout.json');
}

export function afterLayoutEvent(seq: number): RunEvent {
  return afterLayoutEvents().find(event => event.seq === seq)!;
}
