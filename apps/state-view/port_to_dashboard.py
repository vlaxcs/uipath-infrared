import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1])
SOURCE = ROOT / "apps" / "state-view" / "web"
TARGET = ROOT / "apps" / "dashboard" / "src" / "plan"
TOKENS = ROOT / "apps" / "dashboard" / "src" / "styles" / "tokens.css"

css = (SOURCE / "app.css").read_text(encoding="utf-8")


def var_block(selector_pattern: str) -> dict[str, str]:
    match = re.search(selector_pattern + r"\s*\{(.*?)\n\s*\}", css, re.S | re.M)
    declarations = {}
    for name, value in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", match.group(1)):
        declarations[name] = value.strip()
    return declarations


light = var_block(r"^:root")
dark = var_block(r":root\[data-theme=\"dark\"\]")

KEEP_OUT = {"--mast-h"}


def token_name(var: str) -> str:
    bare = var[2:]
    if bare.startswith("font-"):
        return "--font-estate-" + bare[len("font-"):]
    if bare == "radius":
        return "--radius-estate"
    if bare == "shadow":
        return "--shadow-estate"
    if bare == "detail-w":
        return "--size-estate-detail"
    return "--color-estate-" + bare


def rem(value: str) -> str:
    def convert(match):
        number = float(match.group(2))
        if number == 0:
            return "0"
        text = f"{number / 16:.4f}".rstrip("0").rstrip(".")
        return f"{match.group(1)}{text}rem"
    return re.sub(r"(?<![\w.])(-?)(\d+(?:\.\d+)?)px\b", convert, value)


light_tokens = "\n".join(f"  {token_name(v)}: {rem(value)};" for v, value in light.items() if v not in KEEP_OUT)
dark_tokens = "\n".join(f"    {token_name(v)}: {rem(value)};" for v, value in dark.items() if v not in KEEP_OUT and token_name(v).startswith(("--color-estate-", "--shadow-estate")))
aliases = "\n".join(f"  {v}: var({token_name(v)});" for v in light if v not in KEEP_OUT)

tokens = TOKENS.read_text(encoding="utf-8")
marker_light = "  --focus-ring-offset: 2px;\n}"
marker_dark = "@media (prefers-color-scheme: dark) {\n  :root {\n    color-scheme: dark;\n"
if "--color-estate-bg" not in tokens:
    assert marker_light in tokens and marker_dark in tokens
    tokens = tokens.replace(marker_light, "  --focus-ring-offset: 2px;\n\n" + light_tokens + "\n}", 1)
    tokens = tokens.replace(marker_dark, marker_dark + "\n" + dark_tokens + "\n", 1)
    TOKENS.write_text(tokens, encoding="utf-8")

rules = css[css.index("* { box-sizing: border-box; }"):]
rules = re.sub(r"/\* -+ masthead -+ \*/.*?(?=\.workspace \{)", "", rules, flags=re.S)
rules = re.sub(r"html, body \{[^}]*\}\n*", "", rules)
rules = re.sub(r"body \{[^}]*\}\n*", "", rules)
rules = re.sub(r"\n  :root \{ --mast-h: [^}]*\}\n", "\n", rules)
rules = re.sub(r"\n  \.(?:mast|brand|theme-switch)[^{]*\{[^}]*\}", "", rules)
rules = rules.replace("#000", "black")
rules = rules.replace("color-mix(in srgb, var(--accent) 62%, var(--surface))", "var(--color-estate-link-live)")
rules = rules.replace("height: calc(100vh - var(--mast-h));\n  height: calc(100dvh - var(--mast-h));", "height: min(52rem, calc(100dvh - 8rem));")
rules = re.sub(r"\.timeline \{\n  position: sticky;\n  top: var\(--mast-h\);", ".timeline {\n  position: relative;", rules)
rules = rules.replace("  position: fixed;\n  top: var(--mast-h);", "  position: absolute;\n  top: 0;")
rules = rules.replace(".detail { top: var(--mast-h); width: 100%; }", ".detail { top: 0; width: 100%; }")
rules = rem(rules)


