import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../../../.env') });

export interface Settings {
  slackBotToken: string;
  slackAppToken: string;
  slackSigningSecret: string;
  orchestratorUrl: string;
  orchestratorServiceToken?: string;
  slackChannel: string;
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  return {
    slackBotToken: requireEnv(env, 'SLACK_BOT_TOKEN'),
    slackAppToken: requireEnv(env, 'SLACK_APP_TOKEN'),
    slackSigningSecret: requireEnv(env, 'SLACK_SIGNING_SECRET'),
    orchestratorUrl: env.ORCHESTRATOR_URL || 'http://127.0.0.1:8080',
    orchestratorServiceToken: env.ORCHESTRATOR_SERVICE_TOKEN || undefined,
    slackChannel: env.SLACK_CHANNEL || 'infrared-runs',
  };
}
