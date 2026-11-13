from sandbox.domain.built import BuiltComponent, BuiltResource
from sandbox.domain.failure import FailureType
from sandbox.domain.failure_target import FailureTarget
from sandbox.domain.observation import Observation
from sandbox.domain.component_result import summarize_component

WEB = BuiltComponent("web", "virtual_machine", "t3.small", 2, [BuiltResource("instance", "i-1", "n"), BuiltResource("instance", "i-2", "n")])


def seen(resource_id, phase, ok, component_id="web"):
    return Observation(component_id, resource_id, phase, ok, "api", "state running" if ok else "state stopped")


def test_all_checks_ok_is_healthy():
    result = summarize_component(WEB, [seen("i-1", "baseline", True), seen("i-2", "failure", True), seen("q", "baseline", False, "other")], None)

    assert result.status == "healthy"
    assert result.availability_pct == 100.0


def test_a_resource_that_came_back_is_degraded():
    observations = [seen("i-1", "baseline", True), seen("i-1", "failure", False), seen("i-1", "recovery", True), seen("i-2", "failure", True)]

    result = summarize_component(WEB, observations, None)

    assert result.status == "degraded"
    assert result.availability_pct == 75.0
    assert "failure 1/2" in result.note
    assert "state stopped x1" in result.note


def test_every_resource_ending_down_is_failed():
    observations = [seen("i-1", "baseline", True), seen("i-1", "recovery", False), seen("i-2", "baseline", True), seen("i-2", "recovery", False)]

    assert summarize_component(WEB, observations, None).status == "failed"


def test_note_names_the_injected_failure():
    target = FailureTarget("web", "virtual_machine", WEB.resources[0], FailureType.INSTANCE_STOP, "stop instance i-1")

    assert "stop instance i-1" in summarize_component(WEB, [seen("i-1", "baseline", True)], target).note


def test_no_observations_reports_no_availability():
    result = summarize_component(WEB, [], None)

    assert result.availability_pct is None
    assert "not observed" in result.note