def scope(selector_list: str) -> str:
    parts = []
    for selector in selector_list.split(","):
        selector = selector.strip()
        if not selector:
            continue
        if selector in ("*",):
            parts.append(".estate-view *")
        elif selector.startswith(":") or selector.startswith("::"):
            parts.append(".estate-view " + selector)
        else:
            parts.append(".estate-view " + selector)
    return ", ".join(parts)


def scope_block(text: str) -> str:
    out, i = [], 0
    while i < len(text):
        brace = text.find("{", i)
        if brace == -1:
            out.append(text[i:])
            break
        head = text[i:brace]
        prefix_ws = head[: len(head) - len(head.lstrip())]
        selector = head.strip()
        depth, j = 1, brace + 1
        while depth:
            depth += {"{": 1, "}": -1}.get(text[j], 0)
            j += 1
        body = text[brace + 1 : j - 1]
        comments = re.findall(r"/\*.*?\*/", selector, re.S)
        bare = re.sub(r"/\*.*?\*/", "", selector, flags=re.S).strip()
        lead = "".join(f"{c}\n" for c in comments)
        if bare.startswith("@keyframes"):
            out.append(f"{prefix_ws}{lead}{bare} {{{body}}}")
        elif bare.startswith("@media"):
            out.append(f"{prefix_ws}{lead}{bare} {{{scope_block(body)}}}")
        else:
            out.append(f"{prefix_ws}{lead}{scope(bare)} {{{body}}}")
        i = j
    return "".join(out)


root_rule = (
    ".estate-view {\n" + aliases + "\n"
    "  position: relative;\n"
    "  overflow: hidden;\n"
    "  border: var(--focus-ring-offset) solid var(--color-border);\n"
    "  border-radius: var(--radius-card);\n"
    "  background: var(--bg);\n"
    "  color: var(--ink);\n"
    "  font-family: var(--font-body);\n"
    "  font-size: 0.8125rem;\n"
    "  line-height: 1.45;\n"
    "  -webkit-font-smoothing: antialiased;\n"
    "}\n\n"
)
header = "/* Ported from apps/state-view/web/app.css by Andrei; regenerate with the port script named in docs/run-plan-view.md. */\n"
(TARGET / "estateView.css").write_text(header + root_rule + scope_block(rules), encoding="utf-8")

js = (SOURCE / "app.js").read_text(encoding="utf-8")


def swap(old: str, new: str) -> None:
    global js
    assert old in js, old[:80]
    js = js.replace(old, new, 1)


swap('''(function () {
  "use strict";

  var dataset = window.ESTATE && window.ESTATE.dataset;
  var app = document.getElementById("app");
  if (!dataset || !app) {
    if (app) app.innerHTML = '<p style="padding:24px;font:14px system-ui">No state data found.</p>';
    return;
  }
''', '''export function mountEstateView(container, dataset, options) {
  "use strict";

  var settings = options || {};
  var app = container;
  app.classList.add("estate-view");
  if (!dataset || !dataset.states || !dataset.states.length) {
    app.textContent = "No states to show.";
    return function () {};
  }
''')
swap('''  var theme = "light";
''', "")
swap('''      '<header class="mast">' +
        '<div class="mast-brand">' +
          '<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '<div><span class="brand-name">Infrared</span><span class="brand-sub">Estate states</span></div>' +
        '</div>' +
        '<div class="mast-title">' +
          '<h1>' + esc(dataset.title) + '</h1>' +
          '<p>' + esc(BASELINE.stacks + " stacks, " + BASELINE.components + " resources at baseline") + '</p>' +
        '</div>' +
        '<div class="mast-actions">' +
          '<span class="sample-chip">Sample plan</span>' +
          '<div class="theme-switch" role="group" aria-label="Theme">' +
            '<button type="button" data-theme-set="light">Light</button>' +
            '<button type="button" data-theme-set="dark">Dark</button>' +
          '</div>' +
        '</div>' +
      '</header>' +
''', '''      (dataset.source && dataset.source.sample ? '<span class="sample-chip">Sample plan</span>' : '') +
''')
swap('''        '<p class="footnote">Sample plan. Costs between A and B are modelled from action savings; availability is measured at A and estimated at B.</p>' +''',
     '''        '<p class="footnote">' + (dataset.source && dataset.source.sample ? 'Sample plan. ' : '') + 'Costs between A and B are modelled from action savings; availability is measured at A and estimated at B.</p>' +''')
