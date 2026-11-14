import argparse

from projects import clinic, fleet
from projects.metrics import push_metrics
from projects.teardown import teardown

PROJECTS = {"clinic-booking": clinic, "fleet-telemetry": fleet}


def main():
    parser = argparse.ArgumentParser(prog="python -m projects")
    parser.add_argument("action", choices=["build", "metrics", "teardown"])
    parser.add_argument("project", choices=sorted(PROJECTS))
    arguments = parser.parse_args()
    estate = PROJECTS[arguments.project]
    if arguments.action == "build":
        estate.build()
    elif arguments.action == "metrics":
        push_metrics(estate.series())
    else:
        teardown(estate.PREFIX)


if __name__ == "__main__":
    main()
