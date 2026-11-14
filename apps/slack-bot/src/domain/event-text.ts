import type { Actor, RunEvent, Step } from './run.js';

const STEP_LABEL: Record<Step, string> = {
  extract: 'Extract',
  investigate: 'Investigate',
  propose: 'Propose',
  evaluate: 'Evaluate',
  present: 'Present',
  rehearse: 'Rehearse',
};

export function stepLabel(step: Step): string {
  return STEP_LABEL[step];
}

export function describeEvent(event: RunEvent): string {
  const label = stepLabel(event.step);
  const decision = event.decision;
  if (event.status === 'started') return `${label} started`;
  if (event.status === 'failed') return 'The run stopped';
  if (event.status === 'awaiting_approval') {
    return event.gate === 'plan'
      ? 'The plan is waiting for your approval'
      : 'A layout is waiting to be picked';
  }
  if (event.status === 'approved' && decision) {
    const who = actorName(event.actor);
    if (decision.kind === 'keep_analyses') return `${who} kept the analyses ${(decision.analyses ?? []).join(', ')}`;
    if (decision.kind === 'pick_layout') return `${who} picked the layout ${decision.layout}`;
    return `${who} approved the plan`;
  }
  return completedText(event);
}

export function actorName(actor: Actor): string {
  return actor.kind === 'human' ? `${actor.id} from ${actor.surface}` : 'the orchestrator';
}

function completedText(event: RunEvent): string {
  const revise = event.decision?.kind === 'revise';
  switch (event.step) {
    case 'extract':
      return 'The estate was extracted';
    case 'investigate':
      return 'The investigation finished';
    case 'propose':
      return event.revision > 0 ? 'Revised candidate plans were proposed' : 'Candidate plans were proposed';
    case 'evaluate':
      return revise
        ? 'A candidate broke a hard constraint, so the run goes back to Propose'
        : 'The candidates hold; the run moves on to Present';
    case 'present':
      return 'The layout is picked; the run moves on to Rehearse';
    case 'rehearse':
      return revise
        ? 'The rehearsal missed the forecast, so the run goes back to Propose'
        : 'The rehearsal held';
  }
}
