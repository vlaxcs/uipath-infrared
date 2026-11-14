/* Ported from apps/state-view/web/app.js by Andrei; regenerate with the port script named in docs/run-plan-view.md. */
export function mountEstateView(container, dataset, options) {
  "use strict";

  var settings = options || {};
  var app = container;
  app.classList.add("estate-view");
  if (!dataset || !dataset.states || !dataset.states.length) {
    app.textContent = "No states to show.";
    return function () {};
  }

  var states = dataset.states || [];
  var stages = dataset.stages || [];
  var stepCount = dataset.stepCount || Math.max(0, states.length - 1);
  var stateIndex = 0;
  var selectedId = null;
  var refs = {};

  var CARD = null;

  var STAGE_LABELS = {};
  stages.forEach(function (stage) {
    STAGE_LABELS[stage.id] = stage.label;
  });

  /* ------------------------------- helpers ------------------------------ */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function fmtEur(value) {
    var n = Math.round(Number(value) || 0);
    return "€" + n.toLocaleString("en-US");
  }

  function fmtSigned(value) {
    var n = Math.round(Number(value) || 0);
    if (!n) return "—";
    return (n < 0 ? "−" : "+") + fmtEur(Math.abs(n));
  }

  function fmtPct(value) {
    if (value == null) return "—";
    return String(value).replace(/(\.\d\d)0+$/, "$1").replace(/\.0+$/, "") + "%";
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function currentState() {
    return states[stateIndex] || states[0];
  }

  function findComponent(state, id) {
    if (!state || !state.infra) return null;
    for (var i = 0; i < state.infra.components.length; i += 1) {
      if (state.infra.components[i].id === id) return state.infra.components[i];
    }
    return null;
  }

  function stackName(id) {
    for (var i = 0; i < dataset.states[0].infra.stacks.length; i += 1) {
      var stack = dataset.states[0].infra.stacks[i];
      if (stack.id === id) return stack.name;
    }
    return id;
  }

  function changeFor(state, id) {
    var list = state.changes || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].component === id) return list[i];
    }
    return null;
  }

  /* -------------------------------- shell ------------------------------- */


  function shellHtml() {
    return '' +
      (dataset.source && dataset.source.sample ? '<span class="sample-chip">Sample plan</span>' : '') +
      '<div class="workspace" data-workspace>' +
        '<nav class="timeline" aria-label="Migration states" data-timeline></nav>' +
        '<section class="topo" aria-label="Topology from current to target" data-topo></section>' +
        '<p class="visually-hidden" aria-live="polite" data-live></p>' +
        '<aside class="detail" aria-label="Resource detail" hidden></aside>' +
      '</div>';
  }

  /* ------------------------------- timeline ----------------------------- */

  /* A horizontal carousel of states. The track is built once; stepping only
     moves it and re-grades the nodes, so upcoming states slide out of shadow. */

  var TL_NODE_W = 148;
  var TL_REVEAL = 3;

  function deltaClass(value) {
    if (value < 0) return " is-save";
    if (value > 0) return " is-spend";
    return "";
  }

  function timelineHtml() {
    var seenStage = {};
    var nodes = states.map(function (state) {
      var stageId = state.index === 0 ? "start" : state.stageId;
      var stageTag = "";
      if (!seenStage[stageId]) {
        seenStage[stageId] = true;
        stageTag = '<span class="tl-stage">' + esc(state.index === 0 ? "Start" : (STAGE_LABELS[stageId] || stageId)) + '</span>';
      }
      var delta = state.summary.delta_eur;
      return '<li class="tl-node" data-tl-node="' + state.index + '"' + (stageTag ? ' data-stage-start="true"' : '') + '>' +
        stageTag +
        '<button type="button" data-state-index="' + state.index + '" aria-label="' +
          esc((state.index === 0 ? "Current estate" : "Step " + state.step) + ", " + state.shortLabel + ", " + fmtEur(state.summary.monthly_eur) + " monthly") + '">' +
          '<span class="tl-dot" aria-hidden="true"></span>' +
          '<span class="tl-index">' + (state.index === 0 ? "A" : state.index === states.length - 1 ? "B" : pad2(state.step)) + '</span>' +
          '<span class="tl-label">' + esc(state.shortLabel) + '</span>' +
          '<span class="tl-delta' + deltaClass(delta) + '">' + (state.index === 0 ? fmtEur(state.summary.monthly_eur) : fmtSigned(delta)) + '</span>' +
        '</button>' +
      '</li>';
    }).join("");
    return '' +
      '<div class="tl-summary" data-tl-summary></div>' +
      '<div class="tl-row">' +
        '<button type="button" class="tl-arrow" data-step="-1" aria-label="Previous state">' +
          '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M6.5 1.5 3 5l3.5 3.5"/></svg></button>' +
        '<div class="tl-viewport" data-tl-viewport>' +
          '<ol class="tl-track" data-tl-track style="width:' + (states.length * TL_NODE_W) + 'px">' + nodes + '</ol>' +
        '</div>' +
        '<button type="button" class="tl-arrow" data-step="1" aria-label="Next state">' +
          '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 1.5 7 5l-3.5 3.5"/></svg></button>' +
      '</div>';
  }

  function summaryHtml(state) {
    var summary = state.summary || {};
    var kicker = state.step === 0 ? "A · Baseline" : state.index === states.length - 1 ? "B · Step " + state.step + " of " + stepCount : "Step " + state.step + " of " + stepCount;
    var stageLabel = state.step === 0 ? "Start" : (STAGE_LABELS[state.stageId] || state.stageId);
    var saved = summary.cumulative_saving_eur || 0;
    var availability = summary.availability_source === "observed" ? "observed"
      : summary.availability_source === "engine" ? "engine estimate" : "not measured";
    return '' +
      '<div class="tl-title">' +
        '<p class="tl-kicker"><span class="kicker-mark" aria-hidden="true"></span>' + esc(kicker) + '<span class="kicker-stage">' + esc(stageLabel) + '</span></p>' +
        '<h2>' + esc(state.shortLabel) + '</h2>' +
        '<p class="tl-reason">' + esc(state.reason || "") + '</p>' +
      '</div>' +
      '<dl class="tl-figures">' +
        '<div><dt>Monthly<span class="kpi-tag">' + esc(state.cost_source || "modelled") + '</span></dt><dd>' + fmtEur(summary.monthly_eur) + '</dd>' +
          '<dd class="tl-sub' + deltaClass(summary.delta_eur) + '">' + (state.step === 0 ? "starting point" : fmtSigned(summary.delta_eur) + " this step") + '</dd></div>' +
        '<div><dt>Saved</dt><dd>' + (saved < 0 ? fmtSigned(saved) : fmtEur(saved)) + '</dd><dd class="tl-sub">against baseline</dd></div>' +
        '<div><dt>Resources</dt><dd>' + summary.components + '</dd><dd class="tl-sub">' + (summary.removed_total || 0) + ' removed so far</dd></div>' +
        '<div><dt>Availability</dt><dd>' + fmtPct(summary.availability_pct) + '</dd><dd class="tl-sub">' + esc(availability) + '</dd></div>' +
      '</dl>';
  }

  function updateTimeline() {
    var state = currentState();
    refs.tlSummary.innerHTML = summaryHtml(state);
    var view = refs.tlViewport.clientWidth;
    var total = states.length * TL_NODE_W;
    var anchor = Math.min(view * 0.28, 260);
    var offset = anchor - (stateIndex * TL_NODE_W + TL_NODE_W / 2);
    offset = Math.max(Math.min(0, offset), Math.min(0, view - total));
    refs.tlTrack.style.transform = "translateX(" + Math.round(offset) + "px)";
    Array.prototype.forEach.call(refs.tlTrack.querySelectorAll("[data-tl-node]"), function (el) {
      var distance = Number(el.getAttribute("data-tl-node")) - stateIndex;
      var place = distance < 0 ? "past" : distance === 0 ? "current" : distance <= TL_REVEAL ? "next" : "hidden";
      el.setAttribute("data-place", place);
      el.style.setProperty("--fade", distance > 0 ? Math.max(0.08, 1 - distance * 0.24).toFixed(2) : "1");
      var button = el.querySelector("button");
      if (distance === 0) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    Array.prototype.forEach.call(refs.timeline.querySelectorAll("[data-step]"), function (button) {
      var step = Number(button.getAttribute("data-step"));
      button.disabled = step < 0 ? stateIndex === 0 : stateIndex === states.length - 1;
    });
  }

  /* --------------------------------- detail ----------------------------- */

  function factsHtml(component) {
    var rows = [];
    rows.push(["Size", component.facts && component.facts[0] ? component.facts[0].value : "—"]);
    rows.push(["Monthly", fmtEur(component.monthlyEur) + "/mo list"]);
    rows.push(["Zone", { html: zoneChip(zoneOf(component)) }]);
    if (component.service) rows.push(["Service", component.service]);
    if (component.sku) rows.push(["SKU", component.sku]);
    if (component.quantity != null) rows.push(["Quantity", component.quantity]);
    return '<dl class="facts">' + rows.map(function (row) {
      return '<dt>' + esc(row[0]) + '</dt><dd>' + (row[1] && row[1].html ? row[1].html : esc(row[1])) + '</dd>';
    }).join("") + '</dl>';
  }

  function depsHtml(state, component) {
    var edges = state.infra.edges || [];
    var out = edges.filter(function (edge) { return edge.from === component.id; });
    var inbound = edges.filter(function (edge) { return edge.to === component.id; });
    var here = zoneOf(component);
    function list(items, other) {
      if (!items.length) return '<p class="dep-empty">None in this state.</p>';
      return '<ul class="dep-list">' + items.map(function (edge) {
        var id = edge[other];
        var peer = findComponent(state, id);
        var cross = peer && zoneOf(peer) !== here;
        var kind = (edge.kind || "link") + (cross ? " · in " + zoneShort(zoneOf(peer)) : "") +
          (edge.rehomedFrom ? " · was " + edge.rehomedFrom : "");
        return '<li><button type="button" class="dep-link' + (cross ? ' is-cross' : '') + '" data-dep="' + esc(id) + '">' +
          '<span class="dep-name">' + esc(id) + '</span><span class="dep-kind">' + esc(kind) + '</span>' +
        '</button></li>';
      }).join("") + '</ul>';
    }
    return '<div class="detail-section"><h3>Depends on</h3>' + list(out, "to") + '</div>' +
      '<div class="detail-section"><h3>Used by</h3>' + list(inbound, "from") + '</div>';
  }

  function renderDetail() {
    var state = currentState();
    var component = selectedId ? findComponent(state, selectedId) : null;
    if (!component) {
      if (selectedId) selectedId = null;
      refs.detail.hidden = true;
      refs.detail.innerHTML = "";
      refs.workspace.classList.remove("has-detail");
      return;
    }
    var change = changeFor(state, component.id);
    var security = component.securityIssue;
    var sub = '<span class="detail-type">' + esc(component.typeLabel) + '</span>' +
      '<span>' + esc(stackName(component.stack)) + '</span>' +
      '<span class="status-pill" data-status="' + esc(component.status) + '">' + esc(component.status) + '</span>' +
      (security ? '<span class="status-pill" data-status="issue">' + esc(security === "public" ? "public" : "unencrypted") + '</span>' : "");
    var changeHtml = "";
    if (change) {
      changeHtml = '<div class="change-card" data-kind="' + esc(change.kind) + '">' +
        '<span class="change-verb">' + esc(change.verb) + '</span>' +
        (change.reason ? '<p>' + esc(change.reason) + '</p>' : "") +
        (change.from && change.to ? '<p class="change-move">' + esc(change.from) + ' → ' + esc(change.to) + '</p>' : "") +
        (change.fromZone && change.toZone ? '<p class="change-zone">' + zoneChip(change.fromZone, 16) + ' → ' + zoneChip(change.toZone, 16) + '</p>' : "") +
        (change.into ? '<p class="change-zone">Joins ' + esc(change.into) + '</p>' : "") +
      '</div>';
    }
    var history = "";
    var trail = topo.trails.filter(function (t) { return t.kind === "move" && t.cid === component.id && t.at <= stateIndex; });
    var handed = topo.trails.filter(function (t) { return t.kind === "handoff" && t.into === component.id && t.at <= stateIndex; });
    if (trail.length || handed.length) {
      history = '<div class="detail-section"><h3>Where it came from</h3><ul class="history">' +
        trail.map(function (t) {
          return '<li>Step ' + t.at + ': moved from ' + zoneChip(topo.nodes[t.from].zone) + '</li>';
        }).join("") +
        handed.map(function (t) {
          return '<li>Step ' + t.at + ': took over ' + esc(t.cid) + (t.change.kind === "removed" ? ", which was deleted" : "") + '</li>';
        }).join("") +
      '</ul></div>';
    }
    refs.detail.innerHTML = '' +
      '<div class="detail-head">' +
        '<div><p class="detail-kicker">Resource</p><h2 class="detail-title">' + esc(component.id) + '</h2>' +
          '<div class="detail-sub">' + sub + '</div></div>' +
        '<button type="button" class="icon-btn" data-close aria-label="Close resource detail"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button>' +
      '</div>' +
      '<div class="detail-body">' +
        factsHtml(component) +
        (changeHtml ? '<div class="detail-section"><h3>This step</h3>' + changeHtml + '</div>' : "") +
        history +
        depsHtml(state, component) +
      '</div>';
    refs.detail.hidden = false;
    refs.workspace.classList.add("has-detail");
  }

  /* ------------------------------- topology ----------------------------- */

  /* A → B schematic. Every resource that ever exists is a node and every
     dependency that ever exists is a link. Each stack is a panel with three
     columns (entry, compute, data and storage). Links run orthogonally in the
     channels between columns, one lane per source, so they never cross a
     label. The SVG is built once per layout; stepping a state only flips
     data-status, which lets CSS animate a link snapping apart. */

  var T = {
    pad: 14, head: 40, row: 27, gap: [58, 96], gutter: 46, stackGap: 40, bandGap: 18,
    colW: [100, 172, 166], indent: 20, charW: 6.25, radius: 5, laneStep: 9,
    nameY: 19, ruleY: 28, chipH: 22, labelDx: 18, labelDy: 3.6, shapeDx: 7, shapeScale: 1, hostDy: 9,
    zoneHead: 34, zonePad: 12, zoneGap: 16, zoneNameY: 22
  };

  /* Card geometry: bigger type, fewer columns (entry nodes fold into the
     compute column, fed from a narrow lane on the panel's left edge). */
  if (CARD) {
    T.pad = 12; T.head = 48; T.gap = [24, 78]; T.gutter = 34; T.stackGap = 34; T.bandGap = 16;
    T.colW = [0, 220, 220]; T.indent = 26; T.radius = 7; T.laneStep = 11;
    T.nameY = 29; T.ruleY = 40; T.labelDx = 33; T.labelDy = 7.5; T.shapeDx = 11; T.shapeScale = 1.6; T.hostDy = 14;
    T.fontPx = 22; T.colCap = 250;
    T.zoneHead = 50; T.zonePad = 14; T.zoneGap = 18; T.zoneNameY = 33;
  }

  function computeGeometry() {
    T.colX = [T.pad, T.pad + T.colW[0] + T.gap[0], T.pad + T.colW[0] + T.gap[0] + T.colW[1] + T.gap[1]];
    T.stackW = T.colX[2] + T.colW[2] + T.gutter;
  }
  computeGeometry();

  var COL_BY_KIND = {
    load_balancer: 0, cdn: 0, dns: 0, nat: 0,
    kubernetes_cluster: 1, node_group: 1, virtual_machine: 1, container: 1, function: 1
  };
  var COMPUTE_ORDER = { kubernetes_cluster: 0, virtual_machine: 1, container: 2, function: 3 };
  var DATA_ORDER = { postgres: 0, nosql: 1, cache: 2, queue: 3, stream: 4, object_storage: 5, file_system: 6, block_storage: 7 };
  var COLUMN_NAMES = ["Entry", "Compute", "Data and storage"];

  function colOf(kind) {
    var col = COL_BY_KIND[kind] == null ? 2 : COL_BY_KIND[kind];
    return CARD && col === 0 ? 1 : col;
  }

  function isEntry(node) {
    return COL_BY_KIND[node.kind] === 0;
  }

  var measureCtx = null;
  function textWidth(text) {
    if (!CARD) return String(text).length * T.charW;
    if (!measureCtx) {
      measureCtx = document.createElement("canvas").getContext("2d");
      var family = getComputedStyle(document.documentElement).getPropertyValue("--font-display") || "sans-serif";
      measureCtx.font = "600 " + T.fontPx + "px " + family;
    }
    return measureCtx.measureText(String(text)).width;
  }

  function fitLabel(text, room) {
    if (textWidth(text) <= room) return text;
    var cut = text.length - 1;
    while (cut > 1 && textWidth(text.slice(0, cut) + "…") > room) cut -= 1;
    return text.slice(0, cut) + "…";
  }

  /* Zones are where a resource runs: one provider in one region (or one
     on-prem site). A resource that moves zone gets one node per zone it ever
     occupies, so the old spot can stay as an outline while the new one fills. */
  var ZONES = dataset.zones && dataset.zones.length ? dataset.zones : [{ id: "default", label: "Estate", provider: "", region: "" }];
  var ZONE_BY_ID = {};
  ZONES.forEach(function (zone) { ZONE_BY_ID[zone.id] = zone; });
  var HOME_ZONE = ZONES[0];
  function zoneOf(component) {
    return component.zone && ZONE_BY_ID[component.zone] ? component.zone : HOME_ZONE.id;
  }
  function zoneLabel(id) {
    return (ZONE_BY_ID[id] || { label: id }).label;
  }
  /* Short name for tags: the provider when it differs from home, else the region. */
  function zoneShort(id) {
    var zone = ZONE_BY_ID[id];
    if (!zone) return id;
    if (zone.provider === HOME_ZONE.provider) return zone.region;
    return zone.provider === "managed_pg" ? "Managed PG" : (zone.providerLabel || zone.provider);
  }

  var topo = (function buildTopology() {
    var nodes = {};
    var order = [];
    var alive = {};
    var stopped = {};
    var slotAt = {};
    var clusters = {};
    function slotId(component) { return component.id + "@" + zoneOf(component); }
    states.forEach(function (state) {
      state.infra.components.forEach(function (component) {
        var id = slotId(component);
        if (!nodes[id]) {
          nodes[id] = {
            id: id, cid: component.id, zone: zoneOf(component), kind: component.kind, stack: component.stack,
            typeLabel: component.typeLabel, col: colOf(component.kind), present: []
          };
          order.push(id);
        }
        nodes[id].present[state.index] = true;
        (alive[component.id] = alive[component.id] || [])[state.index] = true;
        (slotAt[component.id] = slotAt[component.id] || [])[state.index] = id;
        if (component.status === "stopped") (stopped[component.id] = stopped[component.id] || [])[state.index] = true;
        if (component.kind === "kubernetes_cluster") {
          (clusters[component.stack] = clusters[component.stack] || []).indexOf(component.id) < 0 && clusters[component.stack].push(component.id);
        }
      });
    });

    /* Node groups have no edges in the infra model; draw their cluster
       membership as an inferred "hosts" link so removing a pool cuts a line. */
    function hostOf(node) {
      var list = clusters[node.stack] || [];
      if (!list.length) return null;
      var tokens = node.cid.split("-");
      var best = list[0];
      list.forEach(function (cluster) {
        if (tokens.some(function (token) { return token.length > 3 && cluster.indexOf(token) >= 0 && best.indexOf(token) < 0; })) best = cluster;
      });
      return best;
    }
    order.forEach(function (id) {
      if (nodes[id].kind === "node_group") nodes[id].hostCid = hostOf(nodes[id]);
    });

    var links = {};
    function addLink(from, to, kind, inferred, index, rehomed) {
      var key = from + ">" + to;
      if (!links[key]) {
        links[key] = {
          key: key, from: from, to: to, fromCid: nodes[from].cid, toCid: nodes[to].cid, kind: kind,
          inferred: inferred, cross: nodes[from].zone !== nodes[to].zone, present: []
        };
      }
      links[key].present[index] = true;
      if (rehomed) links[key].rehomedFrom = rehomed;
    }
    states.forEach(function (state) {
      var at = state.index;
      (state.infra.edges || []).forEach(function (edge) {
        var from = slotAt[edge.from] && slotAt[edge.from][at];
        var to = slotAt[edge.to] && slotAt[edge.to][at];
        if (from && to) addLink(from, to, edge.kind, false, at, edge.rehomedFrom);
      });
      state.infra.components.forEach(function (component) {
        var node = nodes[slotId(component)];
        var host = node.hostCid && slotAt[node.hostCid] && slotAt[node.hostCid][at];
        if (host) addLink(host, node.id, "hosts", true, at);
      });
    });

    /* Trails: a move from one zone to another, or work handed to another
       resource when this one is deleted or folded into it. */
    var trails = [];
    var absorbed = {};
    states.forEach(function (state) {
      (state.changes || []).forEach(function (change) {
        var at = state.index;
        var before = slotAt[change.component] && slotAt[change.component][at - 1];
        if (change.fromZone && change.toZone && before) {
          trails.push({ kind: "move", cid: change.component, from: before, to: slotAt[change.component][at], at: at, change: change });
        }
        if (change.into && before && slotAt[change.into] && slotAt[change.into][at]) {
          trails.push({ kind: "handoff", cid: change.component, into: change.into, from: before, to: slotAt[change.into][at], at: at, change: change });
          if (change.kind === "removed") absorbed[change.component] = { into: change.into, at: at };
        }
      });
    });

    return {
      nodes: nodes,
      order: order,
      links: Object.keys(links).map(function (k) { return links[k]; }),
      trails: trails,
      alive: alive,
      stopped: stopped,
      slotAt: slotAt,
      absorbed: absorbed,
      stacks: states[0].infra.stacks,
      bands: [], zoneBoxes: [], columns: 0, width: 0, height: 0
    };
  })();

  function aliveAt(cid, index) {
    return !!(topo.alive[cid] && topo.alive[cid][index]);
  }

  function stoppedAt(cid, index) {
    return !!(topo.stopped[cid] && topo.stopped[cid][index]);
  }

  function chipWidth(node) {
    return CARD ? T.labelDx + textWidth(node.label) + 8 : 18 + node.label.length * T.charW;
  }

  function neighbours(node, col) {
    return topo.links.filter(function (link) {
      return !link.inferred && (link.from === node.id || link.to === node.id);
    }).map(function (link) {
      return topo.nodes[link.from === node.id ? link.to : link.from];
    }).filter(function (other) {
      return other.stack === node.stack && other.zone === node.zone && other.col === col;
    });
  }

  /* Rows inside one stack: compute is a tree (cluster, then its pools), entry and
     data nodes sit level with the compute nodes they talk to. */
  function bandMembers(zone, stack) {
    return topo.order.map(function (id) { return topo.nodes[id]; }).filter(function (node) {
      return node.stack === stack.id && node.zone === zone.id;
    });
  }

  function layoutBand(zone, stack) {
    var members = bandMembers(zone, stack);
    members.forEach(function (node) {
      var indent = node.kind === "node_group" ? T.indent : 0;
      if (CARD) {
        node.label = fitLabel(node.cid, T.colW[node.col] - indent - T.labelDx - 8);
        return;
      }
      var room = T.colW[node.col] - indent - 18;
      var max = Math.floor(room / T.charW);
      node.label = node.cid.length > max ? node.cid.slice(0, max - 1) + "…" : node.cid;
    });

    var compute = [];
    members.filter(function (node) { return node.col === 1 && node.kind !== "node_group" && !(CARD && isEntry(node)); })
      .sort(function (a, b) { return (COMPUTE_ORDER[a.kind] || 0) - (COMPUTE_ORDER[b.kind] || 0); })
      .forEach(function (node) {
        compute.push(node);
        members.forEach(function (pool) { if (pool.hostCid && pool.hostCid === node.cid) compute.push(pool); });
      });
    members.forEach(function (node) {
      if (node.col === 1 && compute.indexOf(node) < 0 && !(CARD && isEntry(node))) compute.push(node);
    });
    if (CARD) {
      /* Folded entry nodes sit just above the first compute node they feed. */
      members.filter(isEntry).forEach(function (entry) {
        var targets = neighbours(entry, 1).filter(function (other) { return !isEntry(other); });
        var at = targets.length ? Math.min.apply(null, targets.map(function (t) { return compute.indexOf(t); })) : 0;
        compute.splice(Math.max(0, at), 0, entry);
      });
    }
    compute.forEach(function (node, i) { node.row = i; });

    function placeBeside(col) {
      var list = members.filter(function (node) { return node.col === col; });
      list.forEach(function (node, i) {
        var rows = neighbours(node, 1).map(function (other) { return other.row; });
        node.want = rows.length ? rows.reduce(function (a, b) { return a + b; }, 0) / rows.length : Infinity;
        node.tie = (DATA_ORDER[node.kind] || 0) * 100 + i;
      });
      list.sort(function (a, b) { return a.want - b.want || a.tie - b.tie; });
      var next = 0;
      /* Card: never let alignment gaps make a panel taller than it must be. */
      var limit = CARD ? Math.max(compute.length, list.length) : Infinity;
      list.forEach(function (node, k) {
        var row = isFinite(node.want) ? Math.max(next, Math.round(node.want)) : next;
        node.row = Math.max(next, Math.min(row, limit - (list.length - k)));
        next = node.row + 1;
      });
      return next;
    }
    var rows = Math.max(1, compute.length, placeBeside(0), placeBeside(2));
    members.forEach(function (node) {
      node.lx = T.colX[node.col] + (node.kind === "node_group" ? T.indent : 0);
      node.ly = T.head + node.row * T.row + T.row / 2;
    });
    return { key: zone.id + "|" + stack.id, zone: zone, stack: stack, h: T.head + rows * T.row + 8 };
  }

  /* Each channel holds bundles (one per source); lanes are ordered to cross least. */
  function channelCrossings(bundles, pos, loop) {
    var count = 0;
    bundles.forEach(function (a, ia) {
      bundles.forEach(function (b, ib) {
        if (ia === ib) return;
        function inside(y) { return y > b.lo + 0.5 && y < b.hi - 0.5; }
        if (pos[ib] < pos[ia] && inside(a.sy)) count += 1;
        a.tys.forEach(function (y) {
          if ((loop ? pos[ib] < pos[ia] : pos[ib] > pos[ia]) && inside(y)) count += 1;
        });
      });
    });
    return count;
  }

  function orderLanes(channel) {
    var bundles = Object.keys(channel.bundles).map(function (key) { return channel.bundles[key]; });
    bundles.forEach(function (bundle) {
      var ys = bundle.tys.concat([bundle.sy]);
      bundle.lo = Math.min.apply(null, ys);
      bundle.hi = Math.max.apply(null, ys);
    });
    var n = bundles.length;
    var best = bundles.map(function (bundle, i) { return i; });
    best.sort(function (a, b) { return bundles[a].sy - bundles[b].sy; });
    if (n > 1 && n <= 7) {
      var bestScore = Infinity;
      var perm = [];
      var used = [];
      (function search(depth) {
        if (depth === n) {
          var pos = [];
          perm.forEach(function (bi, lane) { pos[bi] = lane; });
          var score = channelCrossings(bundles, pos, channel.loop);
          if (score < bestScore) { bestScore = score; best = perm.slice(); }
          return;
        }
        for (var i = 0; i < n; i += 1) {
          if (used[i]) continue;
          used[i] = true; perm.push(i);
          search(depth + 1);
          perm.pop(); used[i] = false;
        }
      })(0);
    }
    var span = Math.min(T.laneStep * (n - 1), channel.x1 - channel.x0);
    var start = (channel.x0 + channel.x1) / 2 - span / 2;
    best.forEach(function (bi, lane) {
      bundles[bi].x = n === 1 ? (channel.x0 + channel.x1) / 2 : start + lane * span / (n - 1);
    });
  }

  /* Zones are full-width strips, home first. Inside a strip the stack panels
     flow into columns; a stack keeps the column it has at home, so a resource
     that moves zone travels straight down its own column. */
  function layoutTopology(columns) {
    var colY = [];
    for (var c = 0; c < columns; c += 1) colY.push(0);
    var byKey = {};
    var homeCol = {};
    topo.bands = [];
    topo.zoneBoxes = [];
    function bottom() { return Math.max.apply(null, colY); }
    ZONES.forEach(function (zone) {
      var bands = topo.stacks.filter(function (stack) { return bandMembers(zone, stack).length; })
        .map(function (stack) { return layoutBand(zone, stack); });
      if (!bands.length) return;
      var top = topo.zoneBoxes.length ? bottom() + T.zoneGap : 0;
      for (var k = 0; k < columns; k += 1) colY[k] = top + T.zoneHead;
      var assign = CARD && columns === 2 && !topo.zoneBoxes.length ? balancedColumns(bands) : null;
      bands.forEach(function (band, bi) {
        var col = assign ? assign[bi]
          : homeCol[band.stack.id] != null && homeCol[band.stack.id] < columns ? homeCol[band.stack.id]
          : colY.indexOf(Math.min.apply(null, colY));
        if (homeCol[band.stack.id] == null) homeCol[band.stack.id] = col;
        band.gc = col;
        band.x = T.zonePad + col * (T.stackW + T.stackGap);
        band.y = colY[col];
        colY[col] += band.h + T.bandGap;
        byKey[band.key] = band;
        topo.bands.push(band);
      });
      var end = bottom() - T.bandGap + T.zonePad;
      for (var j = 0; j < columns; j += 1) colY[j] = end;
      topo.zoneBoxes.push({ zone: zone, y: top, h: end - top });
    });
    topo.order.forEach(function (id) {
      var node = topo.nodes[id];
      node.band = byKey[node.zone + "|" + node.stack];
      node.x = node.band.x + node.lx;
      node.y = node.band.y + node.ly;
      node.w = chipWidth(node);
    });
    topo.columns = columns;
    topo.width = columns * T.stackW + (columns - 1) * T.stackGap + T.zonePad * 2;
    topo.height = bottom();
    routeLinks();
    routeTrails();
  }

  /* Card: split the panels over two columns so the taller column is as short
     as possible (stack order is kept inside each column). */
  function balancedColumns(bands) {
    var n = bands.length;
    var best = null, bestH = Infinity;
    for (var mask = 0; mask < (1 << n); mask += 1) {
      if (n > 1 && (mask & 1)) continue;
      var h = [0, 0];
      for (var i = 0; i < n; i += 1) {
        var c = (mask >> i) & 1;
        h[c] += bands[i].h + (h[c] ? T.bandGap : 0);
      }
      var top = Math.max(h[0], h[1]);
      if (top < bestH - 0.5) { bestH = top; best = mask; }
    }
    return bands.map(function (band, i) { return (best >> i) & 1; });
  }

  function routeLinks() {
    var channels = {};
    function channel(id, x0, x1, loop) {
      if (!channels[id]) channels[id] = { x0: x0, x1: x1, loop: !!loop, bundles: {} };
      return channels[id];
    }
    function gapChannel(band, col) {
      var x0 = band.x + T.colX[col] + T.colW[col] + 4;
      var x1 = col < 2 ? band.x + T.colX[col + 1] - 8 : band.x + T.stackW - 8;
      return channel(band.stack.id + ":" + col, x0, x1, false);
    }
    function bundle(ch, key, sy) {
      if (!ch.bundles[key]) ch.bundles[key] = { sy: sy, tys: [] };
      return ch.bundles[key];
    }
    function right(node) { return [node.x + node.w + 3, node.y]; }
    function left(node) { return [node.x - 3, node.y]; }
    function ownLeft(node) { return [node.band.x + T.colX[node.col] - 3, node.y]; }

    topo.links.forEach(function (link) {
      var a = topo.nodes[link.from];
      var b = topo.nodes[link.to];
      link.route = null;
      if (link.inferred && a.band === b.band) {
        var gx = a.x + T.shapeDx;
        link.route = function () { return [[gx, a.y + T.hostDy], [gx, b.y], [b.x - 2, b.y]]; };
        return;
      }
      if (a.band === b.band) {
        if (CARD && a.col === b.col && a.col === 1) {
          /* Entry folded into compute: loop through the panel's left lane. */
          var leftCh = gapChannel(a.band, 0);
          leftCh.loop = true;
          var eb0 = bundle(leftCh, "loop:" + a.id, a.y);
          eb0.tys.push(b.y);
          link.route = function () { return [ownLeft(a), [eb0.x, a.y], [eb0.x, b.y], ownLeft(b)]; };
          return;
        }
        if (a.col === b.col) {
          var loopCh = gapChannel(a.band, a.col);
          loopCh.loop = true;
          var lb = bundle(loopCh, "loop:" + a.id, a.y);
          lb.tys.push(b.y);
          link.route = function () { return [right(a), [lb.x, a.y], [lb.x, b.y], right(b)]; };
          return;
        }
        var lo = a.col < b.col ? a : b;
        var hi = lo === a ? b : a;
        var gb = bundle(gapChannel(a.band, hi.col - 1), lo.id, lo.y);
        gb.tys.push(hi.y);
        link.route = function () { return [right(lo), [gb.x, lo.y], [gb.x, hi.y], left(hi)]; };
        return;
      }
      /* Across stacks: out through the corridor between panels, along the
         target panel's header gap, then down its channel into the node. */
      var L = a.band.x <= b.band.x ? a : b;
      var R = L === a ? b : a;
      if (L.band.gc === R.band.gc && a.col !== b.col) {
        /* Same column, different zones or stacks: run down the gap between the
           two columns (its right edge, clear of the panels' own lanes), so the
           link never crosses a label on its way. */
        var lo2 = a.col < b.col ? a : b;
        var hi2 = lo2 === a ? b : a;
        var gx1 = lo2.band.x + T.colX[hi2.col] - 8;
        var down = channel("down:" + lo2.band.gc + ":" + hi2.col, gx1 - 16, gx1, false);
        var db = bundle(down, lo2.id, lo2.y);
        db.tys.push(hi2.y);
        link.route = function () { return [right(lo2), [db.x, lo2.y], [db.x, hi2.y], left(hi2)]; };
        return;
      }
      if (L.band.gc === R.band.gc) {
        var side = channel("edge:" + L.band.gc, L.band.x + T.stackW - 6, L.band.x + T.stackW + T.stackGap / 2, false);
        var sb = bundle(side, "x:" + link.key, L.y);
        sb.tys.push(R.y);
        link.route = function () { return [right(L), [sb.x, L.y], [sb.x, R.y], right(R)]; };
        return;
      }
      var corridorX = L.band.x + T.stackW;
      var corridor = channel("corridor:" + L.band.gc, corridorX + 6, corridorX + T.stackGap - 6, false);
      var headY = R.band.y + T.ruleY + 6;
      var cb = bundle(corridor, L.id, L.y);
      cb.tys.push(headY);
      var entry = R.col === 0
        ? channel(R.band.stack.id + ":in", R.band.x + 3, R.band.x + T.pad - 3, false)
        : gapChannel(R.band, R.col - 1);
      var eb = bundle(entry, "x:" + link.key, headY);
      eb.tys.push(R.y);
      link.route = function () { return [right(L), [cb.x, L.y], [cb.x, headY], [eb.x, headY], [eb.x, R.y], left(R)]; };
    });

    Object.keys(channels).forEach(function (id) { orderLanes(channels[id]); });
    topo.links.forEach(function (link) { link.points = cleanPoints(link.route()); });
  }

  function cleanPoints(points) {
    var out = [];
    points.forEach(function (p) {
      var prev = out[out.length - 1];
      if (prev && Math.abs(prev[0] - p[0]) < 0.5 && Math.abs(prev[1] - p[1]) < 0.5) return;
      out.push(p);
    });
    for (var i = out.length - 2; i > 0; i -= 1) {
      var a = out[i - 1], b = out[i], c = out[i + 1];
      if ((Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5)) out.splice(i, 1);
    }
    return out;
  }

  function roundedPath(points) {
    var d = "M" + points[0][0].toFixed(1) + " " + points[0][1].toFixed(1);
    for (var i = 1; i < points.length - 1; i += 1) {
      var p = points[i], prev = points[i - 1], next = points[i + 1];
      var inLen = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      var outLen = Math.hypot(next[0] - p[0], next[1] - p[1]);
      var r = Math.min(T.radius, inLen / 2, outLen / 2);
      var ax = p[0] - (p[0] - prev[0]) / inLen * r, ay = p[1] - (p[1] - prev[1]) / inLen * r;
      var bx = p[0] + (next[0] - p[0]) / outLen * r, by = p[1] + (next[1] - p[1]) / outLen * r;
      d += "L" + ax.toFixed(1) + " " + ay.toFixed(1) + "Q" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " " + bx.toFixed(1) + " " + by.toFixed(1);
    }
    var last = points[points.length - 1];
    return d + "L" + last[0].toFixed(1) + " " + last[1].toFixed(1);
  }

  /* Both ends still run somewhere (or the missing one handed its work on):
     the dependency was re-homed, not cut. */
  function linkSurvives(link, index) {
    function ok(cid) {
      var gone = topo.absorbed[cid];
      return aliveAt(cid, index) || (gone && gone.at <= index);
    }
    return ok(link.fromCid) && ok(link.toCid);
  }

  function linkStatus(link, index) {
    var now = !!link.present[index];
    var before = index > 0 && !!link.present[index - 1];
    if (now) {
      if (stoppedAt(link.fromCid, index) || stoppedAt(link.toCid, index)) return "paused";
      return index > 0 && !before ? "forming" : "live";
    }
    var survives = linkSurvives(link, index);
    if (before) return survives ? "rerouting" : "breaking";
    for (var i = 0; i < index; i += 1) if (link.present[i]) return survives ? "rerouted" : "broken";
    return "future";
  }

  function nodeStatus(node, index) {
    if (node.present[index]) {
      if (stoppedAt(node.cid, index)) return "stopped";
      if (index > 0 && !node.present[index - 1] && aliveAt(node.cid, index - 1)) return "arriving";
      return "live";
    }
    var earlier = node.present.slice(0, index).some(Boolean);
    if (aliveAt(node.cid, index)) {
      if (index > 0 && node.present[index - 1]) return "leaving";
      return earlier ? "moved-out" : "pending";
    }
    if (index > 0 && node.present[index - 1]) return "removing";
    return earlier ? "removed" : "future";
  }

  /* The short tag after a label says where a resource went, or that it waits. */
  /* Name the other zone by what differs: the provider, else the region. */
  function zoneVersus(other, here) {
    var a = ZONE_BY_ID[other], b = ZONE_BY_ID[here];
    if (a && b && a.provider !== b.provider) return a.provider === "managed_pg" ? "Managed PG" : (a.providerLabel || a.provider);
    return a ? a.region : other;
  }

  function nodeTag(node, status, index) {
    if (status === "stopped") return "stopped";
    if (status === "leaving" || status === "moved-out") {
      var now = topo.slotAt[node.cid][index];
      return "→ " + zoneVersus(topo.nodes[now].zone, node.zone);
    }
    if (status === "pending") return "arrives later";
    if (status === "removing" || status === "removed") {
      var gone = topo.absorbed[node.cid];
      return gone ? "→ " + gone.into : "";
    }
    if (status === "arriving") {
      var from = topo.slotAt[node.cid][index - 1];
      return "from " + zoneVersus(topo.nodes[from].zone, node.zone);
    }
    return "";
  }

  /* Split at the middle of the last segment: that branch belongs to this link
     alone, so the snap reads even where bundles share a trunk. */
  function linkAttrs(link) {
    return ' data-link="' + esc(link.key) + '" data-kind="' + esc(link.kind) + '"' +
      (link.inferred ? ' data-inferred="true"' : '') + (link.cross ? ' data-cross="true"' : '');
  }

  function linkSvg(link) {
    if (CARD) {
      return '<g class="tlink"' + linkAttrs(link) + '>' +
        '<path class="tlink-path" d="' + roundedPath(link.points) + '"></path></g>';
    }
    var pts = link.points;
    var n = pts.length;
    var a = pts[n - 2], b = pts[n - 1];
    var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    var first = pts.slice(0, n - 1).concat([m]);
    var second = [b, m];
    var vertical = Math.abs(a[0] - b[0]) < 0.5;
    var title = link.fromCid + " → " + link.toCid + " (" + link.kind + (link.inferred ? ", inferred" : "") +
      (link.cross ? ", crosses " + zoneShort(topo.nodes[link.from].zone) + " → " + zoneShort(topo.nodes[link.to].zone) + ": egress and latency" : "") +
      (link.rehomedFrom ? ", re-homed from " + link.rehomedFrom : "") + ")";
    return '<g class="tlink"' + linkAttrs(link) + '>' +
      '<title>' + esc(title) + '</title>' +
      '<path class="tlink-half" pathLength="1" d="' + roundedPath(first) + '"></path>' +
      '<path class="tlink-half" pathLength="1" d="' + roundedPath(second) + '"></path>' +
      '<path class="tlink-snap" transform="translate(' + m[0].toFixed(1) + ' ' + m[1].toFixed(1) + ')' + (vertical ? ' rotate(90)' : '') + '" d="M-4 -5l3 5-3 5M4 -5l-3 5 3 5"></path>' +
    '</g>';
  }

  function nodeShape(node) {
    if (T.shapeScale !== 1) {
      var cx = node.x + T.shapeDx;
      var inner = baseShape(node, cx, node.y);
      return '<g transform="translate(' + cx.toFixed(1) + ' ' + node.y.toFixed(1) + ') scale(' + T.shapeScale + ') translate(' +
        (-cx).toFixed(1) + ' ' + (-node.y).toFixed(1) + ')">' + inner + '</g>';
    }
    return baseShape(node, node.x + 7, node.y);
  }

  function baseShape(node, x, y) {
    if (node.kind === "kubernetes_cluster") {
      var pts = [];
      for (var i = 0; i < 6; i += 1) {
        var ang = Math.PI / 6 + i * Math.PI / 3;
        pts.push((x + 8 * Math.cos(ang)).toFixed(1) + "," + (y + 8 * Math.sin(ang)).toFixed(1));
      }
      return '<polygon class="tnode-shape" points="' + pts.join(" ") + '"></polygon>' +
        '<circle class="tnode-core" cx="' + x + '" cy="' + y + '" r="2.5"></circle>';
    }
    if (node.kind === "node_group") {
      return '<rect class="tnode-shape" x="' + (x - 6) + '" y="' + (y - 6) + '" width="12" height="12"></rect>' +
        '<path class="tnode-core-line" d="M' + (x - 3) + ' ' + (y - 2.5) + 'h6M' + (x - 3) + ' ' + y + 'h6M' + (x - 3) + ' ' + (y + 2.5) + 'h6"></path>';
    }
    if (node.col === 2 && DATA_ORDER[node.kind] <= 2) {
      return '<ellipse class="tnode-shape" cx="' + x + '" cy="' + y + '" rx="6.5" ry="6.5"></ellipse>' +
        '<path class="tnode-core-line" d="M' + (x - 6.5) + ' ' + (y - 1.5) + 'q6.5 3.5 13 0"></path>';
    }
    if (node.col === 2) {
      return '<rect class="tnode-shape" x="' + (x - 6) + '" y="' + (y - 5) + '" width="12" height="10"></rect>';
    }
    return '<circle class="tnode-shape" cx="' + x + '" cy="' + y + '" r="5.5"></circle>';
  }

  function nodeSvg(node) {
    var provider = (ZONE_BY_ID[node.zone] || {}).provider || "";
    var foreign = provider !== HOME_ZONE.provider;
    var pillSize = CARD ? 20 : 11;
    var pill = foreign ? providerIcon(provider, pillSize) : "";
    var tagX = node.x + node.w + 2 + (pill ? pillSize + 3 : 0);
    return '<g class="tnode" data-node="' + esc(node.id) + '" data-kind="' + esc(node.kind) + '" data-res="' + esc(node.cid) + '" data-provider="' + esc(provider) + '"' +
      (foreign ? ' data-foreign="true"' : '') + '>' +
      '<title>' + esc(node.cid + ", " + node.typeLabel + ", " + zoneLabel(node.zone)) + '</title>' +
      '<rect class="tnode-hit" x="' + (node.x - 4) + '" y="' + (node.y - T.chipH / 2) + '" width="' + (node.w + 8) + '" height="' + T.chipH + '"></rect>' +
      nodeShape(node) +
      '<text class="tnode-label" x="' + (node.x + T.labelDx) + '" y="' + (node.y + T.labelDy) + '">' + esc(node.label) + '</text>' +
      (pill ? '<g class="tnode-pill" transform="translate(' + (node.x + node.w + 1).toFixed(1) + ' ' + (node.y - pillSize / 2).toFixed(1) + ')">' + pill + '</g>' : '') +
      (CARD ? '' : '<text class="tnode-tag" x="' + tagX.toFixed(1) + '" y="' + (node.y + T.labelDy) + '"></text>') +
    '</g>';
  }

  /* A trail is a curve from the old spot to the new one, bowed left of both so
     it clears the labels; a dot runs along it when the step happens. */
  function routeTrails() {
    topo.trails.forEach(function (trail) {
      var a = topo.nodes[trail.from], b = topo.nodes[trail.to];
      var ax = a.x + T.shapeDx, bx = b.x + T.shapeDx;
      var bow = Math.max(34, Math.abs(b.y - a.y) * 0.18) + Math.abs(bx - ax) * 0.1;
      var cx = Math.min(ax, bx) - bow;
      var r = 9 * T.shapeScale;
      var sy = a.y + (b.y > a.y ? r : -r), ey = b.y + (b.y > a.y ? -r : r);
      trail.d = "M" + ax.toFixed(1) + " " + sy.toFixed(1) +
        "C" + cx.toFixed(1) + " " + sy.toFixed(1) + " " + cx.toFixed(1) + " " + ey.toFixed(1) + " " + bx.toFixed(1) + " " + ey.toFixed(1);
    });
  }

  function trailSvg(trail, i) {
    var title = trail.kind === "move"
      ? trail.cid + " moves " + zoneLabel(topo.nodes[trail.from].zone) + " → " + zoneLabel(topo.nodes[trail.to].zone)
      : trail.cid + " hands its work to " + trail.into;
    return '<g class="ttrail" data-trail="' + i + '" data-kind="' + trail.kind + '"><title>' + esc(title) + '</title>' +
      '<path class="ttrail-halo" d="' + trail.d + '"></path>' +
      '<path class="ttrail-path" pathLength="1" d="' + trail.d + '" marker-end="url(#tarrow-' + trail.kind + ')"></path>' +
      (CARD ? '' : '<circle class="ttrail-dot" r="4"><animateMotion dur="1100ms" begin="indefinite" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".5 0 .2 1" path="' + trail.d + '"></animateMotion></circle>') +
    '</g>';
  }

  /* Provider logos come from providers.js (window.providerIcon) when it is in
     the page; without it a monogram in the provider's colour stands in. */
  function providerIcon(provider, size) {
    if (typeof window.providerIcon !== "function") return "";
    try {
      return window.providerIcon(provider || "other", size, {}) || "";
    } catch (err) {
      return "";
    }
  }

  function zoneChip(id, size) {
    var zone = ZONE_BY_ID[id] || { label: id, provider: "other" };
    var icon = providerIcon(zone.provider, size || 14);
    return '<span class="zone-chip" data-provider="' + esc(zone.provider) + '">' +
      (icon ? '<span class="zone-chip-icon" aria-hidden="true">' + icon + '</span>' : '<i aria-hidden="true"></i>') +
      esc(zone.label) + '</span>';
  }

  var PROVIDER_MARK = { aws: "AWS", gcp: "GCP", azure: "AZ", onprem: "DC", managed_pg: "PG", other: "•" };

  function zoneSvg(box) {
    var zone = box.zone;
    var home = zone.id === HOME_ZONE.id;
    var mark = PROVIDER_MARK[zone.provider] || String(zone.provider || "?").slice(0, 3).toUpperCase();
    var scale = CARD ? 1.5 : 1;
    var logoSize = Math.round(20 * scale);
    var logo = providerIcon(zone.provider, logoSize);
    var bw = logo ? logoSize : (10 + mark.length * 6.4) * scale, bh = 15 * scale;
    var by = box.y + T.zoneNameY - 11 * scale;
    var badge = logo
      ? '<g class="tzone-logo" transform="translate(' + T.zonePad + ' ' + (box.y + T.zoneNameY - logoSize * 0.72).toFixed(1) + ')">' + logo + '</g>'
      : '<rect class="tzone-mark" x="' + T.zonePad + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh + '" rx="' + (3 * scale) + '"></rect>' +
        '<text class="tzone-mark-text" x="' + (T.zonePad + bw / 2).toFixed(1) + '" y="' + (by + bh / 2 + 3.4 * scale).toFixed(1) + '" text-anchor="middle">' + esc(mark) + '</text>';
    return '<g class="tzone" data-zone="' + esc(zone.id) + '" data-provider="' + esc(zone.provider) + '"' + (home ? ' data-home="true"' : '') + '>' +
      '<rect class="tzone-frame" x="0" y="' + box.y + '" width="' + topo.width + '" height="' + box.h + '" rx="6"></rect>' +
      badge +
      '<text class="tzone-name" x="' + (T.zonePad + bw + 7 * scale).toFixed(1) + '" y="' + (box.y + T.zoneNameY) + '">' + esc(zone.label) + '</text>' +
      (CARD ? '' : '<text class="tzone-note" x="' + (topo.width - T.zonePad) + '" y="' + (box.y + T.zoneNameY) + '" text-anchor="end"></text>') +
    '</g>';
  }

  function topologySvg() {
    var bands = topo.bands.map(function (band) {
      var captions = CARD ? "" : COLUMN_NAMES.map(function (name, col) {
        return col === 0 ? "" : '<text class="tband-col" x="' + (band.x + T.colX[col]) + '" y="' + (band.y + 21) + '">' + esc(name) + '</text>';
      }).join("");
      var env = CARD ? "" : '<text class="tband-env" x="' + (band.x + T.stackW - T.pad) + '" y="' + (band.y + T.nameY) + '" text-anchor="end">' + esc(band.stack.environment || "") + '</text>';
      return '<g class="tband">' +
        '<rect x="' + band.x + '" y="' + band.y + '" width="' + T.stackW + '" height="' + band.h + '"></rect>' +
        '<path class="tband-rule" d="M' + band.x + ' ' + (band.y + T.ruleY) + 'h' + T.stackW + '"></path>' +
        '<text class="tband-name" x="' + (band.x + T.pad) + '" y="' + (band.y + T.nameY) + '">' + esc(band.stack.name) + '</text>' +
        captions + env +
      '</g>';
    }).join("");
    var zones = topo.zoneBoxes.map(zoneSvg).join("");
    var links = topo.links.map(linkSvg).join("");
    var nodes = topo.order.map(function (id) { return nodeSvg(topo.nodes[id]); }).join("");
    var trails = topo.trails.map(trailSvg).join("");
    var markers = ["move", "handoff"].map(function (kind) {
      return '<marker id="tarrow-' + kind + '" class="tarrow" data-kind="' + kind + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">' +
        '<path d="M1 1L9 5L1 9z"></path></marker>';
    }).join("");
    var pad = 4;
    return '<svg class="topo-graph" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (topo.width + pad * 2) + ' ' + (topo.height + pad * 2) + '"' +
        ' preserveAspectRatio="xMidYMin meet" role="img" aria-label="Estate topology by zone">' +
        '<defs>' + markers + '</defs>' +
        '<g class="tzones">' + zones + '</g>' + bands + '<g class="tlinks">' + links + '</g><g class="tnodes">' + nodes + '</g>' +
        '<g class="ttrails">' + trails + '</g>' +
      '</svg>';
  }

  function topologyColumns() {
    var width = refs.topoCanvas ? refs.topoCanvas.clientWidth : window.innerWidth;
    return width >= 900 ? 2 : 1;
  }

  /* Grow row spacing until the schematic fills the canvas height. */
  function renderTopologyCanvas() {
    var columns = topologyColumns();
    var box = refs.topoCanvas.getBoundingClientRect();
    var fit = columns > 1 && box.height > 0;
    for (var row = fit ? 40 : 27; row >= 27; row -= 1) {
      T.row = row;
      layoutTopology(columns);
      if (!fit || (topo.height + 8) * box.width / (topo.width + 8) <= box.height - 12) break;
    }
    topo.box = box.width + "x" + box.height;
    refs.topoCanvas.innerHTML = topologySvg();
    updateTopology();
  }

  function topologyHtml() {
    return '' +
      '<div class="topo-head">' +
        '<h2>Topology</h2>' +
        '<p class="topo-readout" data-topo-readout></p>' +
        '<div class="topo-ends" role="group" aria-label="Jump to an end state">' +
          '<button type="button" data-topo-jump="0">A<span>current</span></button>' +
          '<button type="button" data-topo-play aria-label="Play the migration from A to B">' +
            '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 1.5v7l6-3.5z"/></svg></button>' +
          '<button type="button" data-topo-jump="' + (states.length - 1) + '">B<span>target</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="topo-canvas" data-topo-canvas></div>' +
      '<div class="topo-foot">' +
        '<ul class="topo-legend">' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><path class="lg-live" d="M1 4h26"/></svg>Dependency</li>' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><path class="lg-host" d="M1 4h26"/></svg>Cluster runs pool (inferred)</li>' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><path class="lg-cross" d="M1 4h26"/></svg>Crosses zones: egress and latency</li>' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><path class="lg-move" d="M1 4h22"/><path class="lg-move-head" d="M22 1l5 3-5 3z"/></svg>Moves to another zone</li>' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><path class="lg-handoff" d="M1 4h22"/><path class="lg-handoff-head" d="M22 1l5 3-5 3z"/></svg>Work handed to another resource</li>' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><path class="lg-broken" d="M1 4h9M18 4h9"/></svg>Cut when a resource is removed</li>' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><circle class="lg-ghost" cx="14" cy="4" r="3"/></svg>Removed, or the spot a resource left</li>' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><path class="lg-paused" d="M1 4h26"/></svg>Stopped: links paused</li>' +
        '</ul>' +
        '<p class="footnote">' + (dataset.source && dataset.source.sample ? 'Sample plan. ' : '') + 'Costs between A and B are modelled from action savings; availability is measured at A and estimated at B.</p>' +
      '</div>';
  }

  /* What a zone holds at this state, and when it fills or empties. */
  function zoneNote(zoneId, index) {
    var live = 0, arriving = [], leaving = [];
    topo.order.forEach(function (id) {
      var node = topo.nodes[id];
      if (node.zone !== zoneId) return;
      var status = nodeStatus(node, index);
      if (node.present[index]) live += 1;
      if (status === "arriving") arriving.push(node.cid);
      if (status === "leaving") leaving.push(node.cid);
    });
    var note = live + (live === 1 ? " resource" : " resources");
    if (!live) {
      var next = -1, last = -1;
      topo.order.forEach(function (id) {
        var node = topo.nodes[id];
        if (node.zone !== zoneId) return;
        node.present.forEach(function (on, i) {
          if (!on) return;
          if (i > index && (next < 0 || i < next)) next = i;
          if (i < index) last = Math.max(last, i);
        });
      });
      note = next > 0 ? "empty · first move lands at step " + next : last >= 0 ? "empty since step " + (last + 1) : "empty";
    }
    if (arriving.length) note += " · " + arriving.join(", ") + " arrived";
    if (leaving.length) note += " · " + leaving.join(", ") + " left";
    return { text: note, live: live, arriving: arriving.length > 0, leaving: leaving.length > 0 };
  }

  function updateTopology() {
    if (!refs.topoCanvas || !refs.topoCanvas.firstChild) return;
    var index = stateIndex;
    var state = currentState();
    var focus = selectedId;
    var cutNow = [];
    var counts = { live: 0, broken: 0, cross: 0 };
    var related = {};
    Array.prototype.forEach.call(refs.topo.querySelectorAll(".tlink"), function (el, i) {
      var link = topo.links[i];
      var status = linkStatus(link, index);
      el.setAttribute("data-status", status);
      if (status === "live" || status === "forming" || status === "paused") {
        counts.live += 1;
        if (link.cross) counts.cross += 1;
      }
      if (status === "broken" || status === "breaking") counts.broken += 1;
      if (status === "breaking") cutNow.push(link);
      var touches = focus && (link.fromCid === focus || link.toCid === focus);
      el.classList.toggle("is-focus", !!touches);
      if (touches) { related[link.fromCid] = true; related[link.toCid] = true; }
    });
    Array.prototype.forEach.call(refs.topo.querySelectorAll(".ttrail"), function (el, i) {
      var trail = topo.trails[i];
      var mine = focus && (trail.cid === focus || trail.into === focus);
      var status = trail.at === index ? "active" : mine && trail.at <= index ? "trace" : "hidden";
      if (mine) { related[trail.cid] = true; if (trail.into) related[trail.into] = true; }
      var was = el.getAttribute("data-status");
      el.setAttribute("data-status", status);
      if (status === "active" && was !== "active" && !reducedMotion()) {
        var motion = el.querySelector("animateMotion");
        if (motion && motion.beginElement) {
          el.setAttribute("data-run", "true");
          motion.beginElement();
          window.setTimeout(function () { el.removeAttribute("data-run"); }, 1300);
        }
      }
    });
    Array.prototype.forEach.call(refs.topo.querySelectorAll(".tnode"), function (el) {
      var node = topo.nodes[el.getAttribute("data-node")];
      var change = node.present[index] ? changeFor(state, node.cid) : null;
      var status = nodeStatus(node, index);
      el.setAttribute("data-status", status);
      if (change && change.kind !== "removed") el.setAttribute("data-change", change.kind);
      else el.removeAttribute("data-change");
      var tag = el.querySelector(".tnode-tag");
      if (tag) tag.textContent = nodeTag(node, status, index);
      el.classList.toggle("is-selected", node.cid === focus);
      el.classList.toggle("is-other", !!focus && !related[node.cid] && node.cid !== focus);
      el.classList.toggle("is-rehearsal-failed", !!settings.failedComponent && node.cid === settings.failedComponent && !!node.present[index] && index === states.length - 1);
    });
    Array.prototype.forEach.call(refs.topo.querySelectorAll(".tzone"), function (el) {
      var note = zoneNote(el.getAttribute("data-zone"), index);
      el.setAttribute("data-empty", note.live ? "false" : "true");
      el.setAttribute("data-flow", note.arriving ? "in" : note.leaving ? "out" : "none");
      var text = el.querySelector(".tzone-note");
      if (text) text.textContent = note.text;
    });
    refs.topo.querySelector(".topo-graph").classList.toggle("has-focus", !!focus);
    var readout = '<span class="tr-pos">' + (index === 0 ? "A" : index === states.length - 1 ? "B" : "Step " + pad2(state.step)) + '</span>' +
      '<span>' + counts.live + ' links live</span>' +
      '<span class="' + (counts.cross ? "tr-cross" : "") + '">' + counts.cross + ' cross zones</span>' +
      '<span class="' + (counts.broken ? "tr-cut" : "") + '">' + counts.broken + ' cut</span>';
    var change = index > 0 ? (state.changes || [])[0] : null;
    if (change && change.fromZone && change.toZone) {
      readout += '<span class="tr-move">Moved ' + esc(change.component) + ' ' + zoneChip(change.fromZone) + ' → ' + zoneChip(change.toZone) + '</span>';
    } else if (change && change.kind === "moved") {
      readout += '<span class="tr-move">Service swapped in place: ' + esc(change.component) + ', same zone</span>';
    }
    if (change && change.into) {
      readout += '<span class="tr-handoff">' + esc(change.component) + (change.kind === "removed" ? "’s work → " : " joins ") + esc(change.into) + '</span>';
    }
    if (change && change.kind === "stopped") {
      readout += '<span class="tr-stop">Stopped ' + esc(change.component) + ': links paused until the delete is confirmed</span>';
    }
    if (cutNow.length) {
      readout += '<span class="tr-now">Cut this step: ' + cutNow.map(function (link) {
        return esc(link.fromCid) + ' → ' + esc(link.toCid);
      }).join(", ") + '</span>';
    }
    refs.topoReadout.innerHTML = readout;
    var play = refs.topo.querySelector("[data-topo-play]");
    play.setAttribute("aria-pressed", playTimer ? "true" : "false");
    play.innerHTML = playTimer
      ? '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 1.5h2v7h-2zM5.5 1.5h2v7h-2z"/></svg>'
      : '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 1.5v7l6-3.5z"/></svg>';
  }

  var playTimer = 0;

  function togglePlay() {
    if (playTimer) {
      stopPlay();
      return;
    }
    if (stateIndex >= states.length - 1) setState(0);
    playTimer = window.setInterval(function () {
      if (stateIndex >= states.length - 1) {
        stopPlay();
        return;
      }
      setState(stateIndex + 1);
    }, reducedMotion() ? 1400 : 900);
    updateTopology();
  }

  function stopPlay() {
    if (playTimer) window.clearInterval(playTimer);
    playTimer = 0;
    updateTopology();
  }

  /* ------------------------------- actions ------------------------------ */

  function setState(index, options) {
    var opts = options || {};
    index = Math.max(0, Math.min(states.length - 1, Number(index) || 0));
    if (index === stateIndex && !opts.force) return;
    stateIndex = index;
    if (selectedId && !findComponent(currentState(), selectedId)) selectedId = null;
    var state = currentState();
    refs.live.textContent = (state.step === 0 ? "Current estate" : "State " + state.step + " of " + stepCount) +
      ", " + state.shortLabel + ", monthly " + fmtEur(state.summary.monthly_eur) + ".";
    updateTimeline();
    renderDetail();
    updateTopology();
  }

  function stepState(delta) {
    setState(stateIndex + delta);
  }

  function selectComponent(id) {
    selectedId = selectedId === id ? null : id;
    renderDetail();
    updateTopology();
  }

  function clearSelection() {
    if (!selectedId) return;
    selectedId = null;
    renderDetail();
    updateTopology();
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }


  /* --------------------------------- bind ------------------------------- */

  function bind() {
    app.addEventListener("click", onClick);
    app.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", onResize);
  }

  function onClick(event) {
      var target = event.target.closest("[data-state-index],[data-step],[data-res],[data-dep],[data-close],[data-topo-jump],[data-topo-play]");
      if (!target) return;
      if (target.hasAttribute("data-topo-play")) {
        togglePlay();
        return;
      }
      stopPlay();
      if (target.hasAttribute("data-topo-jump")) {
        setState(Number(target.getAttribute("data-topo-jump")), { force: true });
      } else if (target.hasAttribute("data-state-index")) {
        setState(Number(target.getAttribute("data-state-index")), { force: true });
      } else if (target.hasAttribute("data-step")) {
        stepState(Number(target.getAttribute("data-step")));
      } else if (target.hasAttribute("data-res")) {
        selectComponent(target.getAttribute("data-res"));
      } else if (target.hasAttribute("data-dep")) {
        selectComponent(target.getAttribute("data-dep"));
      } else if (target.hasAttribute("data-close")) {
        clearSelection();
      }
  }

  function onKeydown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft") { event.preventDefault(); stepState(-1); }
      else if (event.key === "ArrowRight") { event.preventDefault(); stepState(1); }
      else if (event.key === "Home") { event.preventDefault(); setState(0); }
      else if (event.key === "End") { event.preventDefault(); setState(states.length - 1); }
      else if (event.key === "Escape") { clearSelection(); }
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
  }

  /* --------------------------------- card ------------------------------- */

  /* Everything is marked against the current estate (state 0), not the
     previous step: unchanged, changed, added, removed. A flag is a review note,
     not a change, so flagged resources stay unchanged. */
  function cardIndex(spec) {
    var value = String(spec == null ? "target" : spec).trim().toLowerCase();
    if (value === "current") return 0;
    if (value === "target" || value === "") return states.length - 1;
    if (/^\d+$/.test(value) && Number(value) < states.length) return Number(value);
    return -1;
  }

  function cardDiff(index) {
    var touched = {};
    for (var j = 1; j <= index; j += 1) {
      (states[j].changes || []).forEach(function (change) {
        if (change.kind !== "removed" && change.kind !== "flagged") touched[change.component] = true;
      });
    }
    function status(present, cid) {
      var before = !!present[0], now = !!present[index];
      if (before && now) return cid && touched[cid] ? "changed" : "unchanged";
      if (now) return cid && aliveAt(cid, 0) ? "moved" : "added";
      if (before) return cid && aliveAt(cid, index) ? "moved-out" : "removed";
      return "absent";
    }
    var counts = { unchanged: 0, changed: 0, moved: 0, added: 0, removed: 0, absent: 0, "moved-out": 0 };
    var nodes = {};
    topo.order.forEach(function (id) {
      nodes[id] = status(topo.nodes[id].present, topo.nodes[id].cid);
      counts[nodes[id]] += 1;
    });
    var links = topo.links.map(function (link) {
      var result = status(link.present, null);
      if (result === "removed" && linkSurvives(link, index)) return "absent";
      if (result === "added" && aliveAt(link.fromCid, 0) && aliveAt(link.toCid, 0)) return "rerouted";
      return result;
    });
    var trails = topo.trails.map(function (trail) { return trail.kind === "move" && trail.at <= index ? "trace" : "hidden"; });
    return { nodes: nodes, links: links, trails: trails, counts: counts };
  }

  function cardStateLabel(index) {
    if (index === 0) return stepCount === 0 ? "No changes" : "Current estate";
    return "After " + index + " change" + (index === 1 ? "" : "s");
  }

  function cardChip(layout) {
    if (layout.winner) return '<span class="card-chip" data-tone="good">Recommended</span>';
    if (layout.feasible === false) return '<span class="card-chip" data-tone="bad">Fails constraints</span>';
    if (layout.rank) return '<span class="card-chip">Rank ' + esc(layout.rank) + '</span>';
    return "";
  }

  function cardHtml(index, diff) {
    var layout = dataset.layout || { id: (dataset.source || {}).candidate || "plan", label: (dataset.source || {}).candidate || "Plan" };
    var base = states[0].summary.monthly_eur;
    var now = states[index].summary.monthly_eur;
    var money = index === 0
      ? '<span class="card-eur">' + fmtEur(base) + '</span><span class="card-per">/mo</span>'
      : '<span class="card-eur is-from">' + fmtEur(base) + '</span><span class="card-per">/mo</span>' +
        '<span class="card-arrow">→</span><span class="card-eur">' + fmtEur(now) + '</span><span class="card-per">/mo</span>';
    var pct = base ? Math.round((now - base) / base * 100) : 0;
    var delta = index === 0 || now === base ? ""
      : '<span class="card-delta' + (now < base ? " is-save" : " is-spend") + '">' + (pct < 0 ? "−" : "+") + Math.abs(pct) + '%</span>';
    var c = diff.counts;
    var legend;
    if (index === 0) {
      legend = '<li data-status="unchanged"><i></i>' + c.unchanged + ' resources, ' + (stepCount === 0 && String(CARD.state).trim().toLowerCase() !== "current" ? "nothing changes" : "as found") + '</li>';
    } else {
      legend = [["changed", c.changed], ["moved", c.moved], ["added", c.added], ["removed", c.removed], ["unchanged", c.unchanged]].filter(function (item) {
        return item[1] || item[0] !== "moved";
      }).map(function (item) {
        return '<li data-status="' + item[0] + '"><i></i><b>' + item[1] + '</b> ' + item[0] + '</li>';
      }).join("");
    }
    return '' +
      '<div class="card" data-card>' +
        '<header class="card-head">' +
          '<h1 class="card-title">' + esc(layout.label) + cardChip(layout) + '</h1>' +
          '<p class="card-money">' + money + delta + '</p>' +
          '<p class="card-state">' + esc(cardStateLabel(index)) + '<span class="card-project">' + esc(dataset.title || "") + '</span></p>' +
          '<ul class="card-legend" aria-label="Compared with the current estate">' + legend + '</ul>' +
        '</header>' +
        '<div class="card-canvas" data-topo-canvas></div>' +
      '</div>';
  }


  /* -------------------------------- boot -------------------------------- */

  function initialStateIndex() {
    var wanted = Number(settings.initialIndex);
    return wanted >= 0 && wanted < states.length ? wanted : 0;
  }


  app.innerHTML = shellHtml();
  refs.workspace = app.querySelector("[data-workspace]");
  refs.timeline = app.querySelector("[data-timeline]");
  refs.timeline.innerHTML = timelineHtml();
  refs.tlSummary = refs.timeline.querySelector("[data-tl-summary]");
  refs.tlViewport = refs.timeline.querySelector("[data-tl-viewport]");
  refs.tlTrack = refs.timeline.querySelector("[data-tl-track]");
  refs.detail = app.querySelector(".detail");
  refs.live = app.querySelector("[data-live]");
  refs.topo = app.querySelector("[data-topo]");
  refs.topo.innerHTML = topologyHtml();
  refs.topoReadout = refs.topo.querySelector("[data-topo-readout]");
  refs.topoCanvas = refs.topo.querySelector("[data-topo-canvas]");

  stateIndex = initialStateIndex();
  renderTopologyCanvas();
  updateTimeline();
  renderDetail();
  bind();
  return destroy;
}
