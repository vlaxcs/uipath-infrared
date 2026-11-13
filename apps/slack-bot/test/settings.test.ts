import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadSettings } from '../src/settings.js';

const complete = { SLACK_BOT_TOKEN: 'xoxb-secret-value', SLACK_APP_TOKEN: 'xapp-secret-value', SLACK_SIGNING_SECRET: 'signing-secret-value' };

afterEach(() => vi.restoreAllMocks());

describe('Settings', () => {
  it('stops at startup naming the missing variable, without printing any secret', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { SLACK_APP_TOKEN, ...missing } = complete;

    expect(() => loadSettings(missing)).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
    const printed = error.mock.calls.flat().join(' ');
    expect(printed).toContain('SLACK_APP_TOKEN');
    expect(printed).not.toContain('secret-value');
  });

  it('reads every required variable when they are all set', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const settings = loadSettings({ ...complete, SLACK_CHANNEL: 'runs' });

    expect(exit).not.toHaveBeenCalled();
    expect(settings.slackBotToken).toBe('xoxb-secret-value');
    expect(settings.slackChannel).toBe('runs');
    expect(settings.dashboardUrl).toBeUndefined();
  });

  it('uses the optional dashboard URL when it is set', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const settings = loadSettings({ ...complete, DASHBOARD_URL: 'https://infrared.local/runs/42' });

    expect(exit).not.toHaveBeenCalled();
    expect(settings.dashboardUrl).toBe('https://infrared.local/runs/42');
  });
});
