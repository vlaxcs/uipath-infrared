from extractor.domain.instance_specs import INSTANCE_SPECS, SPEC_BASIS
from extractor.domain.point_metric import point_metric


def instance_capacity(sku):
    if sku not in INSTANCE_SPECS:
        return {}
    vcpu, memory_gb, gpus, _ = INSTANCE_SPECS[sku]
    capacity = {"vcpu": point_metric(vcpu, "count", "estimated", SPEC_BASIS),
                "memory_gb": point_metric(memory_gb, "GB", "estimated", SPEC_BASIS)}
    if gpus:
        capacity["gpus"] = point_metric(gpus, "count", "estimated", SPEC_BASIS)
    return capacity
