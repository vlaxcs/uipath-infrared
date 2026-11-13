import { resolve } from 'path';
import { FakeSlackClient } from '../adapters/slack.js';
import { SampleOrchestrator } from '../adapters/sample-orchestrator.js';
import { readEvents, readRun, writeRun } from '../adapters/run-file.js';
import { RunTracker } from '../application/run-tracker.js';
import { loadSettings } from '../settings.js';
import { createBot } from './bot.js';
import { wait } from './wait.js';

const SAMPLE = resolve('./sample/run.json');
const AFTER_LAYOUT = resolve('./sample/after-layout.json');
const FINISHED = resolve('./out/sample-run.json');
const PACE_MS = 1000;
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--print');

(async () => {
  const run = await readRun(SAMPLE);
  const tail = await readEvents(AFTER_LAYOUT);
  const orchestrator = new SampleOrchestrator(run, tail, wait, PACE_MS, () => new Date());

  if (dryRun) {
    const slack = new FakeSlackClient();
    await new RunTracker(slack, orchestrator, 'infrared-runs', wait, 0).replay(run);
    console.log(JSON.stringify(slack.finalMessages(), null, 2));
    return;
  }

  const settings = loadSettings();
  const { app, slack } = createBot(settings, orchestrator);
  await app.start();
  console.log(`Posting sample run ${run.id} to #${settings.slackChannel}; pick the architecture, then approve the plan`);
  const summary = await new RunTracker(slack, orchestrator, settings.slackChannel, wait, PACE_MS, settings.dashboardUrl).track(run.id);
  await writeRun(FINISHED, orchestrator.document());
  console.log(`Sample run ${summary.status}; the run document is in ${FINISHED}`);
  await app.stop();
})().catch(error => {
  console.error(`Sample run stopped: ${error.data?.error ?? error.message}`);
  process.exit(1);
});
