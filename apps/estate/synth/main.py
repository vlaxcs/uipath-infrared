import sys
from . import common, foundation, compute, data, wiring

STACKS = [("data", data), ("compute", compute), ("wiring", wiring)]


def run():
    print("== foundation ==")
    ctx = foundation.build()
    for name, mod in STACKS:
        print(f"== {name} ==")
        mod.build(ctx)
    common.write_ledger("ground_truth/planted_issues.json")
    print(f"\nplanted {len(common.LEDGER)} issues, {len(common.FAILURES)} emulator failures")


if __name__ == "__main__":
    run()
