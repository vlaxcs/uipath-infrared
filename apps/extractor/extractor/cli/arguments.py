import argparse
from pathlib import Path

DEFAULT_OUTPUT = Path(__file__).resolve().parents[4] / "contracts" / "real" / "floci-estate.infra.json"


def parse_arguments(aws_settings, argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--endpoint", default=aws_settings.endpoint_url)
    parser.add_argument("--region", default=aws_settings.region)
    parser.add_argument("--project", default="floci-estate")
    parser.add_argument("--window-days", type=int, default=14)
    parser.add_argument("--out", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--extensions", action="store_true")
    return parser.parse_args(argv)
