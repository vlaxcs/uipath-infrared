import argparse
from pathlib import Path

from agent import settings
from agent.adapters.aws_tools import READ_TOOLS
from agent.adapters.contracts import ContractChecker
from agent.adapters.engine import EngineCli
from agent.adapters.sdk import ClaudeSession
from agent.application.investigate import investigate
from agent.application.propose import Proposal, ProposalInputs


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="agent")
    root.add_argument("--model", default="sonnet")
    root.add_argument("--max-turns", type=int, default=150)
    commands = root.add_subparsers(dest="command", required=True)
    investigating = commands.add_parser("investigate", help="review the estate; write the findings")
    investigating.add_argument("--infra", type=Path, required=True)
    investigating.add_argument("--out", type=Path, required=True)
    proposing = commands.add_parser("propose", help="propose candidates the engine evaluates; write candidates.json")
    for name in ("--infra", "--forecast", "--catalog", "--findings", "--out"):
        proposing.add_argument(name, type=Path, required=True)
    proposing.add_argument("--revision", type=int, required=True)
    proposing.add_argument("--feedback", type=Path)
    return root


def main(argv: list[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    settings.llm()
    session = ClaudeSession(arguments.model, arguments.max_turns, arguments.out.resolve().parent)
    if arguments.command == "investigate":
        return investigate(arguments.infra, arguments.out, session, READ_TOOLS)
    engine = EngineCli(settings.engine_command())
    inputs = ProposalInputs(arguments.infra, arguments.forecast, arguments.catalog, arguments.findings, arguments.revision, arguments.feedback, arguments.out)
    return Proposal(inputs, session, engine, ContractChecker()).run()
