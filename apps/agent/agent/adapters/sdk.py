import asyncio
import sys
from pathlib import Path
from typing import Sequence

from claude_agent_sdk import (
    AgentDefinition, AssistantMessage, ClaudeAgentOptions, ResultMessage, TextBlock, ToolUseBlock, create_sdk_mcp_server, query, tool,
)

from agent.application.tools import Tool
from agent.domain.prompts import Specialist

SERVER = "infra"
BUILT_IN_TOOLS = ["Bash", "Write", "Edit", "NotebookEdit", "WebFetch", "WebSearch", "Read", "Glob", "Grep"]


class ClaudeSession:
    def __init__(self, model: str, max_turns: int, workdir: Path):
        self.model = model
        self.max_turns = max_turns
        self.workdir = workdir

    def run(self, system_prompt: str, prompt: str, tools: Sequence[Tool], specialists: Sequence[Specialist]) -> None:
        asyncio.run(self._run(system_prompt, prompt, tools, specialists))

    async def _run(self, system_prompt: str, prompt: str, tools: Sequence[Tool], specialists: Sequence[Specialist]) -> None:
        names = [f"mcp__{SERVER}__{t.name}" for t in tools]
        options = ClaudeAgentOptions(
            system_prompt=system_prompt,
            model=self.model,
            mcp_servers={SERVER: create_sdk_mcp_server(SERVER, tools=[_sdk_tool(t) for t in tools])},
            allowed_tools=names + (["Agent"] if specialists else []),
            disallowed_tools=BUILT_IN_TOOLS,
            agents={s.name: AgentDefinition(description=s.description, prompt=s.prompt, tools=names, model="inherit") for s in specialists},
            permission_mode="dontAsk",
            setting_sources=[],
            cwd=str(self.workdir),
            max_turns=self.max_turns,
        )
        async for message in query(prompt=prompt, options=options):
            _report(message)


def _sdk_tool(spec: Tool):
    async def handler(arguments):
        return spec.handler(arguments)

    return tool(spec.name, spec.description, spec.schema)(handler)


def _report(message) -> None:
    if isinstance(message, AssistantMessage):
        for block in message.content:
            if isinstance(block, ToolUseBlock):
                print(f"  -> {block.name} {str(block.input)[:110]}", file=sys.stderr)
            elif isinstance(block, TextBlock) and block.text.strip():
                print(block.text.strip(), file=sys.stderr)
    elif isinstance(message, ResultMessage):
        print(f"== done: {message.subtype}, turns={message.num_turns}, cost=${message.total_cost_usd or 0:.2f}", file=sys.stderr)
