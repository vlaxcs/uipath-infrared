package run

import "time"

const timestampLayout = "2006-01-02T15:04:05.000Z"

func New(id, project string, maxRevisions int, inputs Inputs, now time.Time) *Run {
	r := &Run{
		Summary: Summary{SchemaVersion: SchemaVersion, ID: id, Project: project, MaxRevisions: maxRevisions},
		Inputs:  inputs,
	}
	r.Append(Event{Step: Extract, Status: Started, Actor: OrchestratorActor}, now)
	return r
}

func (r *Run) Append(event Event, now time.Time) Event {
	event.Seq = len(r.Events) + 1
	event.At = r.timestampAfterLast(now)
	event.Revision = r.Revision
	r.Events = append(r.Events, event)
	if event.Decision != nil && event.Decision.Kind == Revise {
		r.Revision++
	}
	r.summarise()
	return event
}

func (r *Run) Last() Event {
	return r.Events[len(r.Events)-1]
}

func (r *Run) EventsAfter(seq int) []Event {
	if seq >= len(r.Events) {
		return []Event{}
	}
	return append([]Event(nil), r.Events[seq:]...)
}

func (r *Run) Active() bool {
	return r.Status == Running || r.Status == AwaitingApproval
}

func (r *Run) timestampAfterLast(now time.Time) string {
	now = now.UTC()
	if len(r.Events) > 0 {
		previous, err := time.Parse(timestampLayout, r.Last().At)
		if err == nil && now.Before(previous) {
			now = previous
		}
	}
	return now.Format(timestampLayout)
}

func (r *Run) summarise() {
	first, last := r.Events[0], r.Last()
	r.StartedAt = first.At
	r.UpdatedAt = last.At
	r.Step = last.Step
	r.Status, r.Awaiting = statusOf(last)
	r.FinishedAt = ""
	if r.Status == Completed || r.Status == Failed {
		r.FinishedAt = last.At
	}
}

func statusOf(last Event) (Status, Gate) {
	kind := DecisionKind("")
	if last.Decision != nil {
		kind = last.Decision.Kind
	}
	switch {
	case last.Status == StepFailed:
		return Failed, ""
	case kind == ApprovePlan:
		return Completed, ""
	case last.Status == OpensGate:
		return AwaitingApproval, last.Gate
	case kind == KeepAnalyses:
		return AwaitingApproval, LayoutGate
	}
	return Running, ""
}
