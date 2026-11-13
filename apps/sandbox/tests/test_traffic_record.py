from sandbox.domain.traffic_observations import record_observations, served_by
from sandbox.domain.traffic_record import TrafficRecord, measured_records, samples_for_phase


def record(phase, protocol="http", ok=True, detail="ok i-1", component_id="lb"):
    return TrafficRecord(1.0, phase, protocol, component_id, ok, 12.0, detail)


def test_http_records_are_measured_and_warmup_is_dropped():
    records = [record("warmup"), record("baseline"), record("failure", "tcp", component_id="db")]

    assert measured_records(records) == [records[1]]


def test_tcp_records_are_measured_when_there_is_no_http():
    records = [record("baseline", "tcp"), record("warmup", "tcp")]

    assert measured_records(records) == [records[0]]


def test_samples_for_phase_keep_success_and_latency():
    samples = samples_for_phase([record("failure", ok=False, detail="http 502"), record("baseline")], "failure")

    assert [(sample.success, sample.latency_ms) for sample in samples] == [(False, 12.0)]


def test_served_by_counts_successful_responses_per_instance():
    counts = served_by([record("baseline", detail="ok i-1"), record("failure", detail="ok i-2"), record("failure", ok=False, detail="http 502"), record("warmup", detail="ok i-2")])

    assert counts == {"i-1": 1, "i-2": 1}


def test_record_observations_carry_failure_detail():
    observations = record_observations([record("failure", ok=False, detail="http 502")])

    assert observations[0].detail == "http 502"
    assert observations[0].source == "data-plane http"
