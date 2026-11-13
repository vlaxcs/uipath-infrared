from dataclasses import dataclass, field


@dataclass
class References:
    target_group_backends: dict = field(default_factory=dict)
    target_group_balancers: dict = field(default_factory=dict)
    balancer_dns: dict = field(default_factory=dict)
    database_endpoints: dict = field(default_factory=dict)
    environments: dict = field(default_factory=dict)
    queue_urls: dict = field(default_factory=dict)
    queue_arns: dict = field(default_factory=dict)
    buckets: dict = field(default_factory=dict)
    function_arns: dict = field(default_factory=dict)
    topics: dict = field(default_factory=dict)
    stream_arns: dict = field(default_factory=dict)
    delivery_streams: dict = field(default_factory=dict)
    rules: dict = field(default_factory=dict)
    database_logins: dict = field(default_factory=dict)
