#!/usr/bin/env python3
import json
import sys
from pathlib import Path


def normalize(data):
    data = data.copy()
    if "source" in data:
        data["source"] = {k: v for k, v in data["source"].items() if k not in ("generated_at", "extractor_version")}
    if "components" in data:
        for comp in data["components"]:
            if "usage" in comp:
                for metric_name, metric in list(comp["usage"].items()):
                    if isinstance(metric, dict):
                        comp["usage"][metric_name] = {
                            k: v for k, v in metric.items()
                            if k not in ("avg", "min", "p50", "p95", "max", "sum", "basis")
                        }
                        comp["usage"][metric_name]["_has_values"] = True
    return data


def main():
    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("tests/fixtures/baseline.normalized.json")

    data = json.loads(input_file.read_text())
    normalized = normalize(data)

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(normalized, indent=2) + "\n")
    print(f"Normalized baseline saved to {output_file}")


if __name__ == "__main__":
    main()
