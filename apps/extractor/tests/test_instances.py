from types import SimpleNamespace

from extractor.application.context import ExtractionContext
from extractor.application.extract_compute import extract_instances
from extractor.application.warnings import Warnings
from extractor.domain.components.instance import is_gone
from extractor.domain.inventory import Inventory


def instance(instance_id, name, state):
    return {"InstanceId": instance_id, "InstanceType": "m5.large", "State": {"Name": state},
            "Tags": [{"Key": "Name", "Value": name}]}


class NoSeries:
    def read(self, *args, **kwargs):
        return None


def extracted(instances):
    aws = SimpleNamespace(ec2=SimpleNamespace(instances=lambda: instances))
    context = ExtractionContext(aws=aws, warnings=Warnings(), series=NoSeries(), region="us-east-1", window_days=14,
                                metric_provenance="synthetic", inventory=Inventory("us-east-1"))
    extract_instances(context, set())
    return context


def test_terminated_and_shutting_down_instances_are_not_components():
    context = extracted([instance("i-1", "web", "terminated"), instance("i-2", "web", "running"),
                         instance("i-3", "batch", "shutting-down"), instance("i-4", "batch", "stopped")])
    assert [c["id"] for c in context.inventory.components] == ["vm-web", "vm-batch"]
    assert context.warnings.messages == ["skipped 2 terminated or shutting-down EC2 instance(s): batch, web"]


def test_only_terminal_states_are_gone():
    assert [is_gone({"State": {"Name": s}}) for s in ("terminated", "shutting-down", "running", "stopped", "pending")] \
        == [True, True, False, False, False]
    assert not is_gone({})
