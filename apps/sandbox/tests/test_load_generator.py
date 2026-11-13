import re

from sandbox.adapters.load_generator import LoadGenerator


def test_user_data_carries_a_runnable_agent_and_its_config():
    script = LoadGenerator(None, "sandbox-x-loadgen", "http://localhost.floci.io:4566").user_data({"control_url": "u", "http_targets": []})

    agent = re.search(r"<<'SANDBOX_AGENT'\n(.*)\nSANDBOX_AGENT\n", script, re.S).group(1)
    compile(agent, "loadgen.py", "exec")
    assert "def main(config_path)" in agent
    assert re.search(r"<<'SANDBOX_CONFIG'\n\{\"control_url\": \"u\", \"http_targets\": \[\]\}\nSANDBOX_CONFIG\n", script)
