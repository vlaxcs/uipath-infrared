---
name: estate-diagram
description: Build or change the InfraRed cloud-estate visualizer (infrared/synth/graph_template.html, graph/graph.html). Use when asked to redesign, extend or debug the infrastructure graph/diagram so it stays readable for engineers and ops staff.
---

# Estate diagram

The visualizer is an **architecture diagram, not a network graph**. Audience: engineers, SREs and FinOps staff who already
know AWS and want to answer "what is this, what does it depend on, and is it wasting money or exposed?" in seconds.
Decorative layouts (force-directed blobs, constellations, 3D orbits) were tried and rejected: they look busy and hide structure.

## Files
- `infrared/synth/graph.py` collects live floci state and writes `graph/graph.json`, `graph.dot`, `graph.html`. It fills the
  placeholder `/*__GRAPH__*/null` in `infrared/synth/graph_template.html` with the JSON. Keep that placeholder verbatim.
- Data contract (`graph.json`): `nodes[{id,label,type,category,stack,status,attrs,degree}]`,
  `edges[{src,dst,kind,note,source}]`. `status` is one of `active|idle|orphan|exposed`. Edge `kind` is one of
  `network|data|event|traffic|dns|config|contains`. Do not change the contract from the template side.
- Never read `ground_truth/` from the visualizer: status is derived from observed state, not the planted-issue ledger.

## Design rules
1. **Structure first.** Layout encodes meaning: one card per stack, the VPC is the card header (name + CIDR), resources sit in
   labelled tiers in a fixed order (Edge & DNS, Compute, Data, Messaging, Storage, Network & security, Identity & registry).
   Position never changes between loads or interactions.
2. **No hairballs.** Draw no links by default. Links appear for the hovered/selected resource (upstream and downstream, with
   arrowheads and a kind label). An explicit "all links" toggle may show the rest, filtered by kind.
3. **Say it in words.** Every resource shows its name, a type tag (EKS, RDS, S3...) and one or two key facts (instance type,
   engine, CPU 24h). Status is a text pill (IDLE / ORPHAN / EXPOSED) plus colour, never colour alone.
4. **Answer the FinOps question at the top.** KPI tiles: total, idle, orphan, exposed. Clicking one highlights matching
   resources everywhere and dims the rest (dim, don't hide, so context survives).
5. **Detail on demand.** Click opens a side panel: attributes, "Depends on", "Used by" (clickable, with edge kind and note).
6. **Calm visuals.** Neutral surfaces, one accent per stack (on the card header only), soft shadows, system font plus mono for
   identifiers, light and dark themes (`prefers-color-scheme` plus a toggle). Everything readable at 1280px wide, usable on a phone.
7. **Self-contained.** One HTML file, no network, no build step, no libraries. Plain DOM for boxes, one SVG overlay for links.

## Workflow
1. Edit `infrared/synth/graph_template.html`.
2. Rebuild without the live estate by substituting the existing JSON:
   `python3 -c "import json;t=open('infrared/synth/graph_template.html').read();open('infrared/graph/graph.html','w').write(t.replace('/*__GRAPH__*/null',json.dumps(json.load(open('infrared/graph/graph.json')))))"`
   (or `cd infrared && .venv/bin/python -m synth.graph` when floci is up).
3. Verify visually, do not guess:
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --window-size=1500,950 --virtual-time-budget=4000 --screenshot=out.png --enable-logging=stderr --v=0 file://$PWD/infrared/graph/graph.html 2>&1 | grep CONSOLE`
   Any CONSOLE line is a JS error. Look at the screenshot, then also one with a resource pre-selected (append a `select(...)` call
   to a scratch copy).
4. Commit the template and the regenerated `graph/graph.html` together.
