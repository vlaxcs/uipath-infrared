from extractor.application.warnings import attempt
from extractor.domain.components.object_storage import bucket, is_internal_bucket


def extract_s3(context):
    api, warnings, series = context.aws.s3, context.warnings, context.series
    for name in warnings.guard("s3 list", api.bucket_names, []):
        if is_internal_bucket(name):
            warnings.note(f"skipped {name}: Floci-internal bucket")
            continue
        policy = warnings.guard(f"policy {name}", lambda: api.policy(name))
        encrypted = attempt(lambda: api.encryption_configured(name))
        versioned = warnings.guard(f"versioning {name}", lambda: api.versioning_enabled(name))
        lifecycle = attempt(lambda: api.lifecycle_rules_present(name))
        size = series.read("AWS/S3", "BucketSizeBytes", {"BucketName": name, "StorageType": "StandardStorage"}, "gb", scale=1 / 2**30)
        objects = series.read("AWS/S3", "NumberOfObjects", {"BucketName": name, "StorageType": "AllStorageTypes"}, "count")
        component_id = context.slugs.make(name, "s3-")
        context.references.buckets[name] = component_id
        context.inventory.add(bucket(component_id, name, policy, encrypted, versioned, lifecycle, size, objects, context.metric_provenance))
