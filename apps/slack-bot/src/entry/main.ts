import { loadSettings } from '../settings.js';
import { HttpOrchestrator } from '../adapters/http-orchestrator.js';
import { RunTracker } from '../application/run-tracker.js';
import { RunWatcher } from '../application/run-watcher.js';
import { createBot } from './bot.js';
import { wait } from './wait.js';

const POLL_MS = 2000;

const settings = loadSettings();
const orchestrator = new HttpOrchestrator(settings.orchestratorUrl);
const { app, slack } = createBot(settings, orchestrator);

app.command('/infrared', async ({ command, ack, client }) => {
  await ack();
  const [subcommand, runId] = command.text.trim().split(/\s+/);
  if (subcommand !== 'status' || !runId) {
    await client.chat.postEphemeral({ channel: command.channel_id, user: command.user_id, text: 'Usage: /infrared status <run-id>' });
    return;
  }
  new RunTracker(slack, orchestrator, command.channel_id, wait, POLL_MS).track(runId).catch(async error => {
    await client.chat.postEphemeral({ channel: command.channel_id, user: command.user_id, text: `Tracking ${runId} stopped: ${error.message}` });
  });
});

const watcher = new RunWatcher(
  () => orchestrator.listRuns(),
  runId => new RunTracker(slack, orchestrator, settings.slackChannel, wait, POLL_MS).track(runId),
  wait,
  (runId, error) => console.error(`Tracking ${runId} stopped: ${error.message}`)
);

(async () => {
  await app.start();
  console.log(`Slack bot started; watching every run on ${settings.orchestratorUrl}, posting to #${settings.slackChannel}`);
  await watcher.watch();
})();
