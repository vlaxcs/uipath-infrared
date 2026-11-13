import { staysInPhone } from "./navigation";

export type Settings = { slackWorkspaceUrl: string };

export function readSettings(env: Record<string, string | undefined>): Settings {
  const slackWorkspaceUrl = env.SLACK_WORKSPACE_URL;
  if (!slackWorkspaceUrl) {
    throw new Error("SLACK_WORKSPACE_URL is missing: set it in the .env at the repo root");
  }
  if (!staysInPhone(slackWorkspaceUrl)) {
    throw new Error("SLACK_WORKSPACE_URL must be an https address on slack.com");
  }
  return { slackWorkspaceUrl };
}
