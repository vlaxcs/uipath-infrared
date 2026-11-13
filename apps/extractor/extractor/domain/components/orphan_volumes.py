from extractor.domain.cost_estimate import monthly_cost
from extractor.domain.point_metric import point_metric

GP2_USD_PER_GB_MONTH = 0.115
OTHER_USD_PER_GB_MONTH = 0.08


def unattached_volume_groups(volumes):
    groups = {}
    for volume in volumes:
        if not volume.get("Attachments"):
            groups.setdefault((volume["Size"], volume["VolumeType"], volume.get("Encrypted")), []).append(volume)
    return groups


def volume_price(volume_type):
    return GP2_USD_PER_GB_MONTH if volume_type == "gp2" else OTHER_USD_PER_GB_MONTH


def orphan_volumes(component_id, size, volume_type, encrypted, volumes):
    count, price = len(volumes), volume_price(volume_type)
    return {"id": component_id, "name": f"{count} unattached {volume_type} volume(s) of {size} GB", "kind": "block_storage",
            "service": "ebs", "sku": volume_type, "quantity": count, "status": "orphan", "stateful": True, "zones": 1,
            "capacity": {"storage_gb": point_metric(size, "GB")}, "security": {"encryption_at_rest": encrypted},
            "cost": monthly_cost(size * count * price, f"{volume_type} {price} USD/GB-mo x {size} GB x {count}"),
            "config": {"volume_ids": [v["VolumeId"] for v in volumes], "state": volumes[0]["State"]}}
