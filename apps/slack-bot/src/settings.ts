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
  slackChannel: string;
  dashboardUrl?: string;
  diagrams: boolean;
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export function diagramsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.DIAGRAMS ?? 'on').trim().toLowerCase() !== 'off';
}

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const settings: Settings = {
    slackBotToken: requireEnv(env, 'SLACK_BOT_TOKEN'),
    slackAppToken: requireEnv(env, 'SLACK_APP_TOKEN'),
    slackSigningSecret: requireEnv(env, 'SLACK_SIGNING_SECRET'),
    orchestratorUrl: env.ORCHESTRATOR_URL || 'http://127.0.0.1:8080',
    slackChannel: env.SLACK_CHANNEL || 'infrared-runs',
    diagrams: diagramsEnabled(env),
  };
  const dashboardUrl = env.DASHBOARD_URL?.trim();
  if (dashboardUrl) settings.dashboardUrl = dashboardUrl;
  return settings;
}
