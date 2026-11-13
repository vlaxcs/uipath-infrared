import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import type { Run, RunEvent } from '../domain/run.js';

export async function readRun(path: string): Promise<Run> {
  return JSON.parse(await readFile(path, 'utf-8')) as Run;
}

export async function readEvents(path: string): Promise<RunEvent[]> {
  return JSON.parse(await readFile(path, 'utf-8')) as RunEvent[];
}

export async function writeRun(path: string, run: Run): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(run, null, 2)}\n`, 'utf-8');
}
