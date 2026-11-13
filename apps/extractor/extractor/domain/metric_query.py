from dataclasses import dataclass, field


@dataclass(frozen=True)
class MetricQuery:
    namespace: str
    name: str
    dimensions: dict = field(hash=False)
    unit: str
    stat: str = "Average"
    scale: float = 1.0

    @property
    def label(self):
        return f"metric {self.namespace}/{self.name} {list(self.dimensions.values())}"

    @property
    def basis(self):
        return f"CloudWatch {self.namespace} {self.name}, {self.stat}, period 3600"
