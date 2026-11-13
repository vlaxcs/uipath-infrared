import secrets
import time
from datetime import datetime, timezone
from typing import Callable, List

from ..adapters.aws_clients import AwsClients, connect
from ..adapters.compute_builder import instance_states
from ..adapters.data_plane_targets import http_targets, tcp_targets
from ..adapters.failure_injector import FailureInjector
from ..adapters.floci_endpoints import in_vpc_api_url
from ..adapters.health_prober import HealthProber
from ..adapters.inventory import list_inventory
from ..adapters.load_generator import LoadGenerator
from ..adapters.machine_image import find_linux_image
from ..adapters.network_builder import build_network
from ..adapters.teardown import teardown_prefix
from ..domain.build_plan import plan_build
from ..domain.end_state import EndState
from ..domain.failure_target import choose_failure_target
from ..domain.naming import BASE_PREFIX, resource_name, run_prefix
from ..domain.teardown_selection import InventoryItem, select_owned
from ..settings import AwsSettings
from .component_builder import build_components, instance_ids
from .floci_builders import floci_builders
from .measurement_notes import measurement_notes
from .run_outcome import RunOutcome


class LeftoverResources(Exception):
    def __init__(self, items: List[InventoryItem]):
        super().__init__(", ".join(f"{item.resource_type} {item.name}" for item in items))
        self.items = items


