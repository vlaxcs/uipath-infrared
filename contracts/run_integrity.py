from datetime import datetime

LOOP_STEPS = ("evaluate", "rehearse")
GATE_OF_STEP = {"present": "layout", "rehearse": "plan"}
GATE_OF_DECISION = {"keep_analyses": "layout", "pick_layout": "layout", "approve_plan": "plan"}
CLOSES_GATE = ("pick_layout", "approve_plan")


def run_integrity_errors(run):
    events = run["events"]
    return [
        *_sequence_errors(events),
        *_time_errors(run, events),
        *_revision_errors(run, events),
        *_decision_errors(events),
        *_summary_errors(run, events),
    ]


def _sequence_errors(events):
    return [
        f"event at position {position}: seq {event['seq']}, expected {position}"
        for position, event in enumerate(events, start=1)
        if event["seq"] != position
    ]


def _time_errors(run, events):
    summary = {"started_at": events[0]["at"], "updated_at": events[-1]["at"]}
    if "finished_at" in run:
        summary["finished_at"] = events[-1]["at"]
    try:
        times = [datetime.fromisoformat(event["at"]) for event in events]
        claimed = {field: datetime.fromisoformat(run[field]) for field in summary}
    except ValueError as unparsable:
        return [f"timestamp is not a real date and time: {unparsable}"]
    errors = [
        f"event {event['seq']}: at {event['at']} is before the event it follows"
        for event, earlier, later in zip(events[1:], times, times[1:])
        if later < earlier
    ]
    for field, at in summary.items():
        if claimed[field] != datetime.fromisoformat(at):
            errors.append(f"{field} is {run[field]}, the events say {at}")
    return errors


def _revision_errors(run, events):
    errors = []
    expected = 0
    for event in events:
        if event["revision"] != expected:
            errors.append(f"event {event['seq']}: revision {event['revision']}, expected {expected}")
        if event.get("decision", {}).get("kind") == "revise":
            expected += 1
    if run["revision"] != expected:
        errors.append(f"revision is {run['revision']}, the events hold {expected} revise decisions")
    if expected > run["max_revisions"]:
        errors.append(f"{expected} revise decisions, max_revisions is {run['max_revisions']}")
    return errors


def _decision_errors(events):
    errors = []
    open_gate = None
    ended_at_seq = None
    for event in events:
        seq, status = event["seq"], event["status"]
        kind = event.get("decision", {}).get("kind")
        if ended_at_seq:
            errors.append(f"event {seq}: the run ended at event {ended_at_seq}")
        if status == "failed" or kind == "approve_plan":
            ended_at_seq = seq
        if status == "completed" and event["step"] in LOOP_STEPS and kind not in ("proceed", "revise"):
            errors.append(f"event {seq}: {event['step']} completed without a proceed or revise decision")
        if status == "awaiting_approval":
            if open_gate:
                errors.append(f"event {seq}: opens gate {event['gate']} while gate {open_gate} is open")
            if GATE_OF_STEP.get(event["step"]) != event["gate"]:
                errors.append(f"event {seq}: step {event['step']} cannot open gate {event['gate']}")
            open_gate = event["gate"]
        elif status == "approved":
            if GATE_OF_DECISION[kind] != open_gate:
                errors.append(f"event {seq}: {kind} needs gate {GATE_OF_DECISION[kind]} open, open gate is {open_gate}")
            elif kind in CLOSES_GATE:
                open_gate = None
        elif open_gate:
            errors.append(f"event {seq}: {event['step']} {status} while gate {open_gate} waits for a person")
    return errors


def _summary_errors(run, events):
    last = events[-1]
    errors = []
    if run["step"] != last["step"]:
        errors.append(f"step is {run['step']}, the last event is on {last['step']}")
    status, awaiting = _summary_of(events)
    if run["status"] != status:
        errors.append(f"status is {run['status']}, the events say {status}")
    if run.get("awaiting") != awaiting:
        errors.append(f"awaiting is {run.get('awaiting')}, the events say {awaiting}")
    return errors


def _summary_of(events):
    last = events[-1]
    kind = last.get("decision", {}).get("kind")
    if last["status"] == "failed":
        return "failed", None
    if kind == "approve_plan":
        return "completed", None
    if last["status"] == "awaiting_approval":
        return "awaiting_approval", last["gate"]
    if kind == "keep_analyses":
        return "awaiting_approval", "layout"
    return "running", None
