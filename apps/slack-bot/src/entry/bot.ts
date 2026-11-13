import { App } from '@slack/bolt';
import type { Settings } from '../settings.js';
import type { Orchestrator } from '../application/ports.js';
import { BoltSlackClient } from '../adapters/slack.js';
import { PlanApprover } from '../application/plan-approver.js';
import { LayoutPicker } from '../application/layout-picker.js';
import { APPROVE_PLAN_ACTION } from '../domain/plan-approval.js';
import { PLAN_APPROVAL_VIEW } from '../domain/approval-view.js';
import { PICK_LAYOUT_ACTION } from '../domain/layout-choice.js';
import { approvePlanAction } from './plan-action.js';
import { submitPlanApproval } from './plan-view.js';
import { pickLayoutAction } from './layout-action.js';

export function createBot(settings: Settings, orchestrator: Orchestrator) {
  const app = new App({
    token: settings.slackBotToken,
    signingSecret: settings.slackSigningSecret,
    socketMode: true,
    appToken: settings.slackAppToken,
  });
  app.action(APPROVE_PLAN_ACTION, approvePlanAction(orchestrator));
  app.view(PLAN_APPROVAL_VIEW, submitPlanApproval(new PlanApprover(orchestrator)));
  app.action(new RegExp(`^${PICK_LAYOUT_ACTION}_`), pickLayoutAction(new LayoutPicker(orchestrator)));
  return { app, slack: new BoltSlackClient(app) };
}