swap('''    try {
      window.history.replaceState(null, "", "#" + currentState().id);
    } catch (err) { /* file:// may refuse history updates */ }
''', "")
swap('''      el.classList.toggle("is-other", !!focus && !related[id] && id !== focus);
    });''', '''      el.classList.toggle("is-other", !!focus && !related[id] && id !== focus);
      el.classList.toggle("is-rehearsal-failed", !!settings.failedComponent && id === settings.failedComponent && index === states.length - 1);
    });''')
js = re.sub(r"  function setTheme\(next, persist\) \{.*?\n  \}\n\n  function initialTheme\(\) \{.*?\n  \}\n", "", js, flags=re.S)
swap('''    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-state-index],[data-step],[data-res],[data-dep],[data-close],[data-theme-set],[data-topo-jump],[data-topo-play]");''',
     '''    app.addEventListener("click", onClick);
    app.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", onResize);
  }

  function onClick(event) {
      var target = event.target.closest("[data-state-index],[data-step],[data-res],[data-dep],[data-close],[data-topo-jump],[data-topo-play]");''')
swap('''      } else if (target.hasAttribute("data-close")) {
        clearSelection();
      } else if (target.hasAttribute("data-theme-set")) {
        setTheme(target.getAttribute("data-theme-set"), true);
      }
    });

    document.addEventListener("keydown", function (event) {''', '''      } else if (target.hasAttribute("data-close")) {
        clearSelection();
      }
  }

  function onKeydown(event) {''')
swap('''      else if (event.key === "Escape") { clearSelection(); }
    });

    var resizeFrame = 0;
    window.addEventListener("resize", function () {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(function () {
        resizeFrame = 0;
        updateTimeline();
        var box = refs.topoCanvas.getBoundingClientRect();
        if (box.width + "x" + box.height !== topo.box) renderTopologyCanvas();
      });
    });
  }''', '''      else if (event.key === "Escape") { clearSelection(); }
  }

  var resizeFrame = 0;
  function onResize() {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(function () {
        resizeFrame = 0;
        updateTimeline();
        var box = refs.topoCanvas.getBoundingClientRect();
        if (box.width + "x" + box.height !== topo.box) renderTopologyCanvas();
      });
  }

  function destroy() {
    stopPlay();
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    app.removeEventListener("click", onClick);
    app.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", onResize);
    app.innerHTML = "";
    app.classList.remove("estate-view");
  }''')
swap('''  function initialStateIndex() {
    var match = /state-(\\d+)/.exec(window.location.hash || "");
    if (!match) return 0;
    var idx = Number(match[1]);
    return idx >= 0 && idx < states.length ? idx : 0;
  }
''', '''  function initialStateIndex() {
    var wanted = Number(settings.initialIndex);
    return wanted >= 0 && wanted < states.length ? wanted : 0;
  }
''')
swap('''  stateIndex = initialStateIndex();
  setTheme(initialTheme(), false);
  renderTopologyCanvas();
  updateTimeline();
  renderDetail();
  bind();
})();''', '''  stateIndex = initialStateIndex();
  renderTopologyCanvas();
  updateTimeline();
  renderDetail();
  bind();
  return destroy;
}''')
js = js.replace('\n  var BASELINE = dataset.baseline || {};\n', '\n')
assert "document.addEventListener" not in js and "window.location" not in js and "localStorage" not in js and "data-theme" not in js
(TARGET / "estateView.js").write_text("/* Ported from apps/state-view/web/app.js by Andrei; regenerate with the port script named in docs/run-plan-view.md. */\n" + js, encoding="utf-8")
print("ported:", len(css), "->", (TARGET / "estateView.css").stat().st_size, "bytes css;", (TARGET / "estateView.js").stat().st_size, "bytes js")
