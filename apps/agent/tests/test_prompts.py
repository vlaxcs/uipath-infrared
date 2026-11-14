from agent.domain.prompts import proposal_prompt

INFRA = {"project": "company", "components": [{"id": "web", "kind": "compute"}]}
FINDINGS = {"findings": []}


def forecast(projects=None):
    document = {"hard_constraints": {"allowed_providers": ["aws"]}, "cto_settings": {"strategies_enabled": ["do_nothing"]}}
    if projects is not None:
        document["projects"] = projects
    return document


def test_without_projects_the_prompt_has_no_roadmap_section():
    assert "Roadmap projects" not in proposal_prompt(INFRA, forecast(), FINDINGS, None, [])
    assert "Roadmap projects" not in proposal_prompt(INFRA, forecast([]), FINDINGS, None, [])


def test_each_project_shows_its_stacks_focus_and_quoted_intent():
    prompt = proposal_prompt(INFRA, forecast([
        {"id": "billing", "name": "Billing", "stacks": ["api", "db"], "intent": 'Move to the EU, "soon"'},
        {"id": "search", "stacks": ["search"], "focus": {"focus": "zone", "market": "fr", "allowed_regions": ["eu-*"]}},
    ]), FINDINGS, None, [])
    assert '- Billing: stacks api, db; focus default; intent "Move to the EU, \\"soon\\""' in prompt
    assert '- search: stacks search; focus zone (allowed_regions ["eu-*"], market "fr")' in prompt
    assert "honour each project's stated intent where the hard constraints allow" in prompt
    assert "rationale" in prompt


def test_the_prompt_is_deterministic():
    projects = [{"id": "a", "stacks": ["x"], "intent": "keep it cheap"}]
    assert proposal_prompt(INFRA, forecast(projects), FINDINGS, None, []) == proposal_prompt(INFRA, forecast(projects), FINDINGS, None, [])


def test_the_proposal_lists_the_catalog_options_a_move_can_target():
    from agent.domain.prompts import proposal_prompt

    forecast = {"hard_constraints": {"allowed_providers": ["aws"]}, "cto_settings": {"strategies_enabled": ["do_nothing"]}}
    catalog = {"options": [
        {"id": "aws-rds-postgres", "kind": "postgres", "provider": "aws", "regions": ["eu-*", "us-*"]},
        {"id": "neon-postgres", "kind": "postgres", "provider": "neon", "regions": ["eu-*"]},
    ]}
    prompt = proposal_prompt({"project": "company", "components": []}, forecast, {"findings": []}, None, [], catalog)
    assert "- aws-rds-postgres: postgres, aws, regions eu-*, us-*" in prompt
    assert "neon-postgres" not in prompt
