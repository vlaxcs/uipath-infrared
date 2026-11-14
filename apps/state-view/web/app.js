(function () {
  "use strict";

  var dataset = window.ESTATE && window.ESTATE.dataset;
  var app = document.getElementById("app");
  if (!dataset || !app) {
    if (app) app.innerHTML = '<p style="padding:24px;font:14px system-ui">No state data found.</p>';
    return;
  }

  var states = dataset.states || [];
  var stages = dataset.stages || [];
  var stepCount = dataset.stepCount || Math.max(0, states.length - 1);
  var stateIndex = 0;
  var selectedId = null;
  var theme = "light";
  var refs = {};

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

  var BASELINE = dataset.baseline || {};

  function shellHtml() {
    return '' +
      '<header class="mast">' +
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
    if (component.region) rows.push(["Region", component.region]);
    if (component.provider) rows.push(["Provider", component.provider]);
    if (component.service) rows.push(["Service", component.service]);
    if (component.sku) rows.push(["SKU", component.sku]);
    if (component.quantity != null) rows.push(["Quantity", component.quantity]);
    return '<dl class="facts">' + rows.map(function (row) {
      return '<dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd>';
    }).join("") + '</dl>';
  }

  function depsHtml(state, component) {
    var edges = state.infra.edges || [];
    var out = edges.filter(function (edge) { return edge.from === component.id; });
    var inbound = edges.filter(function (edge) { return edge.to === component.id; });
    function list(items, other) {
      if (!items.length) return '<p class="dep-empty">None in this state.</p>';
      return '<ul class="dep-list">' + items.map(function (edge) {
        var id = edge[other];
        return '<li><button type="button" class="dep-link" data-dep="' + esc(id) + '">' +
          '<span class="dep-name">' + esc(id) + '</span><span class="dep-kind">' + esc(edge.kind || "link") + '</span>' +
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
      '</div>';
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
    colW: [100, 172, 166], indent: 20, charW: 6.25, radius: 5, laneStep: 9
  };
  T.colX = [T.pad, T.pad + T.colW[0] + T.gap[0], T.pad + T.colW[0] + T.gap[0] + T.colW[1] + T.gap[1]];
  T.stackW = T.colX[2] + T.colW[2] + T.gutter;

  var COL_BY_KIND = {
    load_balancer: 0, cdn: 0, dns: 0, nat: 0,
    kubernetes_cluster: 1, node_group: 1, virtual_machine: 1, container: 1, function: 1
  };
  var COMPUTE_ORDER = { kubernetes_cluster: 0, virtual_machine: 1, container: 2, function: 3 };
  var DATA_ORDER = { postgres: 0, nosql: 1, cache: 2, queue: 3, stream: 4, object_storage: 5, file_system: 6, block_storage: 7 };
  var COLUMN_NAMES = ["Entry", "Compute", "Data and storage"];

  function colOf(kind) {
    return COL_BY_KIND[kind] == null ? 2 : COL_BY_KIND[kind];
  }

  var topo = (function buildTopology() {
    var nodes = {};
    var order = [];
    states.forEach(function (state) {
      state.infra.components.forEach(function (component) {
        if (!nodes[component.id]) {
          nodes[component.id] = {
            id: component.id, kind: component.kind, stack: component.stack,
            typeLabel: component.typeLabel, col: colOf(component.kind), present: []
          };
          order.push(component.id);
        }
        nodes[component.id].present[state.index] = true;
      });
    });

    /* Node groups have no edges in the infra model; draw their cluster
       membership as an inferred "hosts" link so removing a pool cuts a line. */
    function hostOf(node) {
      var clusters = order.map(function (id) { return nodes[id]; }).filter(function (other) {
        return other.stack === node.stack && other.kind === "kubernetes_cluster";
      });
      if (!clusters.length) return null;
      var tokens = node.id.split("-");
      var best = clusters[0];
      clusters.forEach(function (cluster) {
        if (tokens.some(function (token) { return token.length > 3 && cluster.id.indexOf(token) >= 0 && best.id.indexOf(token) < 0; })) best = cluster;
      });
      return best;
    }
    order.forEach(function (id) {
      if (nodes[id].kind === "node_group") nodes[id].host = hostOf(nodes[id]);
    });

    var links = {};
    function addLink(from, to, kind, inferred, index) {
      var key = from + ">" + to;
      if (!links[key]) links[key] = { key: key, from: from, to: to, kind: kind, inferred: inferred, present: [] };
      links[key].present[index] = true;
    }
    states.forEach(function (state) {
      (state.infra.edges || []).forEach(function (edge) { addLink(edge.from, edge.to, edge.kind, false, state.index); });
      state.infra.components.forEach(function (component) {
        var node = nodes[component.id];
        if (node.host && node.host.present[state.index]) addLink(node.host.id, node.id, "hosts", true, state.index);
      });
    });

    return {
      nodes: nodes,
      order: order,
      links: Object.keys(links).map(function (k) { return links[k]; }),
      stacks: states[0].infra.stacks,
      bands: [], columns: 0, width: 0, height: 0
    };
  })();

  function chipWidth(node) {
    return 18 + node.label.length * T.charW;
  }

  function neighbours(node, col) {
    return topo.links.filter(function (link) {
      return !link.inferred && (link.from === node.id || link.to === node.id);
    }).map(function (link) {
      return topo.nodes[link.from === node.id ? link.to : link.from];
    }).filter(function (other) {
      return other.stack === node.stack && other.col === col;
    });
  }

  /* Rows inside one stack: compute is a tree (cluster, then its pools), entry and
     data nodes sit level with the compute nodes they talk to. */
  function layoutBand(stack) {
    var members = topo.order.map(function (id) { return topo.nodes[id]; }).filter(function (node) { return node.stack === stack.id; });
    members.forEach(function (node) {
      var room = T.colW[node.col] - (node.kind === "node_group" ? T.indent : 0) - 18;
      var max = Math.floor(room / T.charW);
      node.label = node.id.length > max ? node.id.slice(0, max - 1) + "…" : node.id;
    });

    var compute = [];
    members.filter(function (node) { return node.col === 1 && node.kind !== "node_group"; })
      .sort(function (a, b) { return (COMPUTE_ORDER[a.kind] || 0) - (COMPUTE_ORDER[b.kind] || 0); })
      .forEach(function (node) {
        compute.push(node);
        members.forEach(function (pool) { if (pool.host === node) compute.push(pool); });
      });
    members.forEach(function (node) {
      if (node.col === 1 && compute.indexOf(node) < 0) compute.push(node);
    });
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
      list.forEach(function (node) {
        node.row = isFinite(node.want) ? Math.max(next, Math.round(node.want)) : next;
        next = node.row + 1;
      });
      return next;
    }
    var rows = Math.max(1, compute.length, placeBeside(0), placeBeside(2));
    members.forEach(function (node) {
      node.lx = T.colX[node.col] + (node.kind === "node_group" ? T.indent : 0);
      node.ly = T.head + node.row * T.row + T.row / 2;
    });
    return { stack: stack, h: T.head + rows * T.row + 8 };
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

  function layoutTopology(columns) {
    topo.bands = topo.stacks.map(layoutBand);
    var colY = [];
    for (var c = 0; c < columns; c += 1) colY.push(0);
    var byStack = {};
    topo.bands.forEach(function (band) {
      var col = colY.indexOf(Math.min.apply(null, colY));
      band.gc = col;
      band.x = col * (T.stackW + T.stackGap);
      band.y = colY[col];
      colY[col] += band.h + T.bandGap;
      byStack[band.stack.id] = band;
    });
    topo.order.forEach(function (id) {
      var node = topo.nodes[id];
      node.band = byStack[node.stack];
      node.x = node.band.x + node.lx;
      node.y = node.band.y + node.ly;
      node.w = chipWidth(node);
    });
    topo.columns = columns;
    topo.width = columns * T.stackW + (columns - 1) * T.stackGap;
    topo.height = Math.max.apply(null, colY) - T.bandGap;
    routeLinks();
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

    topo.links.forEach(function (link) {
      var a = topo.nodes[link.from];
      var b = topo.nodes[link.to];
      link.route = null;
      if (link.inferred) {
        var gx = a.x + 7;
        link.route = function () { return [[gx, a.y + 9], [gx, b.y], [b.x - 2, b.y]]; };
        return;
      }
      if (a.band === b.band) {
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
      if (L.band.gc === R.band.gc) {
        var side = channel("edge:" + L.band.gc, L.band.x + T.stackW - 6, L.band.x + T.stackW + T.stackGap / 2, false);
        var sb = bundle(side, "x:" + link.key, L.y);
        sb.tys.push(R.y);
        link.route = function () { return [right(L), [sb.x, L.y], [sb.x, R.y], right(R)]; };
        return;
      }
      var corridorX = L.band.x + T.stackW;
      var corridor = channel("corridor:" + L.band.gc, corridorX + 6, corridorX + T.stackGap - 6, false);
      var headY = R.band.y + 34;
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

  function linkStatus(link, index) {
    var now = !!link.present[index];
    var before = index > 0 && !!link.present[index - 1];
    if (now) return index > 0 && !before ? "forming" : "live";
    if (before) return "breaking";
    for (var i = 0; i < index; i += 1) if (link.present[i]) return "broken";
    return "future";
  }

  function nodeStatus(node, index) {
    if (node.present[index]) return "live";
    if (index > 0 && node.present[index - 1]) return "removing";
    return node.present.slice(0, index).some(Boolean) ? "removed" : "future";
  }

  /* Split at the middle of the last segment: that branch belongs to this link
     alone, so the snap reads even where bundles share a trunk. */
  function linkSvg(link) {
    var pts = link.points;
    var n = pts.length;
    var a = pts[n - 2], b = pts[n - 1];
    var m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    var first = pts.slice(0, n - 1).concat([m]);
    var second = [b, m];
    var vertical = Math.abs(a[0] - b[0]) < 0.5;
    var title = link.from + " → " + link.to + " (" + link.kind + (link.inferred ? ", inferred" : "") + ")";
    return '<g class="tlink" data-link="' + esc(link.key) + '" data-kind="' + esc(link.kind) + '"' + (link.inferred ? ' data-inferred="true"' : '') + '>' +
      '<title>' + esc(title) + '</title>' +
      '<path class="tlink-half" pathLength="1" d="' + roundedPath(first) + '"></path>' +
      '<path class="tlink-half" pathLength="1" d="' + roundedPath(second) + '"></path>' +
      '<path class="tlink-snap" transform="translate(' + m[0].toFixed(1) + ' ' + m[1].toFixed(1) + ')' + (vertical ? ' rotate(90)' : '') + '" d="M-4 -5l3 5-3 5M4 -5l-3 5 3 5"></path>' +
    '</g>';
  }

  function nodeShape(node) {
    var x = node.x + 7, y = node.y;
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
    return '<g class="tnode" data-node="' + esc(node.id) + '" data-kind="' + esc(node.kind) + '" data-res="' + esc(node.id) + '">' +
      '<title>' + esc(node.id + ", " + node.typeLabel) + '</title>' +
      '<rect class="tnode-hit" x="' + (node.x - 4) + '" y="' + (node.y - 11) + '" width="' + (node.w + 8) + '" height="22"></rect>' +
      nodeShape(node) +
      '<text class="tnode-label" x="' + (node.x + 18) + '" y="' + (node.y + 3.6) + '">' + esc(node.label) + '</text>' +
    '</g>';
  }

  function topologySvg() {
    var bands = topo.bands.map(function (band) {
      var captions = COLUMN_NAMES.map(function (name, col) {
        return col === 0 ? "" : '<text class="tband-col" x="' + (band.x + T.colX[col]) + '" y="' + (band.y + 21) + '">' + esc(name) + '</text>';
      }).join("");
      return '<g class="tband">' +
        '<rect x="' + band.x + '" y="' + band.y + '" width="' + T.stackW + '" height="' + band.h + '"></rect>' +
        '<path class="tband-rule" d="M' + band.x + ' ' + (band.y + 28) + 'h' + T.stackW + '"></path>' +
        '<text class="tband-name" x="' + (band.x + T.pad) + '" y="' + (band.y + 19) + '">' + esc(band.stack.name) + '</text>' +
        captions +
        '<text class="tband-env" x="' + (band.x + T.stackW - T.pad) + '" y="' + (band.y + 19) + '" text-anchor="end">' + esc(band.stack.environment || "") + '</text>' +
      '</g>';
    }).join("");
    var links = topo.links.map(linkSvg).join("");
    var nodes = topo.order.map(function (id) { return nodeSvg(topo.nodes[id]); }).join("");
    var pad = 4;
    return '<svg class="topo-graph" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + (topo.width + pad * 2) + ' ' + (topo.height + pad * 2) + '"' +
        ' preserveAspectRatio="xMidYMin meet" role="img" aria-label="Estate topology">' +
        bands + '<g class="tlinks">' + links + '</g><g class="tnodes">' + nodes + '</g>' +
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
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><path class="lg-broken" d="M1 4h9M18 4h9"/></svg>Cut when a resource is removed</li>' +
          '<li><svg viewBox="0 0 28 8" aria-hidden="true"><circle class="lg-ghost" cx="14" cy="4" r="3"/></svg>Removed resource</li>' +
        '</ul>' +
        '<p class="footnote">Sample plan. Costs between A and B are modelled from action savings; availability is measured at A and estimated at B.</p>' +
      '</div>';
  }

  function updateTopology() {
    if (!refs.topoCanvas || !refs.topoCanvas.firstChild) return;
    var index = stateIndex;
    var state = currentState();
    var focus = selectedId;
    var cutNow = [];
    var counts = { live: 0, broken: 0 };
    var related = {};
    Array.prototype.forEach.call(refs.topo.querySelectorAll(".tlink"), function (el, i) {
      var link = topo.links[i];
      var status = linkStatus(link, index);
      el.setAttribute("data-status", status);
      if (status === "live" || status === "forming") counts.live += 1;
      if (status === "broken" || status === "breaking") counts.broken += 1;
      if (status === "breaking") cutNow.push(link);
      var touches = focus && (link.from === focus || link.to === focus);
      el.classList.toggle("is-focus", !!touches);
      if (touches) { related[link.from] = true; related[link.to] = true; }
    });
    Array.prototype.forEach.call(refs.topo.querySelectorAll(".tnode"), function (el) {
      var id = el.getAttribute("data-node");
      var change = changeFor(state, id);
      el.setAttribute("data-status", nodeStatus(topo.nodes[id], index));
      if (change && change.kind !== "removed") el.setAttribute("data-change", change.kind);
      else el.removeAttribute("data-change");
      el.classList.toggle("is-selected", id === focus);
      el.classList.toggle("is-other", !!focus && !related[id] && id !== focus);
    });
    refs.topo.querySelector(".topo-graph").classList.toggle("has-focus", !!focus);
    var readout = '<span class="tr-pos">' + (index === 0 ? "A" : index === states.length - 1 ? "B" : "Step " + pad2(state.step)) + '</span>' +
      '<span>' + counts.live + ' links live</span>' +
      '<span class="' + (counts.broken ? "tr-cut" : "") + '">' + counts.broken + ' cut</span>';
    if (cutNow.length) {
      readout += '<span class="tr-now">Cut this step: ' + cutNow.map(function (link) {
        return esc(link.from) + ' → ' + esc(link.to);
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
    try {
      window.history.replaceState(null, "", "#" + currentState().id);
    } catch (err) { /* file:// may refuse history updates */ }
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

  function setTheme(next, persist) {
    theme = next === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-set]"), function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-theme-set") === theme ? "true" : "false");
    });
    if (persist) {
      try { window.localStorage.setItem("infrared.theme", theme); } catch (err) { /* ignore */ }
    }
  }

  function initialTheme() {
    var saved = null;
    try { saved = window.localStorage.getItem("infrared.theme"); } catch (err) { /* ignore */ }
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /* --------------------------------- bind ------------------------------- */

  function bind() {
    document.addEventListener("click", function (event) {
      var target = event.target.closest("[data-state-index],[data-step],[data-res],[data-dep],[data-close],[data-theme-set],[data-topo-jump],[data-topo-play]");
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
      } else if (target.hasAttribute("data-theme-set")) {
        setTheme(target.getAttribute("data-theme-set"), true);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft") { event.preventDefault(); stepState(-1); }
      else if (event.key === "ArrowRight") { event.preventDefault(); stepState(1); }
      else if (event.key === "Home") { event.preventDefault(); setState(0); }
      else if (event.key === "End") { event.preventDefault(); setState(states.length - 1); }
      else if (event.key === "Escape") { clearSelection(); }
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
  }

  /* -------------------------------- boot -------------------------------- */

  function initialStateIndex() {
    var match = /state-(\d+)/.exec(window.location.hash || "");
    if (!match) return 0;
    var idx = Number(match[1]);
    return idx >= 0 && idx < states.length ? idx : 0;
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
  setTheme(initialTheme(), false);
  renderTopologyCanvas();
  updateTimeline();
  renderDetail();
  bind();
})();
