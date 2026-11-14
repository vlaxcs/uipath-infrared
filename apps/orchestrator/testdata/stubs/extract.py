import argparse
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]

parser = argparse.ArgumentParser()
parser.add_argument("--project", required=True)
parser.add_argument("--out", required=True)
arguments = parser.parse_args()
source = REPO / "contracts" / "mock" / f"{arguments.project}.infra.json"
shutil.copyfile(source, arguments.out)
print(f"extract stub: no cloud read; copied {source.relative_to(REPO).as_posix()}", file=sys.stderr)
