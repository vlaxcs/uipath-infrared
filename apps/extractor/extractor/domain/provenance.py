def is_floci_endpoint(endpoint):
    return "localhost" in endpoint or "127.0.0.1" in endpoint


def metric_provenance(endpoint):
    return "synthetic" if is_floci_endpoint(endpoint) else "observed"