class Rehearsal:
    def __init__(self, settings: AwsSettings, log: Callable[[str], None] = print, phase_seconds: float = 15.0, requests_per_second: int = 5, probe_every_s: float = 3.0, ready_timeout_s: float = 300.0, effect_timeout_s: float = 45.0):
        self.settings = settings
        self.log = log
        self.phase_seconds = phase_seconds
        self.requests_per_second = requests_per_second
        self.probe_every_s = probe_every_s
        self.ready_timeout_s = ready_timeout_s
        self.effect_timeout_s = effect_timeout_s

    def run(self, state: EndState, min_availability_pct: float, forecast_id: str) -> RunOutcome:
        candidate = state.candidate
        clients = connect(self.settings)
        leftovers = select_owned(list_inventory(clients), BASE_PREFIX)
        if leftovers:
            raise LeftoverResources(leftovers)
        prefix = run_prefix(secrets.token_hex(3))
        outcome = RunOutcome(candidate.id, forecast_id, min_availability_pct, prefix, self.settings.endpoint_url, datetime.now(timezone.utc))
        outcome.skipped = list(state.skipped)
        try:
            self.execute(clients, candidate, outcome)
        finally:
            self.log(f"tearing down everything under {prefix}")
            outcome.remaining = teardown_prefix(clients, prefix, self.log)
            outcome.completed_at = datetime.now(timezone.utc)
        return outcome

    def execute(self, clients: AwsClients, candidate, outcome: RunOutcome) -> None:
        plan = plan_build(candidate)
        outcome.not_built.extend(plan.not_built)
        for item in plan.not_built:
            self.log(f"  not built: {item.component_id} ({item.kind}): {item.reason}")
        self.log(f"building network under {outcome.prefix} over {plan.network_zones} zones")
        network = build_network(clients, outcome.prefix, self.settings.region, plan.network_zones)
        outcome.vpc_id = network.vpc_id
        image_id = find_linux_image(clients)
        components, failed = build_components(plan.actions, floci_builders(clients, network, outcome.prefix, image_id), self.log)
        outcome.components = components
        outcome.not_built.extend(failed)
        loadgen_name = resource_name(outcome.prefix, "loadgen")
        loadgen = LoadGenerator(clients, loadgen_name, in_vpc_api_url(self.settings.endpoint_url))
        loadgen.create_bucket()
        http = http_targets(components)
        outcome.target_endpoint = " ".join(target["url"] for target in http)
        outcome.requests_per_second = self.requests_per_second if http else 0
        max_seconds = int(self.ready_timeout_s + 3 * self.phase_seconds + self.effect_timeout_s + 120)
        generator = loadgen.launch(network, image_id, loadgen_name, http, tcp_targets(components), self.requests_per_second, max_seconds)
        outcome.notes = measurement_notes(components, loadgen_name, self.settings.region)
        outcome.readiness = self.wait_ready(clients, components, loadgen, generator.resource_id)
        outcome.failure_target = choose_failure_target(components)
        self.run_timeline(clients, components, loadgen, outcome)
        outcome.records = loadgen.records()
        self.log(f"collected {len(outcome.records)} traffic records and {len(outcome.observations)} API observations")

    def wait_ready(self, clients: AwsClients, components, loadgen: LoadGenerator, generator_id: str) -> dict:
        started = time.time()
        watched = instance_ids(components) + [generator_id]
        prober = HealthProber(clients, components)
        while True:
            states = instance_states(clients, watched)
            health = prober.target_health()
            sampled = len(loadgen.results()["samples"])
            running = all(state == "running" for state in states.values())
            healthy = all(state == "healthy" for state in health.values())
            waited = time.time() - started
            if (running and healthy and sampled) or waited > self.ready_timeout_s:
                ready = running and healthy and sampled > 0
                self.log(f"ready={ready} after {waited:.0f}s: instances {states}, targets {health}, load generator samples {sampled}")
                return {"ready": ready, "waited_s": round(waited, 1), "instances": states, "targets": health, "load_generator_samples_before_baseline": sampled}
            self.log(f"  waiting {waited:.0f}s: running {sum(state == 'running' for state in states.values())}/{len(states)}, healthy targets {sum(state == 'healthy' for state in health.values())}/{len(health)}, load generator samples {sampled}")
            time.sleep(3)

    def observe(self, prober: HealthProber, phase: str, seconds: float, outcome: RunOutcome, until: Callable[[], bool] = lambda: False) -> None:
        phase_start = time.monotonic()
        while time.monotonic() - phase_start < seconds:
            tick = time.monotonic()
            outcome.observations.extend(prober.observe(phase))
            if until():
                break
            time.sleep(max(0.0, min(self.probe_every_s - (time.monotonic() - tick), seconds - (time.monotonic() - phase_start))))
        outcome.phase_seconds[phase] = outcome.phase_seconds.get(phase, 0.0) + time.monotonic() - phase_start

    def run_timeline(self, clients: AwsClients, components, loadgen: LoadGenerator, outcome: RunOutcome) -> None:
        prober = HealthProber(clients, components)
        injector = FailureInjector(clients)
        target = outcome.failure_target
        started = time.monotonic()
        loadgen.set_phase("baseline")
        self.log(f"baseline for {self.phase_seconds:.0f}s")
        self.observe(prober, "baseline", self.phase_seconds, outcome)
        loadgen.set_phase("failure")
        outcome.injected_at_s = time.monotonic() - started
        outcome.inject_detail = injector.inject(target) if target else "nothing injected"
        self.log(f"failure at {outcome.injected_at_s:.1f}s on {target.component_id if target else '-'}: {outcome.inject_detail}")
        if target:
            self.observe(prober, "failure", self.effect_timeout_s, outcome, lambda: injector.effective(target))
            outcome.effective_after_s = time.monotonic() - started - outcome.injected_at_s
            outcome.inject_detail += f"; Floci reported the failure in effect {outcome.effective_after_s:.1f}s after the call ({injector.state(target)})"
            self.log(f"  in effect after {outcome.effective_after_s:.1f}s")
        self.observe(prober, "failure", self.phase_seconds, outcome)
        outcome.restored_at_s = time.monotonic() - started
        outcome.restore_detail = injector.restore(target) if target else "nothing to restore"
        loadgen.set_phase("recovery")
        self.log(f"restore at {outcome.restored_at_s:.1f}s: {outcome.restore_detail}")
        self.observe(prober, "recovery", self.phase_seconds, outcome)
        loadgen.set_phase("stop")
        deadline = time.time() + 30
        while not loadgen.results().get("done") and time.time() < deadline:
            time.sleep(2)
