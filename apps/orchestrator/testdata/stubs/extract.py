import argparse
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]

parser = argparse.ArgumentParser()
parser.add_argument("--project", required=True)
parser.add_argument("--out", required=True)
arguments = parser.parse_args()
shutil.copyfile(REPO / "contracts" / "mock" / f"{arguments.project}.infra.json", arguments.out)
